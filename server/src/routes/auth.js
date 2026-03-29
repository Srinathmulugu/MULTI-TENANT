import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import { Organization } from '../models/Organization.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    {
      userId: user._id.toString(),
      organizationId: user.organizationId.toString(),
      role: user.role,
      email: user.email,
      name: user.name
    },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
}

router.post('/register-organization', async (request, response) => {
  const { organizationName, organizationSlug, name, email, password } = request.body || {};

  if (!organizationName || !organizationSlug || !name || !email || !password) {
    response.status(400).json({ error: 'All registration fields are required.' });
    return;
  }

  const normalizedSlug = String(organizationSlug).toLowerCase().trim();
  const normalizedEmail = String(email).toLowerCase().trim();

  const existingOrganization = await Organization.findOne({ slug: normalizedSlug });
  if (existingOrganization) {
    response.status(409).json({ error: 'Organization slug is already in use.' });
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
      organizationSlug: organization.slug
    }
  });
});

router.post('/login', async (request, response) => {
  const { organizationSlug, email, password } = request.body || {};

  if (!organizationSlug || !email || !password) {
    response.status(400).json({ error: 'organizationSlug, email, and password are required.' });
    return;
  }

  const normalizedSlug = String(organizationSlug).toLowerCase().trim();
  const normalizedEmail = String(email).toLowerCase().trim();

  const organization = await Organization.findOne({ slug: normalizedSlug, status: 'active' });
  if (!organization) {
    response.status(401).json({ error: 'Invalid credentials.' });
    return;
  }

  const user = await User.findOne({
    organizationId: organization._id,
    email: normalizedEmail,
    isActive: true
  });

  if (!user) {
    response.status(401).json({ error: 'Invalid credentials.' });
    return;
  }

  const isValid = await bcrypt.compare(String(password), user.passwordHash);
  if (!isValid) {
    response.status(401).json({ error: 'Invalid credentials.' });
    return;
  }

  const token = signToken(user);
  response.json({
    token,
    user: {
      id: user._id,
      organizationId: user.organizationId,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationSlug: organization.slug
    }
  });
});

router.get('/me', requireAuth, async (request, response) => {
  const user = await User.findOne({
    _id: request.user.userId,
    organizationId: request.user.organizationId,
    isActive: true
  }).select('_id organizationId name email role');

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
      organizationName: organization?.name
    }
  });
});

export default router;
