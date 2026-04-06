import express from 'express';
import bcrypt from 'bcryptjs';

import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import { Organization } from '../models/Organization.js';
import { User } from '../models/User.js';

const router = express.Router();

router.use(requireAuth, requireRole('org_admin'));

router.get('/organization', async (request, response) => {
  const organization = await Organization.findById(request.user.organizationId).select('name slug status settings createdAt updatedAt');

  if (!organization) {
    response.status(404).json({ error: 'Organization not found.' });
    return;
  }

  response.json({ organization });
});

router.patch('/organization', async (request, response) => {
  const { name, settings } = request.body || {};
  const updates = {};

  if (name !== undefined) {
    const normalizedName = String(name).trim();
    if (!normalizedName) {
      response.status(400).json({ error: 'Organization name cannot be empty.' });
      return;
    }
    updates.name = normalizedName;
  }

  if (settings !== undefined) {
    updates.settings = {
      passwordMinLength: Math.max(Number(settings.passwordMinLength) || 8, 6),
      sessionTimeoutMinutes: Math.max(Number(settings.sessionTimeoutMinutes) || 60, 15),
      theme: ['light', 'dark'].includes(settings.theme) ? settings.theme : 'light'
    };
  }

  if (!Object.keys(updates).length) {
    response.status(400).json({ error: 'No organization updates were provided.' });
    return;
  }

  const organization = await Organization.findByIdAndUpdate(request.user.organizationId, updates, { new: true })
    .select('name slug status settings createdAt updatedAt');

  if (!organization) {
    response.status(404).json({ error: 'Organization not found.' });
    return;
  }

  response.json({ organization });
});

router.get('/users', async (request, response) => {
  const users = await User.find({ organizationId: request.user.organizationId })
    .select('_id name email role isActive lastLogin createdAt')
    .sort({ createdAt: -1 });

  response.json({ users });
});

router.post('/users', async (request, response) => {
  const { name, email, password, role = 'member' } = request.body || {};

  if (!name || !email || !password) {
    response.status(400).json({ error: 'name, email, and password are required.' });
    return;
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = await User.findOne({
    organizationId: request.user.organizationId,
    email: normalizedEmail
  });

  if (existing) {
    response.status(409).json({ error: 'User with this email already exists in your organization.' });
    return;
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  const nextRole = ['org_admin', 'manager', 'member'].includes(role) ? role : 'member';
  const user = await User.create({
    organizationId: request.user.organizationId,
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash,
    role: nextRole
  });

  response.status(201).json({
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive
    }
  });
});

router.patch('/users/:id/role', async (request, response) => {
  const { role } = request.body || {};
  if (!['org_admin', 'manager', 'member'].includes(role)) {
    response.status(400).json({ error: 'Invalid role.' });
    return;
  }

  const user = await User.findOneAndUpdate(
    {
      _id: request.params.id,
      organizationId: request.user.organizationId
    },
    { role },
    { new: true }
  ).select('_id name email role isActive');

  if (!user) {
    response.status(404).json({ error: 'User not found in your organization.' });
    return;
  }

  response.json({ user });
});

router.patch('/users/:id/status', async (request, response) => {
  const { isActive } = request.body || {};

  const user = await User.findOneAndUpdate(
    {
      _id: request.params.id,
      organizationId: request.user.organizationId
    },
    { isActive: Boolean(isActive) },
    { new: true }
  ).select('_id name email role isActive lastLogin');

  if (!user) {
    response.status(404).json({ error: 'User not found in your organization.' });
    return;
  }

  response.json({ user });
});

router.patch('/users/:id/password', async (request, response) => {
  const { password } = request.body || {};
  const organization = await Organization.findById(request.user.organizationId).select('settings.passwordMinLength');
  const minimumLength = organization?.settings?.passwordMinLength || 8;

  if (!password || String(password).trim().length < minimumLength) {
    response.status(400).json({ error: `Password must be at least ${minimumLength} characters long.` });
    return;
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = await User.findOneAndUpdate(
    {
      _id: request.params.id,
      organizationId: request.user.organizationId
    },
    { passwordHash },
    { new: true }
  ).select('_id name email role isActive');

  if (!user) {
    response.status(404).json({ error: 'User not found in your organization.' });
    return;
  }

  response.json({ user });
});

export default router;
