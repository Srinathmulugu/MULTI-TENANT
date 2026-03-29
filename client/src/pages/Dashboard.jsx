import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { apiRequest } from '../api.js';
import AppShell from '../components/AppShell.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';

const STATUS_OPTIONS = ['Pending', 'In Progress', 'Completed'];

export default function Dashboard() {
  const { user } = useAuth();
  const { notify } = useNotifications();
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [memberIds, setMemberIds] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [error, setError] = useState('');

  const canCreate = user?.role === 'org_admin';
  const canChangeStatus = ['org_admin', 'manager'].includes(user?.role);
  const canDelete = user?.role === 'org_admin';

  async function loadProjects() {
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '5',
        sort
      });

      if (search.trim()) {
        params.set('search', search.trim());
      }

      if (statusFilter) {
        params.set('status', statusFilter);
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
      setError(loadError.message);
    }
  }

  useEffect(() => {
    loadProjects();
  }, [page, search, statusFilter, sort]);

  useEffect(() => {
    if (!projects.length) {
      setShowCreateForm(true);
    }
  }, [projects.length]);

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    loadUsers();
  }, [canCreate]);

  async function createProject(event) {
    event.preventDefault();
    setError('');

    try {
      await apiRequest('/projects', {
        method: 'POST',
        body: JSON.stringify({ name, description, memberIds })
      });
      setName('');
      setDescription('');
      setMemberIds([]);
      setShowCreateForm(false);
      notify('New project added');
      await loadProjects();
      await loadStats();
    } catch (createError) {
      setError(createError.message);
    }
  }

  async function updateStatus(projectId, status) {
    try {
      await apiRequest(`/projects/${projectId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      notify(`Status changed to ${status}`);
      await loadProjects();
      await loadStats();
    } catch (updateError) {
      setError(updateError.message);
    }
  }

  async function deleteProject(projectId) {
    try {
      await apiRequest(`/projects/${projectId}`, { method: 'DELETE' });
      notify('Project deleted');
      await loadProjects();
      await loadStats();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  return (
    <AppShell>
      <section className="card page-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1>Projects Dashboard</h1>
          <p className="muted">Track workflow, members, and role-based actions inside your organization.</p>
        </div>
        {canCreate && (
          <button onClick={() => setShowCreateForm((current) => !current)}>
            {showCreateForm ? 'Hide Create Project' : 'New Project'}
          </button>
        )}
      </section>

      {stats && (
        <section className="stats-grid">
          <article className="card stat-card">
            <span>Total projects</span>
            <strong>{stats.totalProjects}</strong>
          </article>
          <article className="card stat-card">
            <span>Completed</span>
            <strong>{stats.completedProjects}</strong>
          </article>
          <article className="card stat-card">
            <span>In Progress</span>
            <strong>{stats.inProgressProjects}</strong>
          </article>
          <article className="card stat-card">
            <span>Pending</span>
            <strong>{stats.pendingProjects}</strong>
          </article>
        </section>
      )}

      {canCreate && showCreateForm && (
        <section className="card">
          <h2>Create Project</h2>
          <form className="form" onSubmit={createProject}>
            <label>
              Name
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label>
              Description
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
            <label>
              Assign members
              <select
                multiple
                value={memberIds}
                onChange={(event) => setMemberIds([...event.target.selectedOptions].map((option) => option.value))}
              >
                {users.map((member) => (
                  <option key={member._id} value={member._id}>
                    {member.name} ({member.role})
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">Create</button>
          </form>
        </section>
      )}

      <section className="card">
        <div className="toolbar">
          <h2>Projects in your organization</h2>
          <div className="toolbar-controls">
            {canCreate && (
              <button onClick={() => setShowCreateForm(true)}>
                New Project
              </button>
            )}
            <input
              placeholder="Search by project name"
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
            />
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
        {!projects.length && <p className="muted">No projects match the current filters.</p>}

        <div className="project-list">
          {projects.map((project) => (
            <article key={project._id} className="project-card card">
              <div className="project-card-top">
                <div>
                  <Link className="project-link" to={`/projects/${project._id}`}>
                    {project.name}
                  </Link>
                  <p className="muted">{project.description || 'No description'}</p>
                </div>
                <StatusBadge status={project.status} />
              </div>

              <div className="project-meta">
                <span>{project.memberIds?.length || 0} member(s)</span>
                <span>Created {new Date(project.createdAt).toLocaleDateString()}</span>
              </div>

              <div className="project-actions">
                {canChangeStatus && (
                  <select value={project.status} onChange={(event) => updateStatus(project._id, event.target.value)}>
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                )}
                {canDelete && <button onClick={() => deleteProject(project._id)}>Delete</button>}
              </div>
            </article>
          ))}
        </div>

        <div className="pagination-row">
          <button disabled={pagination.page <= 1} onClick={() => setPage((current) => current - 1)}>
            Previous
          </button>
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </button>
        </div>
      </section>
    </AppShell>
  );
}
