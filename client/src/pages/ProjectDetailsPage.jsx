import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { apiRequest } from '../api.js';
import AppShell from '../components/AppShell.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';

const STATUS_OPTIONS = ['Pending', 'In Progress', 'Completed'];

export default function ProjectDetailsPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { notify } = useNotifications();
  const [project, setProject] = useState(null);
  const [activity, setActivity] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    assigneeId: '',
    status: 'Pending'
  });
  const [error, setError] = useState('');

  const canManageMembers = user?.role === 'org_admin';
  const canChangeStatus = ['org_admin', 'manager'].includes(user?.role);
  const canCreateTasks = ['org_admin', 'manager'].includes(user?.role);

  async function loadProject() {
    try {
      const payload = await apiRequest(`/projects/${id}`);
      setProject(payload.project);
      setActivity(payload.activity);
      setTasks(payload.tasks || []);
      setAssignableUsers(payload.assignableUsers || []);
      setSelectedMembers((payload.project.memberIds || []).map((member) => member._id));
      setTaskForm((current) => ({
        ...current,
        assigneeId: current.assigneeId || payload.assignableUsers?.[0]?._id || ''
      }));
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => {
    loadProject();
  }, [id]);

  async function updateStatus(nextStatus) {
    try {
      await apiRequest(`/projects/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus })
      });
      notify(`Project status changed to ${nextStatus}`);
      await loadProject();
    } catch (saveError) {
      setError(saveError.message);
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

  if (!project) {
    return (
      <AppShell>
        <section className="card">
          <p>{error || 'Loading project...'}</p>
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
        <Link to="/">Back to dashboard</Link>
      </section>

      {error && <p className="error">{error}</p>}

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
      </section>

      <section className="card">
        <h2>Team Members</h2>
        {!project.memberIds?.length && <p className="muted">No members assigned yet.</p>}
        <ul>
          {(project.memberIds || []).map((member) => (
            <li key={member._id}>
              {member.name} ({member.email}) - {member.role}
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

      <section className="card">
        <div className="toolbar">
          <h2>Tasks</h2>
          <span className="muted">Assign work to members, managers, or admins in this project workspace.</span>
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
            const canEditTask = canCreateTasks || task.assigneeId?._id === user?.id;
            const canReassignTask = canCreateTasks;

            return (
              <article key={task._id} className="task-card">
                <div className="project-card-top">
                  <div>
                    <strong>{task.title}</strong>
                    <p className="muted">{task.description || 'No task description provided.'}</p>
                  </div>
                  <StatusBadge status={task.status} />
                </div>

                <div className="project-meta">
                  <span>Assigned to {task.assigneeId?.name || 'Unknown user'}</span>
                  <span>Created by {task.createdById?.name || 'Unknown user'}</span>
                </div>

                <div className="task-actions">
                  {canEditTask && (
                    <select value={task.status} onChange={(event) => updateTask(task._id, { status: event.target.value })}>
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  )}
                  {canReassignTask && (
                    <select
                      value={task.assigneeId?._id || ''}
                      onChange={(event) => updateTask(task._id, { assigneeId: event.target.value })}
                    >
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
        <ul>
          {activity.map((item) => (
            <li key={item._id}>
              <strong>{item.actorName}</strong>: {item.message}
              <span className="muted"> ({new Date(item.createdAt).toLocaleString()})</span>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
