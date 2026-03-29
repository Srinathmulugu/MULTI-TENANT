import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { login, registerOrg } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    organizationName: '',
    organizationSlug: '',
    name: '',
    email: '',
    password: ''
  });

  async function onSubmit(event) {
    event.preventDefault();
    setError('');

    try {
      if (mode === 'register') {
        await registerOrg(form);
      } else {
        await login({
          organizationSlug: form.organizationSlug,
          email: form.email,
          password: form.password
        });
      }
      navigate('/');
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  return (
    <div className="screen-center">
      <div className="auth-container">
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => setMode('login')}
          >
            Login
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => setMode('register')}
          >
            Create Account
          </button>
        </div>

        <form className="card form auth-form" onSubmit={onSubmit}>
          <h1>{mode === 'login' ? 'Organization Login' : 'Create New Account'}</h1>

          {mode === 'register' && (
            <>
              <label>
                Organization Name
                <input
                  value={form.organizationName}
                  onChange={(event) => setForm((prev) => ({ ...prev, organizationName: event.target.value }))}
                  required
                  placeholder="Acme Corp"
                />
              </label>
              <label>
                Organization Slug
                <input
                  value={form.organizationSlug}
                  onChange={(event) => setForm((prev) => ({ ...prev, organizationSlug: event.target.value }))}
                  required
                  placeholder="acme-corp"
                />
              </label>
              <label>
                Admin Name
                <input
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                  placeholder="John Doe"
                />
              </label>
            </>
          )}

          {mode === 'login' && (
            <label>
              Organization Slug
              <input
                value={form.organizationSlug}
                onChange={(event) => setForm((prev) => ({ ...prev, organizationSlug: event.target.value }))}
                required
                placeholder="acme-corp"
              />
            </label>
          )}

          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              required
              placeholder="you@example.com"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              required
              placeholder="••••••••"
            />
          </label>

          {error && <p className="error">{error}</p>}

          <button type="submit" className="primary-button">
            {mode === 'login' ? 'Login' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
