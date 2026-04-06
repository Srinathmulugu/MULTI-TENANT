import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { Organization } from '../models/Organization.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

function signToken(user) {
  const organizationId = user.organizationId?._id || user.organizationId;

  return jwt.sign(
    {
      userId: user._id.toString(),
      organizationId: organizationId.toString(),
      role: user.role,
      email: user.email,
      name: user.name
    },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

router.post('/register-organization', async (request, response) => {
  const { organizationName, name, email, password } = request.body || {};

  if (!organizationName || !name || !email || !password) {
    response.status(400).json({ error: 'All registration fields are required.' });
    return;
  }

  const baseSlug = slugify(organizationName);
  const normalizedEmail = String(email).toLowerCase().trim();

  let normalizedSlug = baseSlug;
  let suffix = 1;

  while (await Organization.findOne({ slug: normalizedSlug })) {
    suffix += 1;
    normalizedSlug = `${baseSlug}-${suffix}`;
  }

  if (!normalizedSlug) {
    response.status(400).json({ error: 'Organization name must contain letters or numbers.' });
    return;
  }

  const organization = await Organization.create({
    name: String(organizationName).trim(),
    slug: normalizedSlug
  });

  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = await User.create({
    organizationId: organization._id,
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash,
    role: 'org_admin'
  });

  const token = signToken(user);
  response.status(201).json({
    token,
    user: {
      id: user._id,
      organizationId: user.organizationId,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationSlug: organization.slug,
      organizationName: organization.name,
      avatarUrl: user.avatarUrl,
      lastLogin: user.lastLogin,
      preferences: user.preferences,
      organizationSettings: organization.settings
    }
  });
});

router.post('/login', async (request, response) => {
  const { email, password } = request.body || {};

  if (!email || !password) {
    response.status(400).json({ error: 'email and password are required.' });
    return;
  }

  const normalizedEmail = String(email).toLowerCase().trim();

  const users = await User.find({
    email: normalizedEmail,
    isActive: true
  }).populate('organizationId', 'slug name status');

  const validAccounts = users.filter((user) => user.organizationId?.status === 'active');

  if (!validAccounts.length) {
    response.status(401).json({ error: 'Invalid credentials.' });
    return;
  }

  if (validAccounts.length > 1) {
    response.status(409).json({
      error: 'Multiple organizations use this email. Use a unique email or ask your admin to consolidate accounts.'
    });
    return;
  }

  const user = validAccounts[0];

  if (!user) {
    response.status(401).json({ error: 'Invalid credentials.' });
    return;
  }

  const isValid = await bcrypt.compare(String(password), user.passwordHash);
  if (!isValid) {
    response.status(401).json({ error: 'Invalid credentials.' });
    return;
  }

  await User.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });

  const token = signToken(user);
  response.json({
    token,
    user: {
      id: user._id,
      organizationId: user.organizationId?._id || user.organizationId,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationSlug: user.organizationId?.slug,
      organizationName: user.organizationId?.name,
      avatarUrl: user.avatarUrl,
      lastLogin: new Date(),
      preferences: user.preferences,
      organizationSettings: user.organizationId?.settings
    }
  });
});

router.get('/me', requireAuth, async (request, response) => {
  const user = await User.findOne({
    _id: request.user.userId,
    organizationId: request.user.organizationId,
    isActive: true
  }).select('_id organizationId name email role avatarUrl lastLogin preferences');

  if (!user) {
    response.status(404).json({ error: 'User not found.' });
    return;
  }

  const organization = await Organization.findById(request.user.organizationId).select('slug name settings');

  response.json({
    user: {
      id: user._id,
      organizationId: user.organizationId,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationSlug: organization?.slug,
      organizationName: organization?.name,
      avatarUrl: user.avatarUrl,
      lastLogin: user.lastLogin,
      preferences: user.preferences,
      organizationSettings: organization?.settings
    }
  });
});

router.patch('/me', requireAuth, async (request, response) => {
  const { name, avatarUrl, preferences } = request.body || {};
  const updates = {};

  if (name !== undefined) {
    const normalizedName = String(name).trim();
    if (!normalizedName) {
      response.status(400).json({ error: 'Name cannot be empty.' });
      return;
    }
    updates.name = normalizedName;
  }

  if (avatarUrl !== undefined) {
    updates.avatarUrl = String(avatarUrl).trim();
  }

  if (preferences !== undefined) {
    updates.preferences = {
      emailNotifications: Boolean(preferences.emailNotifications),
      projectUpdates: Boolean(preferences.projectUpdates),
      defaultProjectView: ['list', 'card'].includes(preferences.defaultProjectView)
        ? preferences.defaultProjectView
        : 'list',
      sortPreference: String(preferences.sortPreference || 'newest'),
      theme: ['light', 'dark'].includes(preferences.theme) ? preferences.theme : 'light'
    };
  }

  if (!Object.keys(updates).length) {
    response.status(400).json({ error: 'No profile updates were provided.' });
    return;
  }

  const user = await User.findOneAndUpdate(
    {
      _id: request.user.userId,
      organizationId: request.user.organizationId,
      isActive: true
    },
    updates,
    { new: true }
  ).select('_id organizationId name email role avatarUrl lastLogin preferences');

  if (!user) {
    response.status(404).json({ error: 'User not found.' });
    return;
  }

  const organization = await Organization.findById(request.user.organizationId).select('slug name');

  response.json({
    user: {
      id: user._id,
      organizationId: user.organizationId,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationSlug: organization?.slug,
      organizationName: organization?.name,
      avatarUrl: user.avatarUrl,
      lastLogin: user.lastLogin,
      preferences: user.preferences
    }
  });
});

router.patch('/me/password', requireAuth, async (request, response) => {
  const { currentPassword, newPassword } = request.body || {};

  if (!currentPassword || !newPassword) {
    response.status(400).json({ error: 'currentPassword and newPassword are required.' });
    return;
  }

  const user = await User.findOne({
    _id: request.user.userId,
    organizationId: request.user.organizationId,
    isActive: true
  });

  if (!user) {
    response.status(404).json({ error: 'User not found.' });
    return;
  }

  const isCurrentPasswordValid = await bcrypt.compare(String(currentPassword), user.passwordHash);
  if (!isCurrentPasswordValid) {
    response.status(401).json({ error: 'Current password is incorrect.' });
    return;
  }

  const organization = await Organization.findById(request.user.organizationId).select('settings.passwordMinLength');
  const minimumLength = organization?.settings?.passwordMinLength || 8;

  if (String(newPassword).trim().length < minimumLength) {
    response.status(400).json({ error: `New password must be at least ${minimumLength} characters long.` });
    return;
  }

  user.passwordHash = await bcrypt.hash(String(newPassword), 10);
  await user.save();

  response.json({ success: true });
});

export default router;
