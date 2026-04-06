import { useEffect, useMemo, useState } from 'react';

import { apiRequest } from '../api.js';
import AppShell from '../components/AppShell.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';

const INITIAL_USER_FORM = {
  name: '',
  email: '',
  password: '',
  role: 'member'
};

const INITIAL_PERSONAL_SETTINGS = {
  emailNotifications: true,
  projectUpdates: true,
  defaultProjectView: 'list',
  sortPreference: 'newest',
  theme: 'light'
};

const INITIAL_ORG_SETTINGS = {
  name: '',
  passwordMinLength: 8,
  sessionTimeoutMinutes: 60,
  theme: 'light'
};

export default function SettingsPage() {
  const { user, updateUser, refreshUser } = useAuth();
  const { notify } = useNotifications();
  const isAdmin = user?.role === 'org_admin';
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [organization, setOrganization] = useState(null);
  const [users, setUsers] = useState([]);
  const [newUserForm, setNewUserForm] = useState(INITIAL_USER_FORM);
  const [passwordResetByUserId, setPasswordResetByUserId] = useState({});
  const [personalSettings, setPersonalSettings] = useState(INITIAL_PERSONAL_SETTINGS);
  const [orgSettings, setOrgSettings] = useState(INITIAL_ORG_SETTINGS);

  useEffect(() => {
    setPersonalSettings({
      emailNotifications: user?.preferences?.emailNotifications ?? true,
      projectUpdates: user?.preferences?.projectUpdates ?? true,
      defaultProjectView: user?.preferences?.defaultProjectView ?? 'list',
      sortPreference: user?.preferences?.sortPreference ?? 'newest',
      theme: user?.preferences?.theme ?? 'light'
    });
  }, [user]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    async function loadAdminSettings() {
      setLoading(true);
      try {
        const [organizationPayload, usersPayload] = await Promise.all([
          apiRequest('/admin/organization'),
          apiRequest('/admin/users')
        ]);

        setOrganization(organizationPayload.organization);
        setUsers(usersPayload.users || []);
        setOrgSettings({
          name: organizationPayload.organization?.name || '',
          passwordMinLength: organizationPayload.organization?.settings?.passwordMinLength ?? 8,
          sessionTimeoutMinutes: organizationPayload.organization?.settings?.sessionTimeoutMinutes ?? 60,
          theme: organizationPayload.organization?.settings?.theme ?? 'light'
        });
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    }

    loadAdminSettings();
  }, [isAdmin]);

  const sidebarItems = useMemo(() => {
    const baseItems = [
      { label: 'Profile', href: '#profile' },
      { label: 'Security', href: '#security' },
      { label: 'Notifications', href: '#notifications' },
      { label: 'Preferences', href: '#preferences' }
    ];

    if (isAdmin) {
      baseItems.push(
        { label: 'Users', href: '#users' },
        { label: 'Organization', href: '#organization' },
        { label: 'Projects', href: '#project-controls' },
        { label: 'Security Settings', href: '#security-settings' }
      );
    }

    return baseItems;
  }, [isAdmin]);

  async function savePersonalSettings(event) {
    event.preventDefault();
    setError('');

    try {
      const payload = await apiRequest('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ preferences: personalSettings })
      });

      updateUser(payload.user);
      notify('Personal settings saved');
      await refreshUser();
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  async function saveOrganization(event) {
    event.preventDefault();
    setError('');

    try {
      const payload = await apiRequest('/admin/organization', {
        method: 'PATCH',
        body: JSON.stringify({
          name: orgSettings.name,
          settings: {
            passwordMinLength: orgSettings.passwordMinLength,
            sessionTimeoutMinutes: orgSettings.sessionTimeoutMinutes,
            theme: orgSettings.theme
          }
        })
      });

      setOrganization(payload.organization);
      updateUser({ organizationName: payload.organization.name });
      notify('Organization settings saved');
      await refreshUser();
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  async function addUser(event) {
    event.preventDefault();
    setError('');

    try {
      await apiRequest('/admin/users', {
        method: 'POST',
        body: JSON.stringify(newUserForm)
      });
      setNewUserForm(INITIAL_USER_FORM);
      notify('User added to organization');
      await refreshUsers();
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  async function refreshUsers() {
    const payload = await apiRequest('/admin/users');
    setUsers(payload.users || []);
  }

  async function changeRole(userId, role) {
    try {
      await apiRequest(`/admin/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role })
      });
      notify(`User role changed to ${role}`);
      await refreshUsers();
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  async function toggleStatus(userId, isActive) {
    try {
      await apiRequest(`/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive })
      });
      notify(isActive ? 'User activated' : 'User deactivated');
      await refreshUsers();
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  async function resetPassword(userId) {
    const password = passwordResetByUserId[userId] || '';
    if (password.length < 8) {
      setError('Reset password must be at least 8 characters long.');
      return;
    }

    try {
      await apiRequest(`/admin/users/${userId}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password })
      });
      setPasswordResetByUserId((current) => ({ ...current, [userId]: '' }));
      notify('Password reset');
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  return (
    <AppShell>
      <section className="card page-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>{isAdmin ? 'Admin Settings' : 'User Settings'}</h1>
          <p className="muted">
            {isAdmin
              ? 'Admin has full control over tenant users and roles.'
              : 'Role-based access ensures security and proper permission control.'}
          </p>
        </div>
      </section>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Loading settings...</p>}

      <section className="profile-layout settings-layout">
        <aside className="card settings-sidebar">
          <h2>Settings</h2>
          <div className="settings-divider" />
          <nav className="settings-nav">
            {sidebarItems.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        <div className="settings-content">
          <section className="card settings-panel" id="profile">
            <p className="eyebrow">Personal Settings</p>
            <h2>Basic Account Setup</h2>
            <form className="form settings-form" onSubmit={savePersonalSettings}>
              <div className="form-grid">
                <label>
                  Name
                  <input value={user?.name || ''} disabled />
                </label>
                <label>
                  Email
                  <input value={user?.email || ''} disabled />
                </label>
                <label>
                  Role
                  <input value={formatRole(user?.role)} disabled />
                </label>
              </div>
              <div className="note-box muted">
                Company: <strong>{user?.organizationName || user?.organizationSlug || 'Organization'}</strong>
                <br />
                Update your name and password from the Profile page. This section focuses on role-based preferences.
              </div>
            </form>
          </section>

          <section className="card settings-panel" id="security">
            <p className="eyebrow">Security</p>
            <h2>Security Quick Notes</h2>
            <div className="bullet-grid">
              <div className="summary-box">
                <strong>Change password</strong>
                <span className="muted">Available on the Profile page for all users.</span>
              </div>
              <div className="summary-box">
                <strong>Last login</strong>
                <span className="muted">Shown in Profile for visibility and audit awareness.</span>
              </div>
              <div className="summary-box">
                <strong>Session timeout</strong>
                <span className="muted">Admin can define the tenant timeout policy below.</span>
              </div>
            </div>
          </section>

          {!isAdmin && (
            <>
              <section className="card settings-panel" id="notifications">
                <p className="eyebrow">Notifications</p>
                <h2>Email Preferences</h2>
                <form className="form settings-form" onSubmit={savePersonalSettings}>
                  <label className="checkbox-row checkbox-row-card">
                    <input
                      type="checkbox"
                      checked={personalSettings.emailNotifications}
                      onChange={(event) =>
                        setPersonalSettings((current) => ({ ...current, emailNotifications: event.target.checked }))
                      }
                    />
                    <span>Email notifications</span>
                  </label>
                  <label className="checkbox-row checkbox-row-card">
                    <input
                      type="checkbox"
                      checked={personalSettings.projectUpdates}
                      onChange={(event) =>
                        setPersonalSettings((current) => ({ ...current, projectUpdates: event.target.checked }))
                      }
                    />
                    <span>Project updates</span>
                  </label>
                  <div className="form-actions">
                    <button type="submit">Save Notifications</button>
                  </div>
                </form>
              </section>

              <section className="card settings-panel" id="preferences">
                <p className="eyebrow">Preferences</p>
                <h2>My Preferences</h2>
                <form className="form settings-form" onSubmit={savePersonalSettings}>
                  <div className="form-grid">
                    <label>
                      Default project view
                      <select
                        value={personalSettings.defaultProjectView}
                        onChange={(event) =>
                          setPersonalSettings((current) => ({ ...current, defaultProjectView: event.target.value }))
                        }
                      >
                        <option value="list">List</option>
                        <option value="card">Card</option>
                      </select>
                    </label>
                    <label>
                      Sort preference
                      <select
                        value={personalSettings.sortPreference}
                        onChange={(event) =>
                          setPersonalSettings((current) => ({ ...current, sortPreference: event.target.value }))
                        }
                      >
                        <option value="newest">Newest</option>
                        <option value="oldest">Oldest</option>
                        <option value="updated">Recently updated</option>
                        <option value="name">Name</option>
                      </select>
                    </label>
                    <label>
                      Theme
                      <select
                        value={personalSettings.theme}
                        onChange={(event) =>
                          setPersonalSettings((current) => ({ ...current, theme: event.target.value }))
                        }
                      >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                      </select>
                    </label>
                  </div>
                  <div className="form-actions">
                    <button type="submit">Save Preferences</button>
                  </div>
                </form>
              </section>
            </>
          )}

          {isAdmin && (
            <>
              <section className="card settings-panel" id="organization">
                <p className="eyebrow">Admin Settings</p>
                <h2>Organization Settings</h2>
                <form className="form settings-form" onSubmit={saveOrganization}>
                  <div className="form-grid">
                    <label>
                      Organization Name
                      <input
                        value={orgSettings.name}
                        onChange={(event) => setOrgSettings((current) => ({ ...current, name: event.target.value }))}
                        required
                      />
                    </label>
                    <label>
                      Theme
                      <select
                        value={orgSettings.theme}
                        onChange={(event) => setOrgSettings((current) => ({ ...current, theme: event.target.value }))}
                      >
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                      </select>
                    </label>
                    <label>
                      Password Min Length
                      <input
                        type="number"
                        min="6"
                        value={orgSettings.passwordMinLength}
                        onChange={(event) =>
                          setOrgSettings((current) => ({ ...current, passwordMinLength: event.target.value }))
                        }
                      />
                    </label>
                    <label>
                      Session Timeout (minutes)
                      <input
                        type="number"
                        min="15"
                        value={orgSettings.sessionTimeoutMinutes}
                        onChange={(event) =>
                          setOrgSettings((current) => ({ ...current, sessionTimeoutMinutes: event.target.value }))
                        }
                      />
                    </label>
                  </div>
                  <div className="form-actions">
                    <button type="submit">Save Organization</button>
                  </div>
                </form>
              </section>

              <section className="card settings-panel" id="users">
                <p className="eyebrow">User Management</p>
                <h2>View, Activate, Deactivate, and Reset Users</h2>
                <form className="form settings-form" onSubmit={addUser}>
                  <div className="form-grid">
                    <label>
                      Name
                      <input
                        value={newUserForm.name}
                        onChange={(event) => setNewUserForm((current) => ({ ...current, name: event.target.value }))}
                        required
                      />
                    </label>
                    <label>
                      Email
                      <input
                        type="email"
                        value={newUserForm.email}
                        onChange={(event) => setNewUserForm((current) => ({ ...current, email: event.target.value }))}
                        required
                      />
                    </label>
                    <label>
                      Password
                      <input
                        type="password"
                        value={newUserForm.password}
                        onChange={(event) => setNewUserForm((current) => ({ ...current, password: event.target.value }))}
                        required
                      />
                    </label>
                    <label>
                      Role
                      <select
                        value={newUserForm.role}
                        onChange={(event) => setNewUserForm((current) => ({ ...current, role: event.target.value }))}
                      >
                        <option value="member">member</option>
                        <option value="manager">manager</option>
                        <option value="org_admin">admin</option>
                      </select>
                    </label>
                  </div>
                  <div className="form-actions">
                    <button type="submit">Add User</button>
                  </div>
                </form>

                <div className="stack-list">
                  {users.map((member) => (
                    <article key={member._id} className="user-row settings-user-row">
                      <div>
                        <strong>{member.name}</strong>
                        <p className="muted">{member.email}</p>
                        <p className="muted">
                          Role: {member.role} · {member.isActive ? 'Active' : 'Inactive'}
                        </p>
                        <p className="muted">
                          Last login: {member.lastLogin ? new Date(member.lastLogin).toLocaleString() : 'Never'}
                        </p>
                      </div>

                      <div className="settings-actions-grid">
                        <select value={member.role} onChange={(event) => changeRole(member._id, event.target.value)}>
                          <option value="member">member</option>
                          <option value="manager">manager</option>
                          <option value="org_admin">admin</option>
                        </select>
                        <button type="button" onClick={() => toggleStatus(member._id, !member.isActive)}>
                          {member.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <input
                          type="password"
                          placeholder="Reset password"
                          value={passwordResetByUserId[member._id] || ''}
                          onChange={(event) =>
                            setPasswordResetByUserId((current) => ({ ...current, [member._id]: event.target.value }))
                          }
                        />
                        <button type="button" onClick={() => resetPassword(member._id)}>
                          Reset Password
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="card settings-panel" id="project-controls">
                <p className="eyebrow">Project Controls</p>
                <h2>Tenant-Wide Project Administration</h2>
                <div className="bullet-grid">
                  <div className="summary-box">
                    <strong>View all projects</strong>
                    <span className="muted">The dashboard already exposes all organization projects for admins.</span>
                  </div>
                  <div className="summary-box">
                    <strong>Delete any project</strong>
                    <span className="muted">Delete actions are available in the admin dashboard workflow.</span>
                  </div>
                  <div className="summary-box">
                    <strong>Assign members</strong>
                    <span className="muted">Project creation and edit flows support member assignment.</span>
                  </div>
                </div>
              </section>

              <section className="card settings-panel" id="security-settings">
                <p className="eyebrow">Security Settings</p>
                <h2>Policy Controls</h2>
                <div className="bullet-grid">
                  <div className="summary-box">
                    <strong>Password policy</strong>
                    <span className="muted">Minimum length is configurable at the organization level.</span>
                  </div>
                  <div className="summary-box">
                    <strong>Session timeout</strong>
                    <span className="muted">Admin can define the timeout policy for the tenant.</span>
                  </div>
                  <div className="summary-box">
                    <strong>Theme</strong>
                    <span className="muted">Light and dark mode are available as a bonus customization.</span>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function formatRole(role) {
  if (role === 'org_admin') return 'admin';
  return role || 'user';
}
