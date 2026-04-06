import express from 'express';
import fs from 'fs';
import fsp from 'fs/promises';
import { createRequire } from 'module';
import path from 'path';

import multer from 'multer';

import { requireAuth } from '../middleware/auth.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { User } from '../models/User.js';

const router = express.Router();
const require = createRequire(import.meta.url);
const archiver = require('archiver');
const uploadsDir = path.resolve(process.cwd(), 'uploads', 'project-submissions');
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;

const STATUS_VALUES = ['Pending', 'In Progress', 'Completed'];
const SUBMISSION_VALUES = ['Submitted', 'Approved', 'Rejected'];

const upload = multer({
  storage: multer.diskStorage({
    destination(request, file, callback) {
      fsp.mkdir(uploadsDir, { recursive: true })
        .then(() => callback(null, uploadsDir))
        .catch((error) => callback(error));
    },
    filename(request, file, callback) {
      const safeName = String(file.originalname || 'submission').replace(/[^a-zA-Z0-9._-]/g, '_');
      callback(null, `${Date.now()}-${safeName}`);
    }
  }),
  limits: { fileSize: MAX_UPLOAD_SIZE }
});

router.use(requireAuth);

function isProjectParticipant(project, userId) {
  const userKey = String(userId);
  const ownerId = project.ownerId?._id || project.ownerId;

  if (String(ownerId) === userKey) {
    return true;
  }

  return (project.memberIds || []).some((member) => String(member._id || member) === userKey);
}

function canManageProject(project, user) {
  return ['org_admin', 'manager'].includes(user.role) || isProjectParticipant(project, user.userId);
}

function buildProjectBundle(project) {
  const lines = [
    `Project: ${project.name}`,
    `Description: ${project.description || 'No description provided.'}`,
    `Status: ${project.status}`,
    `Progress: ${project.progressPercentage ?? 0}%`,
    `Start Date: ${project.startDate ? new Date(project.startDate).toLocaleDateString() : 'Not set'}`,
    `End Date: ${project.endDate ? new Date(project.endDate).toLocaleDateString() : 'Not set'}`,
    `Submission Status: ${project.submissionStatus || 'Not Submitted'}`,
    '',
    'Open this folder in VS Code to continue development.',
    'Then run the project using the repository scripts.'
  ];

  return lines.join('\n');
}

function slugify(value) {
  return String(value || 'project')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

router.get('/', async (request, response) => {
  const {
    search = '',
    status = '',
    mine = '',
    sort = 'newest',
    page = '1',
    pageSize = '5'
  } = request.query;

  const query = { organizationId: request.user.organizationId };
  const trimmedSearch = String(search).trim();
  const normalizedStatus = String(status).trim();
  const currentPage = Math.max(Number.parseInt(page, 10) || 1, 1);
  const currentPageSize = Math.min(Math.max(Number.parseInt(pageSize, 10) || 5, 1), 20);

  if (trimmedSearch) {
    query.name = { $regex: trimmedSearch, $options: 'i' };
  }

  if (STATUS_VALUES.includes(normalizedStatus)) {
    query.status = normalizedStatus;
  }

  const onlyMyProjects = ['1', 'true', 'yes'].includes(String(mine).toLowerCase());
  if (onlyMyProjects) {
    query.$or = [{ ownerId: request.user.userId }, { memberIds: request.user.userId }];
  }

  const sortMap = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    updated: { updatedAt: -1 },
    name: { name: 1 }
  };

  const [projects, total] = await Promise.all([
    Project.find(query)
      .sort(sortMap[String(sort)] || sortMap.newest)
      .skip((currentPage - 1) * currentPageSize)
      .limit(currentPageSize)
      .populate('memberIds', '_id name email role')
      .populate('ownerId', '_id name email')
      .select('_id organizationId name description status startDate endDate ownerId memberIds createdAt updatedAt'),
    Project.countDocuments(query)
  ]);

  response.json({
    projects,
    pagination: {
      page: currentPage,
      pageSize: currentPageSize,
      total,
      totalPages: Math.max(Math.ceil(total / currentPageSize), 1)
    }
  });
});

