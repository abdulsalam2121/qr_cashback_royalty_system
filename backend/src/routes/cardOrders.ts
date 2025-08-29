import express from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { auth } from '../middleware/auth.js';
import { rbac } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';

const router = express.Router();
const prisma = new PrismaClient();

// Card pricing configuration
const CARD_PRICES = {
  SINGLE_SIDED: 2.10,
  DOUBLE_SIDED_CUSTOM: 3.90
};

// Validation schemas
const createOrderSchema = z.object({
  cardType: z.enum(['SINGLE_SIDED', 'DOUBLE_SIDED_CUSTOM']),
  quantity: z.number().min(1).max(10000),
  storeName: z.string().optional(),
  storePhone: z.string().optional(),
  storeAddress: z.string().optional(),
  customDesign: z.string().optional(),
  shippingAddress: z.string().min(1, 'Shipping address is required')
});

const updateOrderSchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']).optional(),
  trackingNumber: z.string().optional()
});

// Get card pricing
router.get('/pricing', asyncHandler(async (req, res) => {
  res.json({
    prices: CARD_PRICES,
    currency: 'USD'
  });
}));

// Get orders for tenant
router.get('/', auth, rbac(['tenant_admin']), asyncHandler(async (req, res) => {
  const { tenantId } = req.user;
  const { page = 1, limit = 10, status } = req.query;

  const skip = (Number(page) - 1) * Number(limit);
  
  const where: any = { tenantId };
  if (status) {
    where.status = status;
  }

  const [orders, total] = await Promise.all([
    prisma.cardOrder.findMany({
      where,
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' }
    }),
    prisma.cardOrder.count({ where })
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

// Get single order
router.get('/:id', auth, rbac(['tenant_admin']), asyncHandler(async (req, res) => {
  const { tenantId } = req.user;
  const { id } = req.params;

  const order = await prisma.cardOrder.findFirst({
    where: { id, tenantId }
  });

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  res.json({ order });
}));

// Create new order
router.post('/', auth, rbac(['tenant_admin']), validate(createOrderSchema), asyncHandler(async (req, res) => {
  const { tenantId } = req.user;
  const { cardType, quantity, storeName, storePhone, storeAddress, customDesign, shippingAddress } = req.body;

  // Check trial status
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }
  });

  if (!tenant) {
    return res.status(404).json({ error: 'Tenant not found' });
  }

  // Check if tenant has exceeded free trial and needs subscription
  if (tenant.freeTrialActivations >= tenant.freeTrialLimit && 
      tenant.subscriptionStatus !== 'ACTIVE') {
    return res.status(403).json({ 
      error: 'Subscription required',
      message: 'Your free trial has ended. Please upgrade to a paid subscription to continue ordering cards.',
      trialActivations: tenant.freeTrialActivations,
      trialLimit: tenant.freeTrialLimit
    });
  }

  const unitPrice = CARD_PRICES[cardType as keyof typeof CARD_PRICES];
  const totalPrice = unitPrice * quantity;

  const order = await prisma.cardOrder.create({
    data: {
      tenantId,
      cardType,
      quantity,
      unitPrice,
      totalPrice,
      storeName,
      storePhone,
      storeAddress,
      customDesign,
      shippingAddress,
      status: 'PENDING'
    }
  });

  res.status(201).json({ order });
}));

// Update order (admin only - for platform management)
router.put('/:id', auth, rbac(['platform_admin']), validate(updateOrderSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  // Add timestamp fields based on status
  if (updateData.status === 'SHIPPED') {
    updateData.shippedAt = new Date();
  } else if (updateData.status === 'DELIVERED') {
    updateData.deliveredAt = new Date();
  }

  const order = await prisma.cardOrder.update({
    where: { id },
    data: updateData
  });

  res.json({ order });
}));

// Cancel order
router.delete('/:id', auth, rbac(['tenant_admin']), asyncHandler(async (req, res) => {
  const { tenantId } = req.user;
  const { id } = req.params;

  const order = await prisma.cardOrder.findFirst({
    where: { id, tenantId }
  });

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  if (order.status !== 'PENDING') {
    return res.status(400).json({ 
      error: 'Cannot cancel order',
      message: 'Only pending orders can be cancelled'
    });
  }

  const updatedOrder = await prisma.cardOrder.update({
    where: { id },
    data: { status: 'CANCELLED' }
  });

  res.json({ order: updatedOrder });
}));

export default router;
