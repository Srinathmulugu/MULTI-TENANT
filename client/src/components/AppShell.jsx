import { Link, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="shell">
      <aside className="sidebar card">
        <div>
          <p className="eyebrow">Multi-Tenant SaaS</p>
          <h2 className="sidebar-title">{user?.organizationName || user?.organizationSlug}</h2>
          <p className="muted">Signed in as {user?.name}</p>
          <p className="muted">Role: {user?.role}</p>
        </div>

        <nav className="sidebar-nav">
          <Link className={location.pathname === '/' ? 'active-link' : ''} to="/">
            Dashboard
          </Link>
          {user?.role === 'org_admin' && (
            <Link className={location.pathname.startsWith('/admin') ? 'active-link' : ''} to="/admin">
              Admin Users
            </Link>
          )}
        </nav>

        <button className="secondary-button" onClick={logout}>
          Logout
        </button>
      </aside>

      <main className="content">{children}</main>
    </div>
  );
}
