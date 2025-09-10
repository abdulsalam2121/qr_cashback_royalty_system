import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { auth } from '../middleware/auth.js';
import { rbac } from '../middleware/rbac.js';
import { CardLimitService } from '../services/cardLimitService.js';

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

const createPlanSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  priceMonthly: z.number().min(0),
  billingPeriod: z.enum(['monthly', '3months', '6months', 'yearly']),
  stripePriceId: z.string().min(1),
  features: z.array(z.string()),
  limits: z.object({
    stores: z.number().default(-1),
    staff: z.number().default(-1),
    cards: z.number().default(-1),
    transactions: z.number().default(-1),
  }),
  cardAllowance: z.number().min(0).default(0),
  allowCardOrdering: z.boolean().default(true),
});

// Get platform statistics
router.get('/stats', auth, rbac(['platform_admin']), asyncHandler(async (req: Request, res: Response) => {
  const [
    totalTenants,
    activeTenants,
    totalStores,
    totalCustomers,
    totalRevenue,
    monthlyRevenue,
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.tenant.count({ where: { subscriptionStatus: 'ACTIVE' } }),
    prisma.store.count(),
    prisma.customer.count(),
    // Mock revenue calculation
    Promise.resolve(0),
    // Mock monthly revenue calculation
    Promise.resolve(0),
  ]);

  res.json({
    totalTenants,
    activeTenants,
    totalStores,
    totalCustomers,
    totalRevenue,
    monthlyRevenue,
  });
}));

// Get all tenants
router.get('/tenants', auth, rbac(['platform_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 10, search } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { slug: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      skip,
      take: Number(limit),
      include: {
        plan: true,
        users: {
          where: { role: 'tenant_admin' },
          select: { email: true, firstName: true, lastName: true }
        },
        _count: {
          select: {
            stores: true,
            users: true,
            customers: true,
            cards: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.tenant.count({ where })
  ]);

  res.json({
    tenants: tenants.map(tenant => ({
      ...tenant,
      adminUser: tenant.users[0] || null
    })),
    pagination: {
      total,
      pages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      limit: Number(limit)
    }
  });
}));

// Create tenant
router.post('/tenants', auth, rbac(['platform_admin']), validate(createTenantSchema), asyncHandler(async (req: Request, res: Response) => {
  const { name, slug, ownerEmail, ownerPassword, ownerFirstName, ownerLastName } = req.body;

  // Check if slug or email already exists
  const existingTenant = await prisma.tenant.findUnique({ where: { slug } });
  if (existingTenant) {
    res.status(400).json({ error: 'Tenant slug already exists' });
    return;
  }

  const existingUser = await prisma.user.findUnique({ where: { email: ownerEmail } });
  if (existingUser) {
    res.status(400).json({ error: 'User with this email already exists' });
    return;
  }

  // Get starter plan
  const starterPlan = await prisma.plan.findFirst({
    where: { name: { contains: 'Starter', mode: 'insensitive' } }
  });

  // Create tenant and admin user in transaction
  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name,
        slug,
        subscriptionStatus: 'TRIALING',
        planId: starterPlan?.id || null,
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        freeTrialLimit: 40,
        totalCardAllowance: 40,
        currentCardBalance: 40
      }
    });

    const hashedPassword = await bcrypt.hash(ownerPassword, 10);
    const adminUser = await tx.user.create({
      data: {
        tenantId: tenant.id,
        email: ownerEmail,
        passwordHash: hashedPassword,
        firstName: ownerFirstName,
        lastName: ownerLastName,
        role: 'tenant_admin'
      }
    });

    return { tenant, adminUser };
  });

  res.status(201).json({
    tenant: result.tenant,
    adminUser: {
      id: result.adminUser.id,
      email: result.adminUser.email,
      firstName: result.adminUser.firstName,
      lastName: result.adminUser.lastName
    }
  });
}));

