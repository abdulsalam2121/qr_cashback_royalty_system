import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { auth } from '../middleware/auth.js';
import { rbac } from '../middleware/rbac.js';

const router = express.Router();
const prisma = new PrismaClient();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['admin', 'cashier', 'customer']).optional(),
  storeId: z.string().optional(),
});

// Login
router.post('/login', validate(loginSchema), asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({
    where: { email },
    include: { 
      store: true, 
      tenant: true 
    },
  });

  if (!user || !user.active) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  const token = jwt.sign(
    { 
      userId: user.id, 
      email: user.email, 
      role: user.role,
      tenantId: user.tenantId,
      storeId: user.storeId,
    },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  const userResponse = {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    storeId: user.storeId,
    storeName: user.store?.name,
    tenantId: user.tenantId,
    tenantSlug: user.tenant?.slug,
    tenantName: user.tenant?.name,
  };

  const response: any = { user: userResponse };
  
  // Include tenant info for non-platform admins
  if (user.tenant && user.role !== 'platform_admin') {
    response.tenant = {
      id: user.tenant.id,
      slug: user.tenant.slug,
      name: user.tenant.name,
      subscriptionStatus: user.tenant.subscriptionStatus,
      planId: user.tenant.planId,
      trialEndsAt: user.tenant.trialEndsAt,
      graceEndsAt: user.tenant.graceEndsAt,
    };
  }

  res.json(response);
  return;
}));

// Public signup (for store owners)
router.post('/signup', validate(registerSchema), asyncHandler(async (req: Request, res: Response) => {
  const { email, password, firstName, lastName } = req.body;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    res.status(400).json({ error: 'User already exists' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Generate unique slug for tenant
  const baseSlug = `${firstName}-${lastName}-store`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  let slug = baseSlug;
  let counter = 1;
  
  // Ensure slug is unique
  while (await prisma.tenant.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  // Create a tenant for the new store owner with trial settings
  const tenant = await prisma.tenant.create({
    data: {
      name: `${firstName} ${lastName}'s Store`,
      slug,
      subscriptionStatus: 'TRIALING',
      freeTrialActivations: 0,
      freeTrialLimit: 40,
      trialExpiredNotified: false,
    },
  });

  // Create the user as tenant admin
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName,
      lastName,
      role: 'tenant_admin', // Store owners are tenant admins
      tenantId: tenant.id,
    },
    include: { store: true, tenant: true },
  });

  // Create JWT token for immediate login
  const token = jwt.sign(
    { 
      userId: user.id, 
      email: user.email, 
      role: user.role,
      tenantId: user.tenantId,
      storeId: user.storeId,
    },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  const userResponse = {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    storeId: user.storeId,
    storeName: user.store?.name,
    tenantId: user.tenantId,
    tenantName: user.tenant?.name,
    tenantSlug: user.tenant?.slug,
  };

  const response = { 
    user: userResponse,
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      subscriptionStatus: tenant.subscriptionStatus,
      planId: tenant.planId,
      trialEndsAt: tenant.trialEndsAt,
      graceEndsAt: tenant.graceEndsAt,
      freeTrialActivations: tenant.freeTrialActivations,
      freeTrialLimit: tenant.freeTrialLimit,
    }
  };

  res.status(201).json(response);
  return;
}));

// Register (admin only for creating staff)
router.post('/register', auth, rbac(['tenant_admin']), validate(registerSchema), asyncHandler(async (req: Request, res: Response) => {
  const { email, password, firstName, lastName, role = 'customer', storeId } = req.body;
  const { tenantId } = req.user;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    res.status(400).json({ error: 'User already exists' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName,
      lastName,
      role,
      tenantId,
      storeId,
    },
    include: { store: true, tenant: true },
  });

  const userResponse = {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    storeId: user.storeId,
    storeName: user.store?.name,
    active: user.active,
    createdAt: user.createdAt,
  };

  res.status(201).json({ user: userResponse });
  return;
}));

// Get current user
router.get('/me', auth, asyncHandler(async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.userId },
    include: { 
      store: true, 
      tenant: true 
    },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const userResponse = {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    storeId: user.storeId,
    storeName: user.store?.name,
    tenantId: user.tenantId,
    tenantSlug: user.tenant?.slug,
    tenantName: user.tenant?.name,
  };

  const response: any = { user: userResponse };
  
  // Include tenant info for non-platform admins
  if (user.tenant && user.role !== 'platform_admin') {
    response.tenant = {
      id: user.tenant.id,
      slug: user.tenant.slug,
      name: user.tenant.name,
      subscriptionStatus: user.tenant.subscriptionStatus,
      planId: user.tenant.planId,
      trialEndsAt: user.tenant.trialEndsAt,
      graceEndsAt: user.tenant.graceEndsAt,
    };
  }

  res.json(response);
  return;
}));

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

export default router;