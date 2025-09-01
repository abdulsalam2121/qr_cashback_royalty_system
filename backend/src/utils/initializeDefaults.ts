import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function initializeDefaultRules(tenantId: string) {
  try {
    // Create default cashback rules
    const defaultCashbackRules = [
      {
        tenantId,
        category: 'PURCHASE' as const,
        baseRateBps: 300, // 3%
        isActive: true,
      },
      {
        tenantId,
        category: 'REPAIR' as const,
        baseRateBps: 500, // 5%
        isActive: true,
      },
      {
        tenantId,
        category: 'OTHER' as const,
        baseRateBps: 200, // 2%
        isActive: true,
      },
    ];

    // Create default tier rules
    const defaultTierRules = [
      {
        tenantId,
        tier: 'SILVER' as const,
        name: 'Silver Member',
        minTotalSpendCents: 0, // $0
        baseRateBps: 0, // 0% additional
        isActive: true,
      },
      {
        tenantId,
        tier: 'GOLD' as const,
        name: 'Gold Member',
        minTotalSpendCents: 10000, // $100
        baseRateBps: 100, // 1% additional
        isActive: true,
      },
      {
        tenantId,
        tier: 'PLATINUM' as const,
        name: 'Platinum Member',
        minTotalSpendCents: 50000, // $500
        baseRateBps: 200, // 2% additional
        isActive: true,
      },
    ];

    // Create cashback rules using upsert to avoid duplicates
    await Promise.all(
      defaultCashbackRules.map(rule =>
        prisma.cashbackRule.upsert({
          where: {
            tenantId_category: {
              tenantId: rule.tenantId,
              category: rule.category,
            },
          },
          create: rule,
          update: {}, // Don't update if already exists
        })
      )
    );

    // Create tier rules using upsert to avoid duplicates
    await Promise.all(
      defaultTierRules.map(rule =>
        prisma.tierRule.upsert({
          where: {
            tenantId_tier: {
              tenantId: rule.tenantId,
              tier: rule.tier,
            },
          },
          create: rule,
          update: {}, // Don't update if already exists
        })
      )
    );

    console.log(`Default rules initialized for tenant ${tenantId}`);
  } catch (error) {
    console.error('Failed to initialize default rules:', error);
    throw error;
  }
}