// Get plans (accessible to both platform admins and tenant admins)
router.get('/plans', auth, rbac(['platform_admin', 'tenant_admin']), asyncHandler(async (req: Request, res: Response) => {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { priceMonthly: 'asc' }
  });

  // Convert billingPeriod enum values to frontend format
  const formattedPlans = plans.map(plan => ({
    id: plan.id,
    name: plan.name,
    description: plan.description,
    priceMonthly: plan.priceMonthly,
    billingPeriod: plan.billingPeriod === 'THREE_MONTHS' ? '3months' : 
                   plan.billingPeriod === 'SIX_MONTHS' ? '6months' :
                   plan.billingPeriod === 'YEARLY' ? 'yearly' : 'monthly',
    billingPeriodMultiplier: plan.billingPeriodMultiplier,
    stripePriceId: plan.stripePriceId,
    features: plan.features,
    limits: {
      stores: plan.maxStores,
      staff: plan.maxStaff,
      cards: plan.maxCards,
      transactions: plan.maxTransactions
    },
    cardAllowance: plan.cardAllowance,
    allowCardOrdering: plan.allowCardOrdering,
    isActive: plan.isActive,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt
  }));

  res.json({ plans: formattedPlans });
}));

// Create plan (platform admin only)
router.post('/plans', auth, rbac(['platform_admin']), validate(createPlanSchema), asyncHandler(async (req: Request, res: Response) => {
  const { 
    name, 
    description, 
    priceMonthly, 
    billingPeriod, 
    stripePriceId, 
    features, 
    limits,
    cardAllowance = 0,
    allowCardOrdering = true 
  } = req.body;

  // Convert frontend billingPeriod to database format
  const dbBillingPeriod = billingPeriod === '3months' ? 'THREE_MONTHS' :
                         billingPeriod === '6months' ? 'SIX_MONTHS' :
                         billingPeriod === 'yearly' ? 'YEARLY' :
                         'MONTHLY';

  const billingPeriodMultiplier = {
    'monthly': 1,
    '3months': 3,
    '6months': 6,
    'yearly': 12
  }[billingPeriod as string] || 1;

  const newPlan = await prisma.plan.create({
    data: {
      name,
      description,
      priceMonthly,
      billingPeriod: dbBillingPeriod as any,
      billingPeriodMultiplier,
      stripePriceId,
      features: Array.isArray(features) ? features : [],
      maxStores: limits?.stores || -1,
      maxStaff: limits?.staff || -1,
      maxCards: limits?.cards || -1,
      maxTransactions: limits?.transactions || -1,
      cardAllowance,
      allowCardOrdering,
    }
  });

  // Convert back to frontend format
  const formattedPlan = {
    id: newPlan.id,
    name: newPlan.name,
    description: newPlan.description,
    priceMonthly: newPlan.priceMonthly,
    billingPeriod: newPlan.billingPeriod === 'THREE_MONTHS' ? '3months' : 
                   newPlan.billingPeriod === 'SIX_MONTHS' ? '6months' :
                   newPlan.billingPeriod === 'YEARLY' ? 'yearly' : 'monthly',
    billingPeriodMultiplier: newPlan.billingPeriodMultiplier,
    stripePriceId: newPlan.stripePriceId,
    features: newPlan.features,
    limits: {
      stores: newPlan.maxStores,
      staff: newPlan.maxStaff,
      cards: newPlan.maxCards,
      transactions: newPlan.maxTransactions
    },
    cardAllowance: newPlan.cardAllowance,
    allowCardOrdering: newPlan.allowCardOrdering,
    isActive: newPlan.isActive,
    createdAt: newPlan.createdAt,
    updatedAt: newPlan.updatedAt
  };

  res.status(201).json({ plan: formattedPlan });
}));

