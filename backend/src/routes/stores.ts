import express from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { auth } from '../middleware/auth.js';
import { rbac } from '../middleware/rbac.js';

const router = express.Router();
const prisma = new PrismaClient();

const createStoreSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
});

const updateStoreSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  active: z.boolean().optional(),
});

// Get all stores
router.get('/', auth, rbac(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = req.user;

  const stores = await prisma.store.findMany({
    where: { tenantId },
    include: {
      _count: {
        select: {
          users: true,
          cards: true,
          transactions: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ stores });
  return;
}));

// Get store by ID
router.get('/:id', auth, rbac(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { tenantId } = req.user;

  const store = await prisma.store.findFirst({
    where: { id, tenantId },
    include: {
      users: {
        select: { id: true, firstName: true, lastName: true, email: true, role: true }
      },
      _count: {
        select: {
          cards: true,
          transactions: true
        }
      }
    },
  });

  if (!store) {
    res.status(404).json({ error: 'Store not found' });
    return;
  }

  res.json(store);
  return;
}));

// Create store
router.post('/', auth, rbac(['admin']), validate(createStoreSchema), asyncHandler(async (req: Request, res: Response) => {
  const { name, address } = req.body;
  const { tenantId } = req.user;

  const store = await prisma.store.create({
    data: {
      tenantId,
      name,
      address,
      active: true,
    },
  });

  res.status(201).json({ store });
  return;
}));

// Update store
router.put('/:id', auth, rbac(['admin']), validate(updateStoreSchema), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { tenantId } = req.user;
  const updateData = req.body;

  // Check if store exists
  const existingStore = await prisma.store.findFirst({
    where: { id, tenantId }
  });

  if (!existingStore) {
    res.status(404).json({ error: 'Store not found' });
    return;
  }

  const store = await prisma.store.update({
    where: { id },
    data: updateData,
  });

  res.json({ store });
  return;
}));

// Delete store (soft delete by setting active to false)
router.delete('/:id', auth, rbac(['admin']), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { tenantId } = req.user;

  // Check if store exists
  const existingStore = await prisma.store.findFirst({
    where: { id, tenantId }
  });

  if (!existingStore) {
    res.status(404).json({ error: 'Store not found' });
    return;
  }

  // Check if store has active cards or users
  const [activeCards, activeUsers] = await Promise.all([
    prisma.card.count({ where: { storeId: id, status: 'ACTIVE' } }),
    prisma.user.count({ where: { storeId: id, active: true } })
  ]);

  if (activeCards > 0 || activeUsers > 0) {
    res.status(400).json({ 
      error: 'Cannot delete store with active cards or users. Deactivate first.' 
    });
    return;
  }

  const store = await prisma.store.update({
    where: { id },
    data: { active: false },
  });

  res.json({ message: 'Store deactivated successfully', store });
  return;
}));

export default router;