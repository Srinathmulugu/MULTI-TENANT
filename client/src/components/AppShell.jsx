import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const organizationName = user?.organizationName || user?.organizationSlug || 'Organization';
  const initials =
    user?.name
      ?.split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U';

  const dashboardActive = location.pathname === '/' && location.hash !== '#projects';
  const projectsActive = location.pathname === '/' && location.hash === '#projects';

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="app-frame">
      <header className="card top-header">
        <div className="company-mark">
          <h1 className="company-name">{organizationName}</h1>
        </div>
        <div className="header-user" ref={menuRef}>
          <button className="avatar avatar-button" type="button" aria-label="Open profile menu" onClick={() => setMenuOpen((current) => !current)}>
            {initials}
          </button>
          <div>
            <p className="user-name">{user?.name}</p>
            <p className="muted">Role: {user?.role}</p>
          </div>
          {menuOpen && (
            <div className="profile-menu card">
              <button type="button" onClick={() => { setMenuOpen(false); navigate('/profile'); }}>
                👤 My Profile
              </button>
              <button type="button" onClick={() => { setMenuOpen(false); navigate('/settings'); }}>
                ⚙ Settings
              </button>
              <button type="button" onClick={() => { setMenuOpen(false); logout(); navigate('/login'); }}>
                🚪 Logout
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="shell-grid">
        <aside className="sidebar card">
          <nav className="sidebar-nav">
            <Link className={dashboardActive ? 'active-link' : ''} to="/">
              <span aria-hidden="true">🏠</span> Dashboard
            </Link>
            <Link className={projectsActive ? 'active-link' : ''} to="/#projects">
              <span aria-hidden="true">📁</span> Projects
            </Link>
            {user?.role === 'org_admin' ? (
              <Link className={location.pathname.startsWith('/admin') ? 'active-link' : ''} to="/admin">
                <span aria-hidden="true">👥</span> Users
              </Link>
            ) : (
              <span className="disabled-link">
                <span aria-hidden="true">👥</span> Users
              </span>
            )}
          </nav>
        </aside>

        <main className="content">{children}</main>
      </div>

      <footer className="app-footer">© 2026 Multi-Tenant SaaS | Project by M.Srinath</footer>
    </div>
  );
}
