import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { apiRequest } from '../api.js';
import AppShell from '../components/AppShell.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';

const STATUS_OPTIONS = ['Pending', 'In Progress', 'Completed'];
const STATUS_PROGRESS = {
  Pending: 25,
  'In Progress': 60,
  Completed: 100
};
const DESCRIPTION_LIMIT = 300;
const DESCRIPTION_SUGGESTIONS = ['Web Development Project', 'Testing Phase', 'Deployment Task'];
const DATE_FORMATTER = new Intl.DateTimeFormat('en-GB');

const INITIAL_FORM = {
  name: '',
  description: '',
  status: 'Pending',
  startDate: '',
  endDate: '',
  memberIds: []
};

export default function Dashboard() {
  const { user } = useAuth();
  const { notify } = useNotifications();
  const isMember = user?.role === 'member';
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState('');
  const [form, setForm] = useState(INITIAL_FORM);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [projectScope, setProjectScope] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [error, setError] = useState('');

  const canCreate = user?.role === 'org_admin';
  const canChangeStatus = ['org_admin', 'manager'].includes(user?.role);
  const canDelete = user?.role === 'org_admin';
  const canEdit = user?.role === 'org_admin';

  async function loadProjects(overrides = {}) {
    try {
      const currentPage = overrides.page ?? page;
      const currentSearch = overrides.search ?? search;
      const currentStatusFilter = overrides.statusFilter ?? statusFilter;
      const currentScope = overrides.scope ?? projectScope;
      const currentSort = overrides.sort ?? sort;

      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: '5',
        sort: currentSort
      });

      if (currentSearch.trim()) {
        params.set('search', currentSearch.trim());
      }

      if (currentStatusFilter) {
        params.set('status', currentStatusFilter);
      }

      if (isMember || currentScope === 'my') {
        params.set('mine', '1');
      }

      const payload = await apiRequest(`/projects?${params.toString()}`);
      setProjects(payload.projects);
      setPagination(payload.pagination);
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  async function loadStats() {
    try {
      const payload = await apiRequest('/projects/stats');
      setStats(payload.stats);
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  async function loadUsers() {
    if (!canCreate) {
      return;
    }

    try {
      const payload = await apiRequest('/admin/users');
      setUsers(payload.users);
    } catch (loadError) {
      console.error('Failed to load organization users:', loadError);
    }
  }

  useEffect(() => {
    loadProjects();
  }, [page, search, statusFilter, projectScope, sort, isMember]);

  useEffect(() => {
    if (isMember) {
      setProjectScope('my');
    }
  }, [isMember]);

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    loadUsers();
  }, [canCreate]);

  function resetProjectForm() {
    setForm(INITIAL_FORM);
    setEditingProjectId('');
  }

  function beginEditProject(project) {
    setShowCreateForm(true);
    setEditingProjectId(project._id);
    setForm({
      name: project.name || '',
      description: project.description || '',
      status: project.status || 'Pending',
      startDate: project.startDate ? new Date(project.startDate).toISOString().slice(0, 10) : '',
      endDate: project.endDate ? new Date(project.endDate).toISOString().slice(0, 10) : '',
      memberIds: (project.memberIds || []).map((member) => member._id || member)
    });
    setError('');
  }

  function applyDescriptionSuggestion(suggestion) {
    setForm((current) => ({
      ...current,
      description: suggestion.slice(0, DESCRIPTION_LIMIT)
    }));
  }

  function upsertProject(nextProject) {
    setProjects((current) => {
      const existingIndex = current.findIndex((project) => project._id === nextProject._id);
      if (existingIndex === -1) {
        return [nextProject, ...current];
      }

      const nextList = [...current];
      nextList[existingIndex] = nextProject;
      return nextList;
    });
  }

  function removeProject(projectId) {
    setProjects((current) => current.filter((project) => project._id !== projectId));
  }

  async function submitProject(event) {
    event.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('Project name is required.');
      return;
    }

    if (form.description.length > DESCRIPTION_LIMIT) {
      setError(`Description cannot exceed ${DESCRIPTION_LIMIT} characters.`);
      return;
    }

    if (form.startDate && form.endDate && new Date(form.startDate) > new Date(form.endDate)) {
      setError('Start date must be before or equal to end date.');
      return;
    }

    setIsSubmitting(true);

    const projectPayload = {
      name: form.name.trim(),
      description: form.description.trim(),
      status: form.status,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      memberIds: form.memberIds
    };

    try {
      if (editingProjectId) {
        const response = await apiRequest(`/projects/${editingProjectId}`, {
          method: 'PATCH',
          body: JSON.stringify(projectPayload)
        });
        upsertProject(response.project);
        notify('Project Updated Successfully');
      } else {
        const response = await apiRequest('/projects', {
          method: 'POST',
          body: JSON.stringify(projectPayload)
        });
        upsertProject(response.project);
        notify('Project Created Successfully');
      }

      resetProjectForm();
      setShowCreateForm(false);

      await loadStats();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function updateStatus(projectId, status) {
    try {
      const payload = await apiRequest(`/projects/${projectId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      upsertProject(payload.project);
      notify(`Status changed to ${status}`);
      await loadStats();
    } catch (updateError) {
      setError(updateError.message);
    }
  }

  async function deleteProject(projectId) {
    try {
      await apiRequest(`/projects/${projectId}`, { method: 'DELETE' });
      removeProject(projectId);
      notify('Project deleted');
      await loadStats();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  function getMembers(project) {
    return (project.memberIds || []).filter((member) => typeof member === 'object' && member !== null);
  }

  function getMemberInitials(name = '') {
    const parts = String(name)
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);

    if (!parts.length) {
      return 'U';
    }

    return parts.map((part) => part[0]?.toUpperCase() || '').join('');
  }

  function formatDate(value) {
    if (!value) {
      return '—';
    }

    return DATE_FORMATTER.format(new Date(value));
  }

  function getProjectProgress(status) {
    return STATUS_PROGRESS[status] || 0;
  }

  async function quickUpdateStatus(project) {
    const currentIndex = STATUS_OPTIONS.indexOf(project.status);
    const nextStatus = STATUS_OPTIONS[(currentIndex + 1) % STATUS_OPTIONS.length];
    await updateStatus(project._id, nextStatus);
  }

  return (
    <AppShell>
      <section className="card page-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Projects Dashboard</h1>
          <p className="muted">Dashboard is role-based and shows personalized data for each user.</p>
        </div>
        {canCreate && (
          <button
            className="toggle-btn"
            onClick={() => {
              if (showCreateForm) {
                resetProjectForm();
              }
              setShowCreateForm((current) => !current);
            }}
          >
            {showCreateForm ? 'Hide Create Project' : 'Create Project'}
          </button>
        )}
      </section>

      {stats && (
        <section className="stats-grid">
          <article className="card stat-card">
            <span>Total projects</span>
            <strong>{stats.totalProjects}</strong>
          </article>
          <article className="card stat-card stat-completed">
            <span>Completed</span>
            <strong>{stats.completedProjects}</strong>
          </article>
          <article className="card stat-card stat-progress">
            <span>In Progress</span>
            <strong>{stats.inProgressProjects}</strong>
          </article>
          <article className="card stat-card stat-pending">
            <span>Pending</span>
            <strong>{stats.pendingProjects}</strong>
          </article>
        </section>
      )}

      {canCreate && showCreateForm && (
        <section className="card">
          <h2>{editingProjectId ? 'Edit Project' : 'Create Project'}</h2>
          <form className="form" onSubmit={submitProject}>
            <div className="form-grid">
              <label>
                Project Name
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  required
                />
              </label>

              <label>
                Status
                <select
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Start Date
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
                />
              </label>

              <label>
                End Date
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
                />
              </label>
            </div>

            <label>
              Description
              <textarea
                value={form.description}
                maxLength={DESCRIPTION_LIMIT}
                placeholder="Enter project goal, tasks, and expected outcome..."
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              />
              <div className="description-meta">
                <span className="muted">{form.description.length} / {DESCRIPTION_LIMIT} characters</span>
              </div>
            </label>

            <div className="suggestion-row">
              {DESCRIPTION_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="suggestion-chip"
                  onClick={() => applyDescriptionSuggestion(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <label>
              Assign Members
              <select
                multiple
                value={form.memberIds}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    memberIds: [...event.target.selectedOptions].map((option) => option.value)
                  }))
                }
              >
                {users.map((member) => (
                  <option key={member._id} value={member._id}>
                    {member.name} ({member.role})
                  </option>
                ))}
              </select>
            </label>

            <div className="form-actions">
              {editingProjectId && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => {
                    resetProjectForm();
                    setShowCreateForm(false);
                  }}
                >
                  Cancel
                </button>
              )}
              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (editingProjectId ? 'Saving...' : 'Creating...') : editingProjectId ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section id="projects" className="card">
        <div className="toolbar">
          <div>
            <h2>{isMember ? 'My Projects' : 'Projects in your organization'}</h2>
            <p className="muted">Search and filter projects by status, scope, and sort order.</p>
          </div>
          <div className="toolbar-controls">
            {canCreate && (
              <button
                onClick={() => {
                  resetProjectForm();
                  setShowCreateForm(true);
                }}
              >
                New Project
              </button>
            )}
            <input
              placeholder="🔍 Search projects by name..."
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
            />
            {search && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setPage(1);
                  setSearch('');
                }}
              >
                ❌ Clear
              </button>
            )}
            {!isMember && (
              <select
                value={projectScope}
                onChange={(event) => {
                  setPage(1);
                  setProjectScope(event.target.value);
                }}
              >
                <option value="all">All Projects</option>
                <option value="my">My Projects</option>
              </select>
            )}
            <select
              value={statusFilter}
              onChange={(event) => {
                setPage(1);
                setStatusFilter(event.target.value);
              }}
            >
              <option value="">All statuses</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="updated">Recently updated</option>
              <option value="name">Name</option>
            </select>
          </div>
        </div>

        {error && <p className="error">{error}</p>}
        {!projects.length && (
          <div className="empty-state">
            <p className="empty-state-title">📭 {isMember ? 'No projects assigned to you yet' : 'No projects yet'}</p>
            <p className="muted">
              {isMember
                ? 'Your assigned projects will appear here once you are added as a member.'
                : 'Create your first project to get started!'}
            </p>
          </div>
        )}

        <div className="table-wrapper">
          <table className="project-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Start</th>
                <th>End</th>
                <th>Last Updated</th>
                <th>Members</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project._id}>
                  <td>
                    <Link className="project-link project-name" to={`/projects/${project._id}`}>
                      {project.name}
                    </Link>
                    <p className="table-subtext">{project.description || 'No description'}</p>
                  </td>
                  <td>
                    <StatusBadge status={project.status} />
                  </td>
                  <td>
                    <div className="progress-bar" aria-label="Project progress">
                      <div className="progress-fill" style={{ width: `${getProjectProgress(project.status)}%` }} />
                    </div>
                    <p className="table-subtext">{getProjectProgress(project.status)}%</p>
                  </td>
                  <td>{formatDate(project.startDate)}</td>
                  <td>{formatDate(project.endDate)}</td>
                  <td>{formatDate(project.updatedAt)}</td>
                  <td>
                    <div className="member-cell">
                      <div className="member-pill-list">
                        {getMembers(project)
                          .slice(0, 3)
                          .map((member) => (
                            <span key={member._id} className="member-mini-avatar" title={member.name}>
                              {getMemberInitials(member.name)}
                            </span>
                          ))}
                      </div>
                      <p className="table-subtext">👤 {project.memberIds?.length || 0} members</p>
                    </div>
                  </td>
                  <td>
                    <div className="project-actions">
                      <Link className="secondary-button quick-action-link" to={`/projects/${project._id}`}>
                        View
                      </Link>
                      {canEdit && <button onClick={() => beginEditProject(project)}>Edit</button>}
                      {canChangeStatus && (
                        <button onClick={() => quickUpdateStatus(project)}>Update Status</button>
                      )}
                      {canDelete && <button onClick={() => deleteProject(project._id)}>Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pagination-row">
          <button disabled={pagination.page <= 1} onClick={() => setPage((current) => current - 1)}>
            Previous
          </button>
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button disabled={pagination.page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}>
            Next
          </button>
        </div>
      </section>
    </AppShell>
  );
}
