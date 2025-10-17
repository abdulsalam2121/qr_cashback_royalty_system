import express from 'express';
import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { auth } from '../middleware/auth.js';
import { rbac } from '../middleware/rbac.js';

const router = express.Router();
const prisma = new PrismaClient();

// Add debugging middleware for admin routes
router.use((req, res, next) => {
  next();
});

// Test route
router.get('/test', (req, res) => {
  res.json({ message: 'Admin routes are working!', timestamp: new Date().toISOString() });
});

// Get subscription analytics
router.get('/analytics/subscriptions', auth, rbac(['platform_admin', 'tenant_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { timeframe = '30d' } = req.query;
  
  // Calculate date range
  const now = new Date();
  let startDate = new Date();
  
  switch (timeframe) {
    case '7d':
      startDate.setDate(now.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(now.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(now.getDate() - 90);
      break;
    case '1y':
      startDate.setFullYear(now.getFullYear() - 1);
      break;
    default:
      startDate.setDate(now.getDate() - 30);
  }

  const [
    totalRevenue,
    totalSubscriptions,
    activeSubscriptions,
    recentPayments,
    topPlans,
    subscriptionEvents
  ] = await Promise.all([
    // Total revenue
    prisma.payment.aggregate({
      where: {
        status: 'paid',
        createdAt: { gte: startDate }
      },
      _sum: { amount: true }
    }),
    
    // Total subscriptions created
    prisma.subscriptionEvent.count({
      where: {
        eventType: 'created',
        createdAt: { gte: startDate }
      }
    }),
    
    // Active subscriptions
    prisma.tenant.count({
      where: {
        subscriptionStatus: 'ACTIVE'
      }
    }),
    
    // Recent payments with tenant and plan info
    prisma.payment.findMany({
      where: {
        createdAt: { gte: startDate }
      },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true }
        },
        plan: {
          select: { id: true, name: true, priceMonthly: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    }),
    
    // Top performing plans
    prisma.payment.groupBy({
      by: ['planId'],
      where: {
        status: 'paid',
        createdAt: { gte: startDate }
      },
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 10
    }),
    
    // Recent subscription events
    prisma.subscriptionEvent.findMany({
      where: {
        createdAt: { gte: startDate }
      },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true }
        },
        plan: {
          select: { id: true, name: true, priceMonthly: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    })
  ]);

  // Generate revenue by day data
  const revenueByDay = [];
  const days = timeframe === '7d' ? 7 : timeframe === '30d' ? 30 : timeframe === '90d' ? 90 : 365;
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    
    const dayPayments = recentPayments.filter(payment => {
      const paymentDate = new Date(payment.createdAt);
      return paymentDate >= dayStart && paymentDate <= dayEnd && payment.status === 'paid';
    });
    
    revenueByDay.push({
      date: date.toISOString().split('T')[0],
      revenue: dayPayments.reduce((sum, payment) => sum + payment.amount, 0),
      payments: dayPayments.length
    });
  }

  // Get plan details for top plans
  const planIds = topPlans.map(p => p.planId);
  const planDetails = planIds.length > 0 ? await prisma.plan.findMany({
    where: { id: { in: planIds } },
    select: { id: true, name: true, priceMonthly: true }
  }) : [];

  const topPlansWithDetails = topPlans.map(planStat => {
    const plan = planDetails.find(p => p.id === planStat.planId);
    return {
      ...planStat,
      plan
    };
  });

  res.json({
    analytics: {
      totalRevenue: totalRevenue._sum.amount || 0,
      totalSubscriptions,
      activeSubscriptions,
      revenueByDay,
      topPlans: topPlansWithDetails,
      recentPayments,
      subscriptionEvents
    }
  });
}));

// Get detailed payment records
router.get('/payments', auth, rbac(['platform_admin', 'tenant_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 50, status, tenantId, planId } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  
  const where: any = {};
  if (status) where.status = status;
  if (tenantId) where.tenantId = tenantId;
  if (planId) where.planId = planId;

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        tenant: {
          select: { id: true, name: true, slug: true }
        },
        plan: {
          select: { id: true, name: true, priceMonthly: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit)
    }),
    prisma.payment.count({ where })
  ]);

  res.json({
    payments,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      limit: Number(limit)
    }
  });
}));

// Get subscription events
router.get('/subscription-events', auth, rbac(['platform_admin', 'tenant_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { page = 1, limit = 50, eventType, tenantId } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  
  const where: any = {};
  if (eventType) where.eventType = eventType;
  if (tenantId) where.tenantId = tenantId;

  const [events, total] = await Promise.all([
    prisma.subscriptionEvent.findMany({
      where,
      include: {
        tenant: {
          select: { id: true, name: true, slug: true }
        },
        plan: {
          select: { id: true, name: true, priceMonthly: true }
        },
        previousPlan: {
          select: { id: true, name: true, priceMonthly: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit)
    }),
    prisma.subscriptionEvent.count({ where })
  ]);

  res.json({
    events,
    pagination: {
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      limit: Number(limit)
    }
  });
}));

export default router;

