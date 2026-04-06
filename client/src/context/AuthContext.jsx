import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { apiRequest } from '../api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('mt_token') || '');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    if (!token) {
      return null;
    }

    const payload = await apiRequest('/auth/me');
    setUser(payload.user);
    return payload.user;
  }

  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const payload = await apiRequest('/auth/me');
        setUser(payload.user);
      } catch {
        setToken('');
        localStorage.removeItem('mt_token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [token]);

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      refreshUser,
      updateUser(updates) {
        setUser((current) => (current ? { ...current, ...updates } : current));
      },
      async login({ email, password }) {
        const payload = await apiRequest('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });

        localStorage.setItem('mt_token', payload.token);
        setToken(payload.token);
        setUser(payload.user);
      },
      async registerOrg({ organizationName, name, email, password }) {
        const payload = await apiRequest('/auth/register-organization', {
          method: 'POST',
          body: JSON.stringify({ organizationName, name, email, password })
        });

        localStorage.setItem('mt_token', payload.token);
        setToken(payload.token);
        setUser(payload.user);
      },
      logout() {
        localStorage.removeItem('mt_token');
        setToken('');
        setUser(null);
      }
    }),
    [token, user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
