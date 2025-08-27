import { PrismaClient, Tier } from '@prisma/client';
import { Decimal } from 'decimal.js';

export async function updateCustomerTier(
  customerId: string, 
  tenantId: string, 
  tx: any
): Promise<any> {
  const customer = await tx.customer.findUnique({
    where: { id: customerId }
  });

  if (!customer) {
    throw new Error('Customer not found');
  }

  const totalSpendCents = new Decimal(customer.totalSpend).mul(100).toNumber();

  // Get tier rules sorted by spending threshold
  const tierRules = await tx.tierRule.findMany({
    where: { tenantId, isActive: true },
    orderBy: { minTotalSpendCents: 'desc' }
  });

  let newTier: Tier = 'SILVER';
  
  for (const rule of tierRules) {
    if (totalSpendCents >= rule.minTotalSpendCents) {
      newTier = rule.tier as Tier;
      break;
    }
  }

  // Update customer tier if changed
  if (customer.tier !== newTier) {
    return await tx.customer.update({
      where: { id: customerId },
      data: { tier: newTier }
    });
  }

  return customer;
}

export async function calculateTierProgress(customer: any, tenantId: string, tx: any) {
  const currentSpendCents = new Decimal(customer.totalSpend).mul(100).toNumber();
  
  const tierRules = await tx.tierRule.findMany({
    where: { tenantId, isActive: true },
    orderBy: { minTotalSpendCents: 'asc' }
  });

  const currentTierRule = tierRules.find((rule: any) => rule.tier === customer.tier);
  const nextTierRule = tierRules.find((rule: any) => 
    rule.minTotalSpendCents > currentSpendCents &&
    rule.tier !== customer.tier
  );

  return {
    currentTier: customer.tier,
    currentSpend: currentSpendCents,
    currentTierMin: currentTierRule?.minTotalSpendCents || 0,
    nextTier: nextTierRule?.tier,
    nextTierMin: nextTierRule?.minTotalSpendCents,
    progressToNext: nextTierRule 
      ? Math.min(100, (currentSpendCents / nextTierRule.minTotalSpendCents) * 100)
      : 100,
    remainingToNext: nextTierRule 
      ? Math.max(0, nextTierRule.minTotalSpendCents - currentSpendCents)
      : 0,
  };
}