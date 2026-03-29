import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';

import { useAuth } from '../context/AuthContext.jsx';

// Organization branding themes
const orgThemes = {
  default: {
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    accentColor: '#4f46e5',
    emoji: '🚀',
    name: 'Multi-Tenant SaaS'
  },
  acme: {
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    accentColor: '#f5576c',
    emoji: '⚡',
    name: 'Acme Corp'
  },
  tech: {
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    accentColor: '#00f2fe',
    emoji: '💻',
    name: 'TechFlow'
  },
  startup: {
    gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    accentColor: '#38f9d7',
    emoji: '🎯',
    name: 'Startup Hub'
  }
};

export default function LoginPage() {
  const { login, registerOrg } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    organizationName: '',
    organizationSlug: '',
    name: '',
    email: '',
    password: ''
  });

  // Get org slug from URL or form
  const orgSlug = searchParams.get('org') || form.organizationSlug;
  
  // Select theme based on org slug
  const getOrgTheme = (slug) => {
    if (!slug) return orgThemes.default;
    const normalizedSlug = slug.toLowerCase().replace(/-/g, '');
    
    // Map slugs to themes
    if (normalizedSlug.includes('acme')) return orgThemes.acme;
    if (normalizedSlug.includes('tech')) return orgThemes.tech;
    if (normalizedSlug.includes('startup')) return orgThemes.startup;
    return orgThemes.default;
  };

  const orgTheme = getOrgTheme(orgSlug);

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

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: 'easeOut' }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, x: 50 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.8, ease: 'easeOut' }
    }
  };

  const illustrationVariants = {
    hidden: { opacity: 0, x: -50 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.8, ease: 'easeOut' }
    }
  };

  return (
    <motion.div 
      className="auth-screen"
      style={{ background: orgTheme.gradient }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
    >
      <div className="auth-wrapper auth-split">
        {/* Left Side - Illustration & Branding */}
        <motion.div 
          className="auth-illustration"
          variants={illustrationVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div 
            className="illustration-content"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div 
              className="large-emoji"
              variants={itemVariants}
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              {orgTheme.emoji}
            </motion.div>
            
            <motion.h2 
              className="brand-title"
              variants={itemVariants}
            >
              {orgTheme.name}
            </motion.h2>
            
            <motion.p 
              className="brand-subtitle"
              variants={itemVariants}
            >
              Powerful project management for modern teams
            </motion.p>

            <motion.div 
              className="feature-list"
              variants={containerVariants}
            >
              <motion.div className="feature-item" variants={itemVariants}>
                <span className="check">✓</span> Real-time collaboration
              </motion.div>
              <motion.div className="feature-item" variants={itemVariants}>
                <span className="check">✓</span> Task management
              </motion.div>
              <motion.div className="feature-item" variants={itemVariants}>
                <span className="check">✓</span> Team workflows
              </motion.div>
              <motion.div className="feature-item" variants={itemVariants}>
                <span className="check">✓</span> Activity tracking
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Right Side - Login Form */}
        <motion.div 
          className="auth-form-side"
          variants={cardVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="auth-container">
            <motion.div
              className="auth-tabs"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <button
                type="button"
                className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
                onClick={() => setMode('login')}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
                onClick={() => setMode('register')}
              >
                Create Account
              </button>
            </motion.div>

            <motion.form 
              className="card form auth-form" 
              onSubmit={onSubmit}
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <h2>{mode === 'login' ? 'Welcome Back' : 'Start Your Journey'}</h2>

              {mode === 'register' && (
                <>
                  <motion.div className="form-group" variants={itemVariants}>
                    <label>Organization Name</label>
                    <div className="input-wrapper">
                      <span className="input-icon">🏢</span>
                      <input
                        value={form.organizationName}
                        onChange={(event) => setForm((prev) => ({ ...prev, organizationName: event.target.value }))}
                        required
                        placeholder="Acme Corp"
                      />
                    </div>
                  </motion.div>
                  <motion.div className="form-group" variants={itemVariants}>
                    <label>Organization Slug</label>
                    <div className="input-wrapper">
                      <span className="input-icon">🔗</span>
                      <input
                        value={form.organizationSlug}
                        onChange={(event) => setForm((prev) => ({ ...prev, organizationSlug: event.target.value }))}
                        required
                        placeholder="acme-corp"
                      />
                    </div>
                  </motion.div>
                  <motion.div className="form-group" variants={itemVariants}>
                    <label>Admin Name</label>
                    <div className="input-wrapper">
                      <span className="input-icon">👤</span>
                      <input
                        value={form.name}
                        onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                        required
                        placeholder="John Doe"
                      />
                    </div>
                  </motion.div>
                </>
              )}

              {mode === 'login' && (
                <motion.div className="form-group" variants={itemVariants}>
                  <label>Organization Slug</label>
                  <div className="input-wrapper">
                    <span className="input-icon">🏢</span>
                    <input
                      value={form.organizationSlug}
                      onChange={(event) => setForm((prev) => ({ ...prev, organizationSlug: event.target.value }))}
                      required
                      placeholder="acme-corp"
                    />
                  </div>
                </motion.div>
              )}

              <motion.div className="form-group" variants={itemVariants}>
                <label>Email</label>
                <div className="input-wrapper">
                  <span className="input-icon">📧</span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                    required
                    placeholder="you@example.com"
                  />
                </div>
              </motion.div>

              <motion.div className="form-group" variants={itemVariants}>
                <label>Password</label>
                <div className="input-wrapper">
                  <span className="input-icon">🔒</span>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                    required
                    placeholder="••••••••"
                  />
                </div>
              </motion.div>

              {error && (
                <motion.p 
                  className="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {error}
                </motion.p>
              )}

              <motion.button 
                type="submit" 
                className="primary-button"
                variants={itemVariants}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{ backgroundColor: orgTheme.accentColor }}
              >
                {mode === 'login' ? 'Login' : 'Create Account'}
              </motion.button>
            </motion.form>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
