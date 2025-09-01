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

const createTenantSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(6),
  ownerFirstName: z.string().min(1),
  ownerLastName: z.string().min(1),
});

// Get platform statistics
router.get('/stats', auth, rbac(['platform_admin']), asyncHandler(async (req: Request, res: Response) => {
  const [
    totalTenants,
    activeTenants,
    totalStores,
    totalCustomers,
    // Mock revenue data - in real app, calculate from Stripe
    totalRevenue,
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { subscriptionStatus: 'ACTIVE' } }),
    prisma.store.count(),
    prisma.customer.count(),
    // Mock revenue calculation
    Promise.resolve(0),
  ]);

  res.json({
    totalTenants,
    activeTenants,
    totalStores,
    totalCustomers,
    totalRevenue,
  });
  return;
}));

// Get all tenants
router.get('/tenants', auth, rbac(['platform_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { status, search, page = 1, limit = 50 } = req.query;

  const where: any = {};
  
  if (status) {
    where.subscriptionStatus = status;
  }

  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { slug: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      include: {
        _count: {
          select: {
            stores: true,
            users: true,
            customers: true,
            cards: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
    }),
    prisma.tenant.count({ where }),
  ]);

  res.json({
    tenants,
    total,
    page: Number(page),
    limit: Number(limit),
    pages: Math.ceil(total / Number(limit)),
  });
  return;
}));

// Create new tenant
router.post('/tenants', auth, rbac(['platform_admin']), validate(createTenantSchema), asyncHandler(async (req: Request, res: Response) => {
  const { name, slug, ownerEmail, ownerPassword, ownerFirstName, ownerLastName } = req.body;

  // Check if slug is already taken
  const existingTenant = await prisma.tenant.findUnique({
    where: { slug }
  });

  if (existingTenant) {
    res.status(400).json({ error: 'Tenant slug already exists' });
    return;
  }

  // Check if owner email is already taken
  const existingUser = await prisma.user.findUnique({
    where: { email: ownerEmail }
  });

  if (existingUser) {
    res.status(400).json({ error: 'User with this email already exists' });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    // Create tenant
    const tenant = await tx.tenant.create({
      data: {
        name,
        slug,
        subscriptionStatus: 'NONE',
      },
    });

    // Create owner user
    const passwordHash = await bcrypt.hash(ownerPassword, 12);
    const user = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: ownerEmail,
        passwordHash,
        firstName: ownerFirstName,
        lastName: ownerLastName,
        role: 'tenant_admin',
      },
    });

    // Create default store
    const store = await tx.store.create({
      data: {
        tenantId: tenant.id,
        name: 'Main Store',
        active: true,
      },
    });

    // Create default cashback rules
    const cashbackRules = [
      { category: 'PURCHASE', baseRateBps: 500 },
      { category: 'REPAIR', baseRateBps: 300 },
      { category: 'OTHER', baseRateBps: 200 },
    ];

    for (const rule of cashbackRules) {
      await tx.cashbackRule.create({
        data: {
          tenantId: tenant.id,
          category: rule.category as any,
          baseRateBps: rule.baseRateBps,
          isActive: true,
        },
      });
    }

    // Create default tier rules
    const tierRules = [
      { tier: 'SILVER', name: 'Silver', minTotalSpendCents: 0, baseRateBps: 500 },
      { tier: 'GOLD', name: 'Gold', minTotalSpendCents: 30000, baseRateBps: 700 },
      { tier: 'PLATINUM', name: 'Platinum', minTotalSpendCents: 70000, baseRateBps: 1000 },
    ];

    for (const rule of tierRules) {
      await tx.tierRule.create({
        data: {
          tenantId: tenant.id,
          tier: rule.tier as any,
          name: rule.name,
          minTotalSpendCents: rule.minTotalSpendCents,
          baseRateBps: rule.baseRateBps,
          isActive: true,
        },
      });
    }

    return { tenant, user };
  });

  res.status(201).json(result);
  return;
}));

// Update tenant
router.put('/tenants/:id', auth, rbac(['platform_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const updateData = req.body;

  const tenant = await prisma.tenant.update({
    where: { id },
    data: updateData,
    include: {
      _count: {
        select: {
          stores: true,
          users: true,
          customers: true,
          cards: true,
        }
      }
    }
  });

  res.json({ tenant });
  return;
}));

// Get plans (accessible to both platform admins and tenant admins)
router.get('/plans', auth, rbac(['platform_admin', 'tenant_admin']), asyncHandler(async (req: Request, res: Response) => {
  // Plans for subscription
  const plans = [
    {
      id: 'starter',
      name: 'Starter Plan',
      description: 'Perfect for small businesses - unlimited card activations after trial',
      priceMonthly: 1999, // $19.99
      stripePriceId: process.env.STRIPE_PRICE_ID_STARTER || 'price_starter',
      features: [
        'Unlimited card activations',
        'Up to 3 store locations',
        'Up to 10 staff members',
        'Unlimited loyalty cards',
        'Basic cashback rules',
        'Email support',
        'Card ordering system'
      ],
      limits: {
        stores: 3,
        staff: 10,
        cards: -1,
        transactions: -1
      },
      popular: true
    },
    {
      id: 'pro',
      name: 'Professional',
      description: 'Advanced features for growing businesses',
      priceMonthly: 4999, // $49.99
      stripePriceId: process.env.STRIPE_PRICE_ID_PRO || 'price_pro',
      features: [
        'Everything in Starter',
        'Unlimited store locations',
        'Unlimited staff members',
        'Advanced cashback rules',
        'Special offer campaigns',
        'Priority support',
        'Custom branding',
        'Advanced analytics'
      ],
      limits: {
        stores: -1,
        staff: -1,
        cards: -1,
        transactions: -1
      }
    }
  ];

  res.json({ plans });
  return;
}));

export default router;