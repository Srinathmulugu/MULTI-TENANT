import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { apiRequest } from '../api.js';
import AppShell from '../components/AppShell.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';

const STATUS_OPTIONS = ['Pending', 'In Progress', 'Completed'];
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
const MAX_COMMENT_LENGTH = 280;
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const INITIAL_TASK_FORM = {
  title: '',
  description: '',
  assigneeId: '',
  status: 'Pending'
};

const INITIAL_SUBMISSION_FORM = {
  note: '',
  versionLabel: ''
};

export default function ProjectDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { notify } = useNotifications();
  const [project, setProject] = useState(null);
  const [activity, setActivity] = useState([]);
  const [comments, setComments] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [taskForm, setTaskForm] = useState(INITIAL_TASK_FORM);
  const [commentText, setCommentText] = useState('');
  const [progressValue, setProgressValue] = useState(0);
  const [submissionForm, setSubmissionForm] = useState(INITIAL_SUBMISSION_FORM);
  const [submissionFile, setSubmissionFile] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [error, setError] = useState('');

  const currentUserId = user?.userId || user?.id;
  const isProjectOwner = Boolean(project && currentUserId && (project.ownerId?._id || project.ownerId) === currentUserId);
  const isProjectMember = Boolean(
    project &&
      currentUserId &&
      (project.memberIds || []).some((member) => String(member._id || member) === String(currentUserId))
  );
  const canManageMembers = user?.role === 'org_admin';
  const canReviewSubmission = ['org_admin', 'manager'].includes(user?.role);
  const canChangeStatus = canReviewSubmission;
  const canCreateTasks = ['org_admin', 'manager'].includes(user?.role) || isProjectOwner;
  const canWorkOnProject = canReviewSubmission || isProjectOwner || isProjectMember;
  const canSubmitProject = canWorkOnProject;
  const progress = calculateProjectProgress(project, tasks);

  async function loadProject() {
    try {
      const payload = await apiRequest(`/projects/${id}`);
      setProject(payload.project);
      setActivity(payload.activity);
      setComments(payload.comments || []);
      setTasks(payload.tasks || []);
      setAssignableUsers(payload.assignableUsers || []);
      setSelectedMembers((payload.project.memberIds || []).map((member) => member._id));
      setProgressValue(payload.project.progressPercentage ?? calculateProjectProgress(payload.project, payload.tasks || []).percentage ?? 0);
      setSubmissionForm((current) => ({
        ...current,
        versionLabel: payload.project.submissionVersion ? `v${payload.project.submissionVersion + 1}` : 'v1'
      }));
      setTaskForm((current) => ({
        ...current,
        assigneeId: current.assigneeId || payload.assignableUsers?.[0]?._id || ''
      }));
      setReviewNote(payload.project.submissionReviewNote || '');
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => {
    loadProject();
  }, [id]);

  async function updateStatus(nextStatus) {
    try {
      const payload = await apiRequest(`/projects/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus })
      });
      notify(`Project status changed to ${nextStatus}`);
      setProject(payload.project);
      await loadProject();
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  async function updateProgress() {
    try {
      const payload = await apiRequest(`/projects/${id}/progress`, {
        method: 'PATCH',
        body: JSON.stringify({ progressPercentage: progressValue })
      });
      notify(`Progress updated to ${progressValue}%`);
      setProject(payload.project);
      await loadProject();
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  async function addComment(event) {
    event.preventDefault();

    const normalizedComment = commentText.trim();
    if (!normalizedComment) {
      setError('Comment cannot be empty.');
      return;
    }

    try {
      await apiRequest(`/projects/${id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ message: normalizedComment })
      });
      notify('Comment added');
      setCommentText('');
      await loadProject();
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  async function startProject() {
    await updateStatus('In Progress');
  }

  async function downloadProjectBundle() {
    try {
      const response = await fetch(`${API_BASE}/projects/${id}/download`, {
        headers: {
          ...(localStorage.getItem('mt_token') ? { Authorization: `Bearer ${localStorage.getItem('mt_token')}` } : {})
        }
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Unable to download project bundle.');
      }

      const blob = await response.blob();
      const link = document.createElement('a');
      const objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl;
      link.download = `${slugify(project?.name || 'project')}-bundle.zip`;
      link.click();
      URL.revokeObjectURL(objectUrl);
      notify('Project bundle downloaded');
    } catch (downloadError) {
      setError(downloadError.message);
    }
  }

  async function submitProject(event) {
    event.preventDefault();

    if (!submissionFile) {
      setError('Please select a project file to upload.');
      return;
    }

    if (submissionFile.size > MAX_UPLOAD_SIZE) {
      setError('File size exceeds 10 MB.');
      return;
    }

    const formData = new FormData();
    formData.append('file', submissionFile);
    formData.append('note', submissionForm.note);
    formData.append('versionLabel', submissionForm.versionLabel);

    try {
      await apiRequest(`/projects/${id}/submit`, {
        method: 'POST',
        body: formData
      });

      notify('Project submitted successfully');
      setSubmissionFile(null);
      setSubmissionForm(INITIAL_SUBMISSION_FORM);
      await loadProject();
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  async function reviewSubmission(submissionStatus) {
    try {
      await apiRequest(`/projects/${id}/submission/review`, {
        method: 'PATCH',
        body: JSON.stringify({ submissionStatus, reviewNote })
      });
      notify(`Submission ${submissionStatus.toLowerCase()}`);
      await loadProject();
    } catch (reviewError) {
      setError(reviewError.message);
    }
  }

  async function saveMembers() {
    try {
      await apiRequest(`/projects/${id}/members`, {
        method: 'PATCH',
        body: JSON.stringify({ memberIds: selectedMembers })
      });
      notify('Project members updated');
      await loadProject();
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  async function createTask(event) {
    event.preventDefault();
    setError('');

    try {
      await apiRequest(`/projects/${id}/tasks`, {
        method: 'POST',
        body: JSON.stringify(taskForm)
      });
      notify(`Task assigned to ${displayUserName(taskForm.assigneeId)}`);
      setTaskForm({
        title: '',
        description: '',
        assigneeId: assignableUsers[0]?._id || '',
        status: 'Pending'
      });
      await loadProject();
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  async function updateTask(taskId, changes) {
    try {
      await apiRequest(`/projects/${id}/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(changes)
      });
      if (changes.assigneeId) {
        notify(`Task reassigned to ${displayUserName(changes.assigneeId)}`);
      }
      if (changes.status) {
        notify(`Task status changed to ${changes.status}`);
      }
      await loadProject();
    } catch (updateError) {
      setError(updateError.message);
    }
  }

  const selectedMemberSet = useMemo(() => new Set(selectedMembers), [selectedMembers]);

  function displayUserName(userId) {
    return assignableUsers.find((candidate) => candidate._id === userId)?.name || 'selected user';
  }

  function reloadProject() {
    setError('');
    loadProject();
  }

  if (!project) {
    return (
      <AppShell>
        <section className="card project-state-card">
          <div className="project-state-body">
            <p className={error ? 'error' : 'muted'}>{error || 'Loading project...'}</p>
            {error && (
              <button className="secondary-button" onClick={reloadProject}>
                Retry
              </button>
            )}
          </div>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="card page-header">
        <div>
          <p className="eyebrow">Project Details</p>
          <h1>{project.name}</h1>
          <p className="muted">Created {new Date(project.createdAt).toLocaleString()}</p>
        </div>
        <div className="project-header-actions">
          <button className="secondary-button" type="button" onClick={downloadProjectBundle}>
            Download Project Bundle
          </button>
          <Link className="secondary-button" to="/">
            Back to dashboard
          </Link>
        </div>
      </section>

      {error && <p className="error">{error}</p>}

      <section className="card progress-panel">
        <div className="progress-panel-head">
          <div>
            <p className="eyebrow">Progress</p>
            <h2>{progress.percentage}% complete</h2>
          </div>
          <StatusBadge status={project.status} />
        </div>
        <div className="progress-track" aria-label="Project progress">
          <div className={`progress-fill progress-${progress.stateKey}`} style={{ width: `${progress.percentage}%` }} />
        </div>
        <div className="progress-meta">
          <span>{progress.label}</span>
          <span>{tasks.length} task(s)</span>
        </div>
        <div className="project-action-row">
          {canWorkOnProject && project.status === 'Pending' && (
            <button type="button" onClick={startProject}>
              Start Project
            </button>
          )}
          {canWorkOnProject && (
            <div className="project-progress-editor">
              <label>
                Progress %
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={progressValue}
                  onChange={(event) => setProgressValue(Number(event.target.value || 0))}
                />
              </label>
              <button type="button" onClick={updateProgress}>
                Update Progress
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="project-summary-grid">
        <article className="card summary-tile">
          <span className="summary-label">Status</span>
          <strong>{project.status}</strong>
        </article>
        <article className="card summary-tile">
          <span className="summary-label">Start Date</span>
          <strong>{project.startDate ? new Date(project.startDate).toLocaleDateString() : 'Not set'}</strong>
        </article>
        <article className="card summary-tile">
          <span className="summary-label">End Date</span>
          <strong>{project.endDate ? new Date(project.endDate).toLocaleDateString() : 'Not set'}</strong>
        </article>
        <article className="card summary-tile">
          <span className="summary-label">Members</span>
          <strong>{project.memberIds?.length || 0}</strong>
        </article>
      </section>

      <section className="card details-grid">
        <div>
          <h2>Description</h2>
          <p>{project.description || 'No description provided.'}</p>
        </div>
        <div>
          <h2>Status</h2>
          <StatusBadge status={project.status} />
          {canChangeStatus && (
            <select value={project.status} onChange={(event) => updateStatus(event.target.value)}>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <h2>Project Owner</h2>
          <div className="owner-card">
            <div className="owner-info">
              <strong>{project.ownerId?.name || 'Unknown'}</strong>
              <p className="owner-email">{project.ownerId?.email}</p>
              <p className="owner-role">{project.ownerId?.role}</p>
            </div>
            {isProjectOwner && (
              <div className="owner-badge">👤 You are the owner</div>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Team Members</h2>
        {!project.memberIds?.length && <p className="muted">No members assigned yet.</p>}
        <ul className="member-list">
          {(project.memberIds || []).map((member) => (
            <li key={member._id} className="member-list-item">
              <span className="member-avatar">{getInitials(member.name)}</span>
              <span>
                <strong>{member.name}</strong>
                <span className="member-meta">{member.email} · {member.role}</span>
              </span>
            </li>
          ))}
        </ul>

        {canManageMembers && (
          <div className="member-picker">
            <h3>Assign members</h3>
            <div className="member-grid">
              {assignableUsers.map((member) => (
                <label key={member._id} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={selectedMemberSet.has(member._id)}
                    onChange={() => {
                      setSelectedMembers((current) =>
                        current.includes(member._id)
                          ? current.filter((value) => value !== member._id)
                          : [...current, member._id]
                      );
                    }}
                  />
                  <span>
                    {member.name} ({member.role})
                  </span>
                </label>
              ))}
            </div>
            <button onClick={saveMembers}>Save Members</button>
          </div>
        )}
      </section>

      <section className="project-grid">
        <article className="card project-side-card">
          <p className="eyebrow">Open in VS Code</p>
          <h2>Practical workflow</h2>
          <p className="muted">Browser security prevents opening VS Code directly, so we provide a downloadable project bundle.</p>
          <ol className="instruction-list">
            <li>Download the project bundle.</li>
            <li>Open the folder in VS Code.</li>
            <li>Continue development and submit your work.</li>
          </ol>
          <button type="button" className="secondary-button" onClick={downloadProjectBundle}>
            Download Project Bundle
          </button>
        </article>

        <article className="card project-side-card">
          <p className="eyebrow">Submission Status</p>
          <h2>{project.submissionStatus || 'Not Submitted'}</h2>
          <StatusBadge status={project.submissionStatus || 'Not Submitted'} />
          <p className="muted">
            {project.submissionStatus === 'Approved'
              ? 'Your submission has been approved.'
              : project.submissionStatus === 'Rejected'
                ? 'Your submission needs changes.'
                : project.submissionStatus === 'Submitted'
                  ? 'Your submission is waiting for review.'
                  : 'No submission has been uploaded yet.'}
          </p>
          <div className="summary-line">
            <span>Version</span>
            <strong>{project.submissionVersion || 0}</strong>
          </div>
          <div className="summary-line">
            <span>Uploaded</span>
            <strong>{project.submissionSubmittedAt ? new Date(project.submissionSubmittedAt).toLocaleString() : 'Not available'}</strong>
          </div>
        </article>

        <article className="card project-side-card">
          <p className="eyebrow">Deadline Reminder</p>
          <h2>{project.endDate ? new Date(project.endDate).toLocaleDateString() : 'No deadline set'}</h2>
          <p className="muted">{getDeadlineHint(project.endDate)}</p>
        </article>
      </section>

      <section className="card">
        <div className="toolbar">
          <div>
            <p className="eyebrow">Submit Project</p>
            <h2>Upload your code or ZIP file</h2>
            <p className="muted">Use this for versioned uploads like v1, v2, and keep a note for the reviewer.</p>
          </div>
        </div>

        {canSubmitProject ? (
          <form className="form project-upload-form" onSubmit={submitProject}>
            <div className="form-grid">
              <label>
                Project file
                <input
                  type="file"
                  accept=".zip,.rar,.7z,.js,.jsx,.ts,.tsx,.py,.java,.json,.txt"
                  onChange={(event) => setSubmissionFile(event.target.files?.[0] || null)}
                  required
                />
              </label>
              <label>
                Version label
                <input
                  value={submissionForm.versionLabel}
                  onChange={(event) => setSubmissionForm((current) => ({ ...current, versionLabel: event.target.value }))}
                  placeholder="v1"
                />
              </label>
            </div>
            <label>
              Notes for reviewer
              <textarea
                maxLength={MAX_COMMENT_LENGTH}
                value={submissionForm.note}
                onChange={(event) => setSubmissionForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="Describe what you completed, what changed, or what needs review..."
              />
            </label>
            <div className="form-meta-row">
              <span className="muted">File size limit: 10 MB</span>
              <span className="muted">Uploaded file: {submissionFile?.name || 'none'}</span>
            </div>
            <div className="form-actions">
              <button type="submit">Submit Project</button>
            </div>
          </form>
        ) : (
          <p className="muted">Only assigned members and admins can submit project files.</p>
        )}

        {canReviewSubmission && project.submissionStatus !== 'Not Submitted' && (
          <div className="review-panel">
            <h3>Review Submission</h3>
            <label>
              Review note
              <textarea
                value={reviewNote}
                onChange={(event) => setReviewNote(event.target.value)}
                placeholder="Add approval or rejection feedback..."
              />
            </label>
            <div className="form-actions">
              <button type="button" onClick={() => reviewSubmission('Approved')}>
                Approve
              </button>
              <button type="button" className="secondary-button" onClick={() => reviewSubmission('Rejected')}>
                Reject
              </button>
            </div>
          </div>
        )}

        {project.submissionHistory?.length > 0 && (
          <div className="submission-history">
            <h3>Version History</h3>
            <ul className="activity-list">
              {project.submissionHistory.slice().reverse().map((entry) => (
                <li key={`${entry.version}-${entry.uploadedAt}`} className="activity-item">
                  <strong>v{entry.version}</strong>: {entry.originalName}
                  <span className="muted"> ({new Date(entry.uploadedAt).toLocaleString()})</span>
                  <p className="muted">{entry.note || 'No reviewer note'}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="card">
        <div className="toolbar">
          <div>
            <p className="eyebrow">Comments</p>
            <h2>Project notes</h2>
          </div>
        </div>

        <form className="form comment-form" onSubmit={addComment}>
          <label>
            Add a comment or note
            <textarea
              maxLength={MAX_COMMENT_LENGTH}
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              placeholder="Write a note like: Started working, deadline extended, waiting for review..."
            />
          </label>
          <div className="form-meta-row">
            <span className="muted">{commentText.length} / {MAX_COMMENT_LENGTH}</span>
          </div>
          <div className="form-actions">
            <button type="submit">Post Comment</button>
          </div>
        </form>

        {!comments.length && <p className="muted">No comments yet.</p>}
        <ul className="activity-list">
          {comments.map((item) => (
            <li key={item._id} className="activity-item">
              <strong>{item.actorName}</strong>: {item.message}
              <span className="muted"> ({new Date(item.createdAt).toLocaleString()})</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="toolbar">
          <h2>Tasks</h2>
          <span className="muted">
            {isProjectOwner 
              ? 'As project owner, assign work to members, managers, or admins.'
              : 'Assign work to members, managers, or admins in this project workspace.'
            }
          </span>
        </div>

        {canCreateTasks && (
          <form className="form task-form" onSubmit={createTask}>
            <label>
              Task title
              <input
                value={taskForm.title}
                onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))}
                required
              />
            </label>
            <label>
              Task description
              <textarea
                value={taskForm.description}
                onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))}
              />
            </label>
            <label>
              Assign to
              <select
                value={taskForm.assigneeId}
                onChange={(event) => setTaskForm((current) => ({ ...current, assigneeId: event.target.value }))}
                required
              >
                <option value="">Select assignee</option>
                {assignableUsers.map((candidate) => (
                  <option key={candidate._id} value={candidate._id}>
                    {candidate.name} ({candidate.role})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Starting status
              <select
                value={taskForm.status}
                onChange={(event) => setTaskForm((current) => ({ ...current, status: event.target.value }))}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">Create Task</button>
          </form>
        )}

        {!tasks.length && <p className="muted">No tasks added yet.</p>}
        <div className="stack-list">
          {tasks.map((task) => {
            const canEditTask = canCreateTasks || task.assigneeId?._id === currentUserId;
            const canReassignTask = canCreateTasks;
            const createdDate = new Date(task.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <article key={task._id} className="task-card">
                <div className="project-card-top">
                  <div>
                    <strong>{task.title}</strong>
                    {task.description && <p className="muted task-description">{task.description}</p>}
                  </div>
                  <StatusBadge status={task.status} />
                </div>

                <div className="task-info-grid">
                  <div className="task-info">
                    <span className="label">📋 Assigned to</span>
                    <span className="value">{task.assigneeId?.name || 'Unknown'}</span>
                    <span className="role">{task.assigneeId?.role}</span>
                  </div>
                  <div className="task-info">
                    <span className="label">👤 Assigned by</span>
                    <span className="value">{task.createdById?.name || 'Unknown'}</span>
                    <span className="role">{task.createdById?.role}</span>
                  </div>
                  <div className="task-info">
                    <span className="label">📅 Created</span>
                    <span className="value">{createdDate}</span>
                  </div>
                </div>

                <div className="task-progress-row">
                  <span className="task-progress-label">Task progress</span>
                  <div className="task-progress-track">
                    <div
                      className={`progress-fill progress-${statusToKey(task.status)}`}
                      style={{ width: `${taskStatusProgress(task.status)}%` }}
                    />
                  </div>
                  <span className="task-progress-value">{taskStatusProgress(task.status)}%</span>
                </div>

                <div className="task-actions">
                  {canEditTask && (
                    <select 
                      className="action-select"
                      title="Change task status"
                      value={task.status} 
                      onChange={(event) => updateTask(task._id, { status: event.target.value })}
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  )}
                  {canReassignTask && (
                    <select
                      className="action-select"
                      title="Reassign task to another user"
                      value={task.assigneeId?._id || ''}
                      onChange={(event) => updateTask(task._id, { assigneeId: event.target.value })}
                    >
                      <option value="" disabled>Reassign to...</option>
                      {assignableUsers.map((candidate) => (
                        <option key={candidate._id} value={candidate._id}>
                          {candidate.name} ({candidate.role})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2>Activity Log</h2>
        {!activity.length && <p className="muted">No activity yet.</p>}
        <ul className="activity-list">
          {activity.map((item) => (
            <li key={item._id} className="activity-item">
              <strong>{item.actorName}</strong>: {item.message}
              <span className="muted"> ({new Date(item.createdAt).toLocaleString()})</span>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}

function calculateProjectProgress(project, tasks) {
  if (project && typeof project.progressPercentage === 'number') {
    const percentage = Math.max(0, Math.min(100, project.progressPercentage));
    return {
      percentage,
      label: percentage === 100 ? 'Project marked as complete' : `Project progress is at ${percentage}%`,
      stateKey: percentage >= 100 ? 'completed' : percentage >= 50 ? 'progress' : 'pending'
    };
  }

  if (tasks?.length) {
    const completedTasks = tasks.filter((task) => task.status === 'Completed').length;
    const percentage = Math.round((completedTasks / tasks.length) * 100);
    return {
      percentage,
      label: `${completedTasks} of ${tasks.length} tasks completed`,
      stateKey: percentage >= 100 ? 'completed' : percentage >= 50 ? 'progress' : 'pending'
    };
  }

  const map = {
    Pending: { percentage: 25, label: 'Project is queued and waiting to start', stateKey: 'pending' },
    'In Progress': { percentage: 60, label: 'Work is actively in progress', stateKey: 'progress' },
    Completed: { percentage: 100, label: 'Project is finished', stateKey: 'completed' }
  };

  return map[project?.status] || map.Pending;
}

function taskStatusProgress(status) {
  const map = {
    Pending: 25,
    'In Progress': 60,
    Completed: 100
  };

  return map[status] || 0;
}

function statusToKey(status) {
  if (status === 'Completed') return 'completed';
  if (status === 'In Progress') return 'progress';
  return 'pending';
}

function getInitials(name) {
  return String(name || 'U')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function getDeadlineHint(endDate) {
  if (!endDate) {
    return 'Add a deadline to help the team stay on track.';
  }

  const end = new Date(endDate);
  const diffDays = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return 'This deadline has passed. Review the submission or extend the timeline.';
  }

  if (diffDays === 0) {
    return 'Deadline is today.';
  }

  if (diffDays <= 3) {
    return `${diffDays} day(s) left. A reminder should go out now.`;
  }

  return `${diffDays} day(s) left before the deadline.`;
}

function slugify(value) {
  return String(value || 'project')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