// Update plan (platform admin only)
router.put('/plans/:id', auth, rbac(['platform_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { 
    name, 
    description, 
    priceMonthly, 
    billingPeriod, 
    stripePriceId, 
    features, 
    limits,
    cardAllowance,
    allowCardOrdering,
    isActive 
  } = req.body;

  // Convert frontend billingPeriod to database format
  const dbBillingPeriod = billingPeriod === '3months' ? 'THREE_MONTHS' :
                         billingPeriod === '6months' ? 'SIX_MONTHS' :
                         billingPeriod === 'yearly' ? 'YEARLY' :
                         'MONTHLY';

  const billingPeriodMultiplier = {
    'monthly': 1,
    '3months': 3,
    '6months': 6,
    'yearly': 12
  }[billingPeriod as string] || 1;

  if (!id) {
    res.status(400).json({ error: 'Plan ID is required' });
    return;
  }

  const updatedPlan = await prisma.plan.update({
    where: { id },
    data: {
      name,
      description,
      priceMonthly: parseInt(priceMonthly),
      billingPeriod: dbBillingPeriod as any,
      billingPeriodMultiplier,
      stripePriceId,
      features: Array.isArray(features) ? features : [],
      maxStores: parseInt(limits?.stores) || -1,
      maxStaff: parseInt(limits?.staff) || -1,
      maxCards: parseInt(limits?.cards) || -1,
      maxTransactions: parseInt(limits?.transactions) || -1,
      cardAllowance: parseInt(cardAllowance) || 0,
      allowCardOrdering: Boolean(allowCardOrdering),
      isActive: Boolean(isActive)
    }
  });

  // Convert back to frontend format
  const formattedPlan = {
    id: updatedPlan.id,
    name: updatedPlan.name,
    description: updatedPlan.description,
    priceMonthly: updatedPlan.priceMonthly,
    billingPeriod: updatedPlan.billingPeriod === 'THREE_MONTHS' ? '3months' : 
                   updatedPlan.billingPeriod === 'SIX_MONTHS' ? '6months' :
                   updatedPlan.billingPeriod === 'YEARLY' ? 'yearly' : 'monthly',
    billingPeriodMultiplier: updatedPlan.billingPeriodMultiplier,
    stripePriceId: updatedPlan.stripePriceId,
    features: updatedPlan.features,
    limits: {
      stores: updatedPlan.maxStores,
      staff: updatedPlan.maxStaff,
      cards: updatedPlan.maxCards,
      transactions: updatedPlan.maxTransactions
    },
    cardAllowance: updatedPlan.cardAllowance,
    allowCardOrdering: updatedPlan.allowCardOrdering,
    isActive: updatedPlan.isActive,
    createdAt: updatedPlan.createdAt,
    updatedAt: updatedPlan.updatedAt
  };

  res.json({ plan: formattedPlan });
}));

// Delete plan (platform admin only)
router.delete('/plans/:id', auth, rbac(['platform_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    res.status(400).json({ error: 'Plan ID is required' });
    return;
  }

  // Check if any tenants are using this plan
  const tenantsUsingPlan = await prisma.tenant.count({
    where: { planId: id }
  });

  if (tenantsUsingPlan > 0) {
    res.status(400).json({ 
      error: 'Cannot delete plan', 
      message: `${tenantsUsingPlan} tenant(s) are currently using this plan`
    });
    return;
  }

  await prisma.plan.delete({ where: { id } });
  
  res.status(204).send();
}));

// Get platform card orders (all orders across tenants)
router.get('/card-orders', auth, rbac(['platform_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 20, status, search } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const where: any = {};
  if (status) {
    where.status = status;
  }
  if (search) {
    where.OR = [
      { tenant: { name: { contains: search as string, mode: 'insensitive' } } },
      { tenant: { slug: { contains: search as string, mode: 'insensitive' } } }
    ];
  }

  const [orders, total] = await Promise.all([
    prisma.cardOrder.findMany({
      where,
      skip,
      take: Number(limit),
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.cardOrder.count({ where })
  ]);

  res.json({
    orders,
    pagination: {
      total,
      pages: Math.ceil(total / Number(limit)),
      currentPage: Number(page),
      limit: Number(limit)
    }
  });
}));

export default router;
