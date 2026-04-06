import { useEffect, useState } from 'react';

import { apiRequest } from '../api.js';
import AppShell from '../components/AppShell.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';

const INITIAL_FORM = {
  name: '',
  avatarUrl: ''
};

const INITIAL_PASSWORD_FORM = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
};

export default function ProfilePage() {
  const { user, updateUser, refreshUser } = useAuth();
  const { notify } = useNotifications();
  const [profileForm, setProfileForm] = useState(INITIAL_FORM);
  const [passwordForm, setPasswordForm] = useState(INITIAL_PASSWORD_FORM);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setProfileForm({
      name: user?.name || '',
      avatarUrl: user?.avatarUrl || ''
    });
  }, [user]);

  async function saveProfile(event) {
    event.preventDefault();
    setError('');

    if (!profileForm.name.trim()) {
      setError('Name is required.');
      return;
    }

    setSavingProfile(true);

    try {
      const payload = await apiRequest('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: profileForm.name.trim(),
          avatarUrl: profileForm.avatarUrl.trim()
        })
      });

      updateUser(payload.user);
      notify('Profile updated successfully');
      await refreshUser();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setError('');

    const minimumLength = user?.organizationSettings?.passwordMinLength || 8;

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    if (passwordForm.newPassword.length < minimumLength) {
      setError(`New password must be at least ${minimumLength} characters long.`);
      return;
    }

    setSavingPassword(true);

    try {
      await apiRequest('/auth/me/password', {
        method: 'PATCH',
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });

      setPasswordForm(INITIAL_PASSWORD_FORM);
      notify('Password changed successfully');
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <AppShell>
      <section className="card page-header">
        <div>
          <p className="eyebrow">Profile</p>
          <h1>My Profile</h1>
          <p className="muted">View and update your personal account information.</p>
        </div>
      </section>

      {error && <p className="error">{error}</p>}

      <section className="profile-layout">
        <aside className="card settings-sidebar">
          <h2>Profile</h2>
          <nav className="settings-nav">
            <a href="#basic-info">Basic Info</a>
            <a href="#security">Security</a>
            <a href="#access-info">Access Info</a>
          </nav>
        </aside>

        <div className="settings-content">
          <section className="card settings-panel" id="basic-info">
            <div className="section-head">
              <div>
                <p className="eyebrow">Basic Info</p>
                <h2>Editable Profile Details</h2>
              </div>
              <div className="profile-badge">{getInitials(user?.name)}</div>
            </div>

            <form className="form settings-form" onSubmit={saveProfile}>
              <div className="form-grid">
                <label>
                  Name
                  <input
                    value={profileForm.name}
                    onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))}
                    required
                  />
                </label>
                <label>
                  Email
                  <input value={user?.email || ''} disabled />
                </label>
                <label>
                  Role
                  <input value={formatRole(user?.role)} disabled />
                </label>
                <label>
                  Organization
                  <input value={user?.organizationName || user?.organizationSlug || 'Organization'} disabled />
                </label>
              </div>

              <label>
                Profile Picture URL
                <input
                  placeholder="https://example.com/avatar.jpg"
                  value={profileForm.avatarUrl}
                  onChange={(event) => setProfileForm((current) => ({ ...current, avatarUrl: event.target.value }))}
                />
              </label>

              <div className="form-actions">
                <button type="submit" disabled={savingProfile}>
                  {savingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </section>

          <section className="card settings-panel" id="security">
            <div className="section-head">
              <div>
                <p className="eyebrow">Security</p>
                <h2>Change Password</h2>
              </div>
            </div>

            <form className="form settings-form" onSubmit={changePassword}>
              <div className="form-grid">
                <label>
                  Current Password
                  <input
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))}
                    required
                  />
                </label>
                <label>
                  New Password
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))}
                    required
                    minLength={user?.organizationSettings?.passwordMinLength || 8}
                  />
                </label>
                <label>
                  Confirm Password
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                    required
                    minLength={user?.organizationSettings?.passwordMinLength || 8}
                  />
                </label>
              </div>

              <div className="muted note-box">
                Your password must be at least {user?.organizationSettings?.passwordMinLength || 8} characters long.
              </div>

              <div className="form-actions">
                <button type="submit" disabled={savingPassword}>
                  {savingPassword ? 'Updating...' : 'Change Password'}
                </button>
              </div>
            </form>
          </section>

          <section className="card settings-panel" id="access-info">
            <p className="eyebrow">Access</p>
            <h2>Account Details</h2>
            <div className="summary-grid-2">
              <div className="summary-box">
                <span className="summary-label">Last Login</span>
                <strong>{user?.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Not available'}</strong>
              </div>
              <div className="summary-box">
                <span className="summary-label">Tenant</span>
                <strong>{user?.organizationName || user?.organizationSlug || 'Organization'}</strong>
              </div>
            </div>
          </section>
        </div>
      </section>
    </AppShell>
  );
}

function getInitials(name = '') {
  return String(name || 'U')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatRole(role) {
  if (role === 'org_admin') return 'admin';
  return role || 'user';
}
