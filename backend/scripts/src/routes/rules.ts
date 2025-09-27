import express, { Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { auth } from '../middleware/auth.js';
import { rbac } from '../middleware/rbac.js';
import { initializeDefaultRules } from '../utils/initializeDefaults.js';

const router = express.Router();
const prisma = new PrismaClient();

// Initialize default rules endpoint
router.post('/initialize', auth, rbac(['tenant_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = req.user;

  try {
    await initializeDefaultRules(tenantId);
    
    // Fetch the newly created rules
    const [cashbackRules, tierRules] = await Promise.all([
      prisma.cashbackRule.findMany({
        where: { tenantId },
        orderBy: { category: 'asc' },
      }),
      prisma.tierRule.findMany({
        where: { tenantId },
        orderBy: { minTotalSpendCents: 'asc' },
      }),
    ]);

    res.json({ 
      message: 'Default rules initialized successfully',
      cashbackRules,
      tierRules
    });
  } catch (error) {
    console.error('Failed to initialize default rules:', error);
    res.status(500).json({ error: 'Failed to initialize default rules' });
  }
}));

const updateCashbackRulesSchema = z.object({
  rules: z.array(z.object({
    category: z.enum(['PURCHASE', 'REPAIR', 'OTHER']),
    baseRateBps: z.number().int().min(0).max(10000),
    isActive: z.boolean().optional(),
  }))
});

const updateTierRulesSchema = z.object({
  rules: z.array(z.object({
    tier: z.enum(['SILVER', 'GOLD', 'PLATINUM']),
    name: z.string(),
    minTotalSpendCents: z.number().int().min(0),
    baseRateBps: z.number().int().min(0).max(10000),
    isActive: z.boolean().optional(),
  }))
});

const createOfferSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  rateMultiplierBps: z.number().int().min(0).max(10000),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  isActive: z.boolean().optional(),
});

const updateOfferSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  rateMultiplierBps: z.number().int().min(0).max(10000).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
});

// Get cashback rules
router.get('/cashback', auth, rbac(['tenant_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = req.user;

  const rules = await prisma.cashbackRule.findMany({
    where: { tenantId },
    orderBy: { category: 'asc' },
  });

  res.json({ rules });
  return;
}));

// Update cashback rules
router.put('/cashback', auth, rbac(['tenant_admin']), validate(updateCashbackRulesSchema), asyncHandler(async (req: Request, res: Response) => {
  const { rules } = req.body;
  const { tenantId } = req.user;

  const updatedRules = await Promise.all(
    rules.map(async (rule: { category: 'PURCHASE' | 'REPAIR' | 'OTHER'; baseRateBps: number; isActive?: boolean }) => {
      return await prisma.cashbackRule.upsert({
        where: {
          tenantId_category: {
            tenantId,
            category: rule.category
          }
        },
        update: {
          baseRateBps: rule.baseRateBps,
          isActive: rule.isActive ?? true,
        },
        create: {
          tenantId,
          category: rule.category,
          baseRateBps: rule.baseRateBps,
          isActive: rule.isActive ?? true,
        },
      });
    })
  );

  res.json({ rules: updatedRules });
  return;
}));

// Get tier rules
router.get('/tiers', auth, rbac(['tenant_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = req.user;

  const rules = await prisma.tierRule.findMany({
    where: { tenantId },
    orderBy: { minTotalSpendCents: 'asc' },
  });

  res.json({ rules });
  return;
}));

// Update tier rules
router.put('/tiers', auth, rbac(['tenant_admin']), validate(updateTierRulesSchema), asyncHandler(async (req: Request, res: Response) => {
  const { rules } = req.body;
  const { tenantId } = req.user;

  const updatedRules = await Promise.all(
    rules.map(async (rule: { tier: 'SILVER' | 'GOLD' | 'PLATINUM'; name: string; minTotalSpendCents: number; baseRateBps: number; isActive?: boolean }) => {
      return await prisma.tierRule.upsert({
        where: {
          tenantId_tier: {
            tenantId,
            tier: rule.tier
          }
        },
        update: {
          name: rule.name,
          minTotalSpendCents: rule.minTotalSpendCents,
          baseRateBps: rule.baseRateBps,
          isActive: rule.isActive ?? true,
        },
        create: {
          tenantId,
          tier: rule.tier,
          name: rule.name,
          minTotalSpendCents: rule.minTotalSpendCents,
          baseRateBps: rule.baseRateBps,
          isActive: rule.isActive ?? true,
        },
      });
    })
  );

  res.json({ rules: updatedRules });
  return;
}));

// Get offers
router.get('/offers', auth, rbac(['tenant_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = req.user;

  const offers = await prisma.offer.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ offers });
  return;
}));

// Create offer
router.post('/offers', auth, rbac(['tenant_admin']), validate(createOfferSchema), asyncHandler(async (req: Request, res: Response) => {
  const { name, description, rateMultiplierBps, startAt, endAt, isActive } = req.body;
  const { tenantId } = req.user;

  const offer = await prisma.offer.create({
    data: {
      tenantId,
      name,
      description,
      rateMultiplierBps,
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      isActive: isActive ?? true,
    },
  });

  res.status(201).json({ offer });
  return;
}));

// Update offer
router.put('/offers/:id', auth, rbac(['tenant_admin']), validate(updateOfferSchema), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { tenantId } = req.user;
  const updateData = req.body;

  // Check if offer exists
  const existingOffer = await prisma.offer.findFirst({
    where: { id, tenantId }
  });

  if (!existingOffer) {
    res.status(404).json({ error: 'Offer not found' });
    return;
  }

  // Convert date strings to Date objects
  const processedData: any = { ...updateData };
  if (processedData.startAt) {
    processedData.startAt = new Date(processedData.startAt);
  }
  if (processedData.endAt) {
    processedData.endAt = new Date(processedData.endAt);
  }

  const offer = await prisma.offer.update({
    where: { id },
    data: processedData,
  });

  res.json({ offer });
  return;
}));

// Delete offer
router.delete('/offers/:id', auth, rbac(['tenant_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { tenantId } = req.user;

  // Check if offer exists
  const existingOffer = await prisma.offer.findFirst({
    where: { id, tenantId }
  });

  if (!existingOffer) {
    res.status(404).json({ error: 'Offer not found' });
    return;
  }

  await prisma.offer.delete({
    where: { id }
  });

  res.json({ message: 'Offer deleted successfully' });
  return;
}));

export default router;

