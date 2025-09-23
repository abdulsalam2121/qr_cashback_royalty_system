import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { auth } from '../middleware/auth.js';
import { rbac } from '../middleware/rbac.js';

const router = express.Router();
const prisma = new PrismaClient();

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['tenant_admin', 'cashier', 'customer']),
  storeId: z.string().optional(),
});

const updateUserSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  role: z.enum(['tenant_admin', 'cashier', 'customer']).optional(),
  storeId: z.string().optional(),
  active: z.boolean().optional(),
});

// Get all users
router.get('/', auth, rbac(['tenant_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = req.user;

  const users = await prisma.user.findMany({
    where: { tenantId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      active: true,
      createdAt: true,
      lastLogin: true,
      store: {
        select: { id: true, name: true }
      }
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ users });
  return;
}));

// Get user by ID
router.get('/:id', auth, rbac(['tenant_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = req.user;
  const { id } = req.params as { id: string };

  const user = await prisma.user.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      active: true,
      createdAt: true,
      lastLogin: true,
      store: {
        select: { id: true, name: true }
      }
    },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ user });
  return;
}));

// Create user
router.post('/', auth, rbac(['tenant_admin']), validate(createUserSchema), asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = req.user;
  const { email, firstName, lastName, password, role, storeId } = req.body;

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    res.status(400).json({ error: 'User with this email already exists' });
    return;
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12);

  // Create user
  const user = await prisma.user.create({
    data: {
      email,
      firstName,
      lastName,
      passwordHash: hashedPassword,
      role,
      tenantId,
      storeId,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      active: true,
      createdAt: true,
      store: {
        select: { id: true, name: true }
      }
    },
  });

  res.status(201).json({ user });
  return;
}));

// Update user
router.put('/:id', auth, rbac(['tenant_admin']), validate(updateUserSchema), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { tenantId } = req.user;
  const updateData = req.body;

  // Check if user exists
  const existingUser = await prisma.user.findFirst({
    where: { id, tenantId }
  });

  if (!existingUser) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // Verify store exists if being updated
  if (updateData.storeId) {
    const store = await prisma.store.findFirst({
      where: { id: updateData.storeId, tenantId }
    });

    if (!store) {
      res.status(400).json({ error: 'Store not found' });
      return;
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      active: true,
      createdAt: true,
      store: {
        select: { id: true, name: true }
      }
    }
  });

  res.json({ user });
  return;
}));

// Change password
router.put('/:id/password', auth, rbac(['tenant_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { tenantId } = req.user;
  const { password } = req.body;

  if (!password || password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }

  // Check if user exists
  const existingUser = await prisma.user.findFirst({
    where: { id, tenantId }
  });

  if (!existingUser) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id },
    data: { passwordHash }
  });

  res.json({ message: 'Password updated successfully' });
  return;
}));

export default router;

