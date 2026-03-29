import express from 'express';

import { requireAuth } from '../middleware/auth.js';
import { ActivityLog } from '../models/ActivityLog.js';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { User } from '../models/User.js';

const router = express.Router();

const STATUS_VALUES = ['Pending', 'In Progress', 'Completed'];

router.use(requireAuth);

router.get('/', async (request, response) => {
  const {
    search = '',
    status = '',
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
      .select('_id organizationId name description status ownerId memberIds createdAt updatedAt'),
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
  }).populate('memberIds', '_id name email role');

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

  response.json({ project, activity, tasks, assignableUsers });
});

router.post('/', async (request, response) => {
  if (request.user.role !== 'org_admin') {
    response.status(403).json({ error: 'Only organization admins can create projects.' });
    return;
  }

  const { name, description = '', memberIds = [] } = request.body || {};

  if (!name) {
    response.status(400).json({ error: 'Project name is required.' });
    return;
  }

  const validMembers = await resolveOrganizationMembers(request.user.organizationId, memberIds);

  const project = await Project.create({
    organizationId: request.user.organizationId,
    name: String(name).trim(),
    description: String(description).trim(),
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

router.patch('/:id/status', async (request, response) => {
  if (!['org_admin', 'manager'].includes(request.user.role)) {
    response.status(403).json({ error: 'Only admins and managers can update project status.' });
    return;
  }

  const { status } = request.body || {};
  if (!STATUS_VALUES.includes(status)) {
    response.status(400).json({ error: 'Invalid project status.' });
    return;
  }

  const project = await Project.findOneAndUpdate(
    {
      _id: request.params.id,
      organizationId: request.user.organizationId
    },
    { status },
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
    action: 'status_changed',
    message: `Status changed to ${status} by ${request.user.name}`
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
  if (!['org_admin', 'manager'].includes(request.user.role)) {
    response.status(403).json({ error: 'Only admins and managers can create tasks.' });
    return;
  }

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
  const canManageTask = ['org_admin', 'manager'].includes(request.user.role);

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
      response.status(403).json({ error: 'Only admins and managers can reassign tasks.' });
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
  await ActivityLog.create(entry);
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

export default router;
