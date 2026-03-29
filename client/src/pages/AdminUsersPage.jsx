import { useEffect, useState } from 'react';

import { apiRequest } from '../api.js';
import AppShell from '../components/AppShell.jsx';
import { useNotifications } from '../context/NotificationContext.jsx';

export default function AdminUsersPage() {
  const { notify } = useNotifications();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'member' });

  async function loadUsers() {
    try {
      const payload = await apiRequest('/admin/users');
      setUsers(payload.users);
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function addUser(event) {
    event.preventDefault();
    setError('');

    try {
      await apiRequest('/admin/users', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      setForm({ name: '', email: '', password: '', role: 'member' });
      notify('User added to organization');
      await loadUsers();
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  async function changeRole(userId, role) {
    try {
      await apiRequest(`/admin/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role })
      });
      notify(`User role changed to ${role}`);
      await loadUsers();
    } catch (updateError) {
      setError(updateError.message);
    }
  }

  return (
    <AppShell>
      <section className="card page-header">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>Organization Users</h1>
        </div>
      </section>

      <section className="card">
        <h2>Create User</h2>
        <form className="form" onSubmit={addUser}>
          <label>
            Name
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              required
            />
          </label>
          <label>
            Role
            <select
              value={form.role}
              onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
            >
              <option value="member">member</option>
              <option value="manager">manager</option>
              <option value="org_admin">org_admin</option>
            </select>
          </label>
          <button type="submit">Add User</button>
        </form>
      </section>

      <section className="card">
        <h2>Users in your organization</h2>
        {error && <p className="error">{error}</p>}
        <ul className="stack-list">
          {users.map((user) => (
            <li key={user._id} className="row user-row">
              <span>
                {user.name} ({user.email}) - <strong>{user.role}</strong>
              </span>
              <div className="row">
                <button onClick={() => changeRole(user._id, 'member')}>Set member</button>
                <button onClick={() => changeRole(user._id, 'manager')}>Set manager</button>
                <button onClick={() => changeRole(user._id, 'org_admin')}>Set admin</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