router.get('/stats', async (request, response) => {
  const [totalProjects, completedProjects, inProgressProjects, pendingProjects] = await Promise.all([
    Project.countDocuments({ organizationId: request.user.organizationId }),
    Project.countDocuments({ organizationId: request.user.organizationId, status: 'Completed' }),
    Project.countDocuments({ organizationId: request.user.organizationId, status: 'In Progress' }),
    Project.countDocuments({ organizationId: request.user.organizationId, status: 'Pending' })
  ]);

  response.json({
    stats: {
      totalProjects,
      completedProjects,
      inProgressProjects,
      pendingProjects
    }
  });
});

router.get('/:id', async (request, response) => {
  const project = await Project.findOne({
    _id: request.params.id,
    organizationId: request.user.organizationId
  })
    .populate('memberIds', '_id name email role')
    .populate('ownerId', '_id name email role');

  if (!project) {
    response.status(404).json({ error: 'Project not found.' });
    return;
  }

  const activity = await ActivityLog.find({
    organizationId: request.user.organizationId,
    projectId: project._id
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .select('_id actorName action message createdAt');

  const comments = activity
    .filter((item) => item.action === 'comment_added')
    .map((item) => ({
      _id: item._id,
      actorName: item.actorName,
      message: item.message,
      createdAt: item.createdAt
    }));

  const tasks = await Task.find({
    organizationId: request.user.organizationId,
    projectId: project._id
  })
    .sort({ createdAt: -1 })
    .populate('assigneeId', '_id name email role')
    .populate('createdById', '_id name email role')
    .select('_id title description status assigneeId createdById createdAt updatedAt');

  const assignableUsers = await getAssignableUsers({
    organizationId: request.user.organizationId,
    project,
    role: request.user.role
  });

  response.json({ project, activity, comments, tasks, assignableUsers });
});

router.patch('/:id/progress', async (request, response) => {
  const { progressPercentage } = request.body || {};
  const numericProgress = Number(progressPercentage);

  if (Number.isNaN(numericProgress) || numericProgress < 0 || numericProgress > 100) {
    response.status(400).json({ error: 'Progress must be a number between 0 and 100.' });
    return;
  }

  const project = await Project.findOne({
    _id: request.params.id,
    organizationId: request.user.organizationId
  });

  if (!project) {
    response.status(404).json({ error: 'Project not found.' });
    return;
  }

  if (!canManageProject(project, request.user)) {
    response.status(403).json({ error: 'You cannot update progress for this project.' });
    return;
  }

  project.progressPercentage = numericProgress;

  if (numericProgress >= 100) {
    project.status = 'Completed';
  } else if (numericProgress > 0 && project.status === 'Pending') {
    project.status = 'In Progress';
  }

  await project.save();

  await logProjectActivity({
    organizationId: request.user.organizationId,
    projectId: project._id,
    actorId: request.user.userId,
    actorName: request.user.name,
    action: 'progress_updated',
    message: `Progress updated to ${numericProgress}% by ${request.user.name}`
  });

  const populatedProject = await Project.findById(project._id)
    .populate('memberIds', '_id name email role')
    .populate('ownerId', '_id name email role');

  response.json({ project: populatedProject });
});

router.post('/:id/comments', async (request, response) => {
  const { message } = request.body || {};
  const normalizedMessage = String(message || '').trim();

  if (!normalizedMessage) {
    response.status(400).json({ error: 'Comment cannot be empty.' });
    return;
  }

  const project = await Project.findOne({
    _id: request.params.id,
    organizationId: request.user.organizationId
  });

  if (!project) {
    response.status(404).json({ error: 'Project not found.' });
    return;
  }

  if (!canManageProject(project, request.user)) {
    response.status(403).json({ error: 'You cannot comment on this project.' });
    return;
  }

  const comment = await logProjectActivity({
    organizationId: request.user.organizationId,
    projectId: project._id,
    actorId: request.user.userId,
    actorName: request.user.name,
    action: 'comment_added',
    message: normalizedMessage
  });

  response.status(201).json({ comment });
});

router.patch('/:id/status', async (request, response) => {
  const { status } = request.body || {};
  if (!STATUS_VALUES.includes(status)) {
    response.status(400).json({ error: 'Invalid project status.' });
    return;
  }

  const project = await Project.findOne({
    _id: request.params.id,
    organizationId: request.user.organizationId
  }).populate('memberIds', '_id name email role').populate('ownerId', '_id name email role');

  if (!project) {
    response.status(404).json({ error: 'Project not found.' });
    return;
  }

  if (!canManageProject(project, request.user)) {
    response.status(403).json({ error: 'You cannot update this project status.' });
    return;
  }

  const previousStatus = project.status;
  project.status = status;

  if (status === 'Completed') {
    project.progressPercentage = Math.max(project.progressPercentage || 0, 100);
  } else if (status === 'In Progress' && project.progressPercentage === 0) {
    project.progressPercentage = 25;
  }

  await project.save();

  await logProjectActivity({
    organizationId: request.user.organizationId,
    projectId: project._id,
    actorId: request.user.userId,
    actorName: request.user.name,
    action: status === 'In Progress' && previousStatus === 'Pending' ? 'project_started' : 'status_changed',
    message:
      status === 'In Progress' && previousStatus === 'Pending'
        ? `Project started by ${request.user.name}`
        : `Status changed to ${status} by ${request.user.name}`
  });

  const populatedProject = await Project.findById(project._id)
    .populate('memberIds', '_id name email role')
    .populate('ownerId', '_id name email role');

  response.json({ project: populatedProject });
});

router.post('/:id/submit', upload.single('file'), async (request, response) => {
  const { note = '', versionLabel = '' } = request.body || {};

  const project = await Project.findOne({
    _id: request.params.id,
    organizationId: request.user.organizationId
  }).populate('memberIds', '_id name email role').populate('ownerId', '_id name email role');

  if (!project) {
    response.status(404).json({ error: 'Project not found.' });
    return;
  }

  if (!canManageProject(project, request.user)) {
    response.status(403).json({ error: 'You cannot submit this project.' });
    return;
  }

  if (!request.file) {
    response.status(400).json({ error: 'Please upload a file.' });
    return;
  }

  if (request.file.size > MAX_UPLOAD_SIZE) {
    response.status(400).json({ error: 'File size exceeds 10 MB.' });
    return;
  }

  const version = project.submissionVersion + 1;
  const historyEntry = {
    version,
    note: String(note || versionLabel || '').trim(),
    originalName: request.file.originalname,
    fileName: request.file.filename,
    filePath: request.file.path,
    size: request.file.size,
    mimeType: request.file.mimetype,
    uploadedBy: request.user.userId,
    uploadedAt: new Date()
  };

  project.submissionVersion = version;
  project.submissionStatus = 'Submitted';
  project.submissionNote = historyEntry.note;
  project.submissionFileName = request.file.filename;
  project.submissionOriginalName = request.file.originalname;
  project.submissionFilePath = request.file.path;
  project.submissionSubmittedAt = new Date();
  project.submissionReviewedAt = null;
  project.submissionReviewedBy = null;
  project.submissionReviewNote = '';
  project.submissionHistory.push(historyEntry);

  await project.save();

  await logProjectActivity({
    organizationId: request.user.organizationId,
    projectId: project._id,
    actorId: request.user.userId,
    actorName: request.user.name,
    action: 'project_submitted',
    message: `Project submitted as version ${version} by ${request.user.name}`
  });

  const populatedProject = await Project.findById(project._id)
    .populate('memberIds', '_id name email role')
    .populate('ownerId', '_id name email role')
    .populate('submissionReviewedBy', '_id name email role');

  response.status(201).json({ project: populatedProject });
});

router.patch('/:id/submission/review', async (request, response) => {
  const { submissionStatus, reviewNote = '' } = request.body || {};

  if (!SUBMISSION_VALUES.includes(submissionStatus)) {
    response.status(400).json({ error: 'Invalid submission status.' });
    return;
  }

  if (!['org_admin', 'manager'].includes(request.user.role)) {
    response.status(403).json({ error: 'Only admins and managers can review submissions.' });
    return;
  }

  const project = await Project.findOne({
    _id: request.params.id,
    organizationId: request.user.organizationId
  }).populate('memberIds', '_id name email role').populate('ownerId', '_id name email role');

  if (!project) {
    response.status(404).json({ error: 'Project not found.' });
    return;
  }

  if (project.submissionStatus === 'Not Submitted') {
    response.status(400).json({ error: 'No submission is available to review.' });
    return;
  }

  project.submissionStatus = submissionStatus;
  project.submissionReviewedBy = request.user.userId;
  project.submissionReviewedAt = new Date();
  project.submissionReviewNote = String(reviewNote || '').trim();

  if (submissionStatus === 'Approved') {
    project.status = 'Completed';
    project.progressPercentage = 100;
  }

  await project.save();

  await logProjectActivity({
    organizationId: request.user.organizationId,
    projectId: project._id,
    actorId: request.user.userId,
    actorName: request.user.name,
    action: 'submission_reviewed',
    message: `Submission ${submissionStatus.toLowerCase()} by ${request.user.name}`
  });

  const populatedProject = await Project.findById(project._id)
    .populate('memberIds', '_id name email role')
    .populate('ownerId', '_id name email role')
    .populate('submissionReviewedBy', '_id name email role');

  response.json({ project: populatedProject });
});

router.get('/:id/download', async (request, response) => {
  const project = await Project.findOne({
    _id: request.params.id,
    organizationId: request.user.organizationId
  }).populate('memberIds', '_id name email role').populate('ownerId', '_id name email role');

  if (!project) {
    response.status(404).json({ error: 'Project not found.' });
    return;
  }

  if (!canManageProject(project, request.user)) {
    response.status(403).json({ error: 'You cannot download this project bundle.' });
    return;
  }

  const fileName = `${slugify(project.name || 'project')}-bundle.zip`;
  response.setHeader('Content-Type', 'application/zip');
  response.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (error) => {
    response.status(500).json({ error: error.message });
  });

  archive.pipe(response);
  archive.append(buildProjectBundle(project), { name: 'README.txt' });
  archive.append(JSON.stringify(project.toObject(), null, 2), { name: 'project.json' });

  if (project.submissionHistory?.length) {
    archive.append(JSON.stringify(project.submissionHistory, null, 2), { name: 'submission-history.json' });
  }

  await archive.finalize();
});

router.post('/', async (request, response) => {
  if (request.user.role !== 'org_admin') {
    response.status(403).json({ error: 'Only organization admins can create projects.' });
    return;
  }

  const {
    name,
    description = '',
    status = 'Pending',
    startDate = null,
    endDate = null,
    memberIds = []
  } = request.body || {};

  if (!name) {
    response.status(400).json({ error: 'Project name is required.' });
    return;
  }

  if (!STATUS_VALUES.includes(status)) {
    response.status(400).json({ error: 'Invalid project status.' });
    return;
  }

  const normalizedStartDate = parseOptionalDate(startDate);
  const normalizedEndDate = parseOptionalDate(endDate);

  if (startDate && !normalizedStartDate) {
    response.status(400).json({ error: 'Invalid start date.' });
    return;
  }

  if (endDate && !normalizedEndDate) {
    response.status(400).json({ error: 'Invalid end date.' });
    return;
  }

  if (normalizedStartDate && normalizedEndDate && normalizedStartDate > normalizedEndDate) {
    response.status(400).json({ error: 'Start date must be before or equal to end date.' });
    return;
  }

  const validMembers = await resolveOrganizationMembers(request.user.organizationId, memberIds);

  const project = await Project.create({
    organizationId: request.user.organizationId,
    name: String(name).trim(),
    description: String(description).trim(),
    status,
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
    ownerId: request.user.userId,
    memberIds: validMembers
  });

  await logProjectActivity({
    organizationId: request.user.organizationId,
    projectId: project._id,
    actorId: request.user.userId,
    actorName: request.user.name,
    action: 'project_created',
    message: `Project created by ${request.user.name}`
  });

  response.status(201).json({ project });
});

router.patch('/:id', async (request, response) => {
  if (request.user.role !== 'org_admin') {
    response.status(403).json({ error: 'Only organization admins can edit projects.' });
    return;
  }

  const existingProject = await Project.findOne({
    _id: request.params.id,
    organizationId: request.user.organizationId
  }).select('_id startDate endDate');

  if (!existingProject) {
    response.status(404).json({ error: 'Project not found.' });
    return;
  }

  const updates = {};
  const { name, description, status, startDate, endDate, memberIds } = request.body || {};

  if (name !== undefined) {
    if (!String(name).trim()) {
      response.status(400).json({ error: 'Project name cannot be empty.' });
      return;
    }
    updates.name = String(name).trim();
  }

  if (description !== undefined) {
    updates.description = String(description).trim();
  }

  if (status !== undefined) {
    if (!STATUS_VALUES.includes(status)) {
      response.status(400).json({ error: 'Invalid project status.' });
      return;
    }
    updates.status = status;
  }

  if (startDate !== undefined) {
    const normalizedStartDate = parseOptionalDate(startDate);
    if (startDate && !normalizedStartDate) {
      response.status(400).json({ error: 'Invalid start date.' });
      return;
    }
    updates.startDate = normalizedStartDate;
  }

  if (endDate !== undefined) {
    const normalizedEndDate = parseOptionalDate(endDate);
    if (endDate && !normalizedEndDate) {
      response.status(400).json({ error: 'Invalid end date.' });
      return;
    }
    updates.endDate = normalizedEndDate;
  }

  const effectiveStartDate = updates.startDate !== undefined ? updates.startDate : existingProject.startDate;
  const effectiveEndDate = updates.endDate !== undefined ? updates.endDate : existingProject.endDate;

  if (
    (updates.startDate !== undefined || updates.endDate !== undefined) &&
    effectiveStartDate &&
    effectiveEndDate &&
    effectiveStartDate > effectiveEndDate
  ) {
    response.status(400).json({ error: 'Start date must be before or equal to end date.' });
    return;
  }

  if (memberIds !== undefined) {
    updates.memberIds = await resolveOrganizationMembers(request.user.organizationId, memberIds);
  }

  if (!Object.keys(updates).length) {
    response.status(400).json({ error: 'No project updates were provided.' });
    return;
  }

  const project = await Project.findOneAndUpdate(
    {
      _id: existingProject._id,
      organizationId: request.user.organizationId
    },
    updates,
    { new: true }
  ).populate('memberIds', '_id name email role');

  await logProjectActivity({
    organizationId: request.user.organizationId,
    projectId: project._id,
    actorId: request.user.userId,
    actorName: request.user.name,
    action: 'project_updated',
    message: `Project updated by ${request.user.name}`
  });

  response.json({ project });
});

router.patch('/:id/members', async (request, response) => {
  if (request.user.role !== 'org_admin') {
    response.status(403).json({ error: 'Only organization admins can manage project members.' });
    return;
  }

  const { memberIds = [] } = request.body || {};
  const validMembers = await resolveOrganizationMembers(request.user.organizationId, memberIds);

  const project = await Project.findOneAndUpdate(
    {
      _id: request.params.id,
      organizationId: request.user.organizationId
    },
    { memberIds: validMembers },
    { new: true }
  ).populate('memberIds', '_id name email role');

  if (!project) {
    response.status(404).json({ error: 'Project not found.' });
    return;
  }

  await logProjectActivity({
    organizationId: request.user.organizationId,
    projectId: project._id,
    actorId: request.user.userId,
    actorName: request.user.name,
    action: 'members_updated',
    message: `Project members updated by ${request.user.name}`
  });

  response.json({ project });
});

router.delete('/:id', async (request, response) => {
  if (request.user.role !== 'org_admin') {
    response.status(403).json({ error: 'Only organization admins can delete projects.' });
    return;
  }

  const project = await Project.findOneAndDelete({
    _id: request.params.id,
    organizationId: request.user.organizationId
  });

  if (!project) {
    response.status(404).json({ error: 'Project not found.' });
    return;
  }

  await logProjectActivity({
    organizationId: request.user.organizationId,
    projectId: project._id,
    actorId: request.user.userId,
    actorName: request.user.name,
    action: 'project_deleted',
    message: `Project deleted by ${request.user.name}`
  });

  response.json({ success: true });
});

router.post('/:id/tasks', async (request, response) => {
  const { title, description = '', assigneeId, status = 'Pending' } = request.body || {};
  if (!title || !assigneeId) {
    response.status(400).json({ error: 'Task title and assignee are required.' });
    return;
  }

  if (!STATUS_VALUES.includes(status)) {
    response.status(400).json({ error: 'Invalid task status.' });
    return;
  }

  const project = await Project.findOne({
    _id: request.params.id,
    organizationId: request.user.organizationId
  });

  if (!project) {
    response.status(404).json({ error: 'Project not found.' });
    return;
  }

  const isProjectOwner = project.ownerId.toString() === request.user.userId;
  const canCreateTask = ['org_admin', 'manager'].includes(request.user.role) || isProjectOwner;

  if (!canCreateTask) {
    response.status(403).json({ error: 'Only admins, managers, or project owner can create tasks.' });
    return;
  }

  const assignee = await findAssignableUser({
    organizationId: request.user.organizationId,
    project,
    assigneeId
  });

  if (!assignee) {
    response.status(400).json({ error: 'Assignee must be an active project member, manager, or organization admin.' });
    return;
  }

  const task = await Task.create({
    organizationId: request.user.organizationId,
    projectId: project._id,
    title: String(title).trim(),
    description: String(description).trim(),
    status,
    assigneeId: assignee._id,
    createdById: request.user.userId
  });

  await logProjectActivity({
    organizationId: request.user.organizationId,
    projectId: project._id,
    actorId: request.user.userId,
    actorName: request.user.name,
    action: 'task_created',
    message: `Task "${task.title}" assigned to ${assignee.name} by ${request.user.name}`
  });

  const populatedTask = await Task.findById(task._id)
    .populate('assigneeId', '_id name email role')
    .populate('createdById', '_id name email role');

  response.status(201).json({ task: populatedTask });
});

router.patch('/:projectId/tasks/:taskId', async (request, response) => {
  const { status, assigneeId } = request.body || {};

  const project = await Project.findOne({
    _id: request.params.projectId,
    organizationId: request.user.organizationId
  });

  if (!project) {
    response.status(404).json({ error: 'Project not found.' });
    return;
  }

  const task = await Task.findOne({
    _id: request.params.taskId,
    projectId: project._id,
    organizationId: request.user.organizationId
  });

  if (!task) {
    response.status(404).json({ error: 'Task not found.' });
    return;
  }

  const isAssignee = task.assigneeId.toString() === request.user.userId;
  const isProjectOwner = project.ownerId.toString() === request.user.userId;
  const canManageTask = ['org_admin', 'manager'].includes(request.user.role) || isProjectOwner;

  if (!canManageTask && !isAssignee) {
    response.status(403).json({ error: 'You cannot update this task.' });
    return;
  }

  if (status) {
    if (!STATUS_VALUES.includes(status)) {
      response.status(400).json({ error: 'Invalid task status.' });
      return;
    }
    task.status = status;
  }

  if (assigneeId) {
    if (!canManageTask) {
      response.status(403).json({ error: 'Only admins, managers, or project owner can reassign tasks.' });
      return;
    }

    const assignee = await findAssignableUser({
      organizationId: request.user.organizationId,
      project,
      assigneeId
    });

    if (!assignee) {
      response.status(400).json({ error: 'New assignee must be an active project member, manager, or organization admin.' });
      return;
    }

    task.assigneeId = assignee._id;
  }

  await task.save();

  if (status) {
    await logProjectActivity({
      organizationId: request.user.organizationId,
      projectId: project._id,
      actorId: request.user.userId,
      actorName: request.user.name,
      action: 'task_status_changed',
      message: `Task "${task.title}" status changed to ${task.status} by ${request.user.name}`
    });
  }

  if (assigneeId) {
    const assignee = await User.findById(task.assigneeId).select('name');
    await logProjectActivity({
      organizationId: request.user.organizationId,
      projectId: project._id,
      actorId: request.user.userId,
      actorName: request.user.name,
      action: 'task_reassigned',
      message: `Task "${task.title}" reassigned to ${assignee?.name || 'a user'} by ${request.user.name}`
    });
  }

  const populatedTask = await Task.findById(task._id)
    .populate('assigneeId', '_id name email role')
    .populate('createdById', '_id name email role');

  response.json({ task: populatedTask });
});

async function resolveOrganizationMembers(organizationId, memberIds) {
  if (!Array.isArray(memberIds) || !memberIds.length) {
    return [];
  }

  const users = await User.find({
    _id: { $in: memberIds },
    organizationId,
    isActive: true
  }).select('_id');

  return users.map((user) => user._id);
}

async function logProjectActivity(entry) {
  return ActivityLog.create(entry);
}

async function getAssignableUsers({ organizationId, project, role }) {
  const memberIds = (project.memberIds || []).map((memberId) => memberId.toString());
  const baseIds = [project.ownerId.toString(), ...memberIds];

  const query = {
    organizationId,
    isActive: true,
    $or: [
      { _id: { $in: baseIds } },
      { role: { $in: ['org_admin', 'manager'] } }
    ]
  };

  const users = await User.find(query)
    .select('_id name email role')
    .sort({ name: 1 });

  if (role === 'member') {
    return users.filter((user) => user._id.toString() === project.ownerId.toString() || memberIds.includes(user._id.toString()));
  }

  return users;
}

async function findAssignableUser({ organizationId, project, assigneeId }) {
  const users = await getAssignableUsers({ organizationId, project, role: 'org_admin' });
  return users.find((user) => user._id.toString() === String(assigneeId)) || null;
}

function parseOptionalDate(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export default router;
