import express from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { auth } from '../middleware/auth.js';
import { rbac } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();
const prisma = new PrismaClient();

// Validation schemas
const updatePrintOrderSchema = z.object({
  status: z.enum([
    'CREATED',
    'PRINTING_ACCEPTED', 
    'PRINTING_IN_PROGRESS',
    'PRINTED',
    'READY_FOR_DELIVERY',
    'DELIVERED',
    'READY_FOR_PICKUP',
    'COLLECTED',
    'CANCELLED'
  ]).optional(),
  notes: z.string().optional(),
  deliveryMethod: z.enum(['PICKUP', 'DELIVERY']).optional(),
  deliveryAddress: z.string().optional(),
  trackingInfo: z.string().optional()
});

// Get print orders for tenant admin
router.get('/', auth, rbac(['tenant_admin']), asyncHandler(async (req, res) => {
  const { tenantId } = req.user;
  const { page = 1, limit = 10, status } = req.query;

  const skip = (Number(page) - 1) * Number(limit);
  
  const where: any = { tenantId };
  if (status) {
    where.status = status;
  }

  const [orders, total] = await Promise.all([
    prisma.cardPrintOrder.findMany({
      where,
      skip,
      take: Number(limit),
      include: {
        cards: {
          select: {
            id: true,
            cardUid: true,
            status: true
          }
        },
        tenant: {
          select: {
            name: true,
            slug: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.cardPrintOrder.count({ where })
  ]);

  res.json({
    orders,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
      pages: Math.ceil(total / Number(limit))
    }
  });
}));

// Get single print order for tenant admin
router.get('/:id', auth, rbac(['tenant_admin']), asyncHandler(async (req, res) => {
  const { tenantId } = req.user;
  const { id } = req.params;

  if (!id) {
    res.status(400).json({ error: 'Order ID is required' });
    return;
  }

  const order = await prisma.cardPrintOrder.findFirst({
    where: { id, tenantId },
    include: {
      cards: {
        select: {
          id: true,
          cardUid: true,
          status: true,
          qrUrl: true
        }
      },
      tenant: {
        select: {
          name: true,
          slug: true
        }
      }
    }
  });

  if (!order) {
    res.status(404).json({ error: 'Print order not found' });
    return;
  }

  res.json({ order });
}));

// Update print order (tenant admin can only update delivery method and address)
router.put('/:id', auth, rbac(['tenant_admin']), validate(updatePrintOrderSchema), asyncHandler(async (req, res) => {
  const { tenantId } = req.user;
  const { id } = req.params;
  const { deliveryMethod, deliveryAddress } = req.body;

  if (!id) {
    res.status(400).json({ error: 'Order ID is required' });
    return;
  }

  // Tenant admins can only update delivery preferences
  const allowedUpdates: any = {};
  if (deliveryMethod) allowedUpdates.deliveryMethod = deliveryMethod;
  if (deliveryAddress) allowedUpdates.deliveryAddress = deliveryAddress;

  const order = await prisma.cardPrintOrder.findFirst({
    where: { id, tenantId }
  });

  if (!order) {
    res.status(404).json({ error: 'Print order not found' });
    return;
  }

  const updatedOrder = await prisma.cardPrintOrder.update({
    where: { id },
    data: {
      ...allowedUpdates,
      updatedAt: new Date()
    },
    include: {
      cards: {
        select: {
          id: true,
          cardUid: true,
          status: true
        }
      }
    }
  });

  res.json({ 
    order: updatedOrder,
    message: 'Print order updated successfully'
  });
}));

// Mark order as collected (tenant admin only)
router.post('/:id/collect', auth, rbac(['tenant_admin']), asyncHandler(async (req, res) => {
  const { tenantId, id: userId } = req.user;
  const { id } = req.params;

  if (!id) {
    res.status(400).json({ error: 'Order ID is required' });
    return;
  }

  const order = await prisma.cardPrintOrder.findFirst({
    where: { id, tenantId }
  });

  if (!order) {
    res.status(404).json({ error: 'Print order not found' });
    return;
  }

  if (order.status !== 'READY_FOR_PICKUP') {
    res.status(400).json({ 
      error: 'Order not ready for collection',
      message: 'Order must be in READY_FOR_PICKUP status to be collected'
    });
    return;
  }

  const updatedOrder = await prisma.cardPrintOrder.update({
    where: { id },
    data: {
      status: 'COLLECTED',
      collectedAt: new Date(),
      collectedBy: userId,
      updatedAt: new Date()
    }
  });

  res.json({ 
    order: updatedOrder,
    message: 'Order marked as collected successfully'
  });
}));

export default router;