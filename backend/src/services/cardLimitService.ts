import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CardLimitUpdate {
  tenantId: string;
  amount: number;
  type: 'GRANTED' | 'USED' | 'REFUNDED' | 'EXPIRED';
  source: 'TRIAL' | 'SUBSCRIPTION_UPGRADE' | 'CARD_ORDER' | 'MANUAL_ADJUSTMENT';
  description?: string | null;
  relatedOrderId?: string | null;
  relatedPlanId?: string | null;
  createdBy?: string | null;
}

export class CardLimitService {
  /**
   * Get current card balance for a tenant
   */
  static async getCardBalance(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        currentCardBalance: true,
        totalCardAllowance: true,
        subscriptionCardLimit: true,
        subscriptionCardsUsed: true,
        freeTrialLimit: true,
        freeTrialCardsCreated: true,
      }
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    return {
      currentBalance: tenant.currentCardBalance,
      totalAllowance: tenant.totalCardAllowance,
      subscriptionLimit: tenant.subscriptionCardLimit,
      subscriptionUsed: tenant.subscriptionCardsUsed,
      trialLimit: tenant.freeTrialLimit,
      trialUsed: tenant.freeTrialCardsCreated,
      trialRemaining: tenant.freeTrialLimit - tenant.freeTrialCardsCreated,
      subscriptionRemaining: tenant.subscriptionCardLimit - tenant.subscriptionCardsUsed,
    };
  }

  /**
   * Update card balance and create audit trail
   */
  static async updateCardBalance(update: CardLimitUpdate) {
    return await prisma.$transaction(async (tx) => {
      // Get current tenant data
      const tenant = await tx.tenant.findUnique({
        where: { id: update.tenantId },
        select: { currentCardBalance: true }
      });

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      const previousBalance = tenant.currentCardBalance;
      const newBalance = previousBalance + update.amount;

      if (newBalance < 0) {
        throw new Error('Insufficient card balance');
      }

      // Update tenant balance
      await tx.tenant.update({
        where: { id: update.tenantId },
        data: { 
          currentCardBalance: newBalance,
          // Update subscription usage if this is a subscription-related transaction
          ...(update.source === 'CARD_ORDER' && update.type === 'USED' ? {
            subscriptionCardsUsed: { increment: Math.abs(update.amount) }
          } : {}),
          // Update trial usage if this is trial-related
          ...(update.source === 'TRIAL' && update.type === 'USED' ? {
            freeTrialCardsCreated: { increment: Math.abs(update.amount) }
          } : {})
        }
      });

      // Create audit trail
      const transaction = await tx.cardLimitTransaction.create({
        data: {
          tenantId: update.tenantId,
          type: update.type,
          source: update.source,
          amount: update.amount,
          previousBalance,
          newBalance,
          description: update.description ?? null,
          relatedOrderId: update.relatedOrderId ?? null,
          relatedPlanId: update.relatedPlanId ?? null,
          createdBy: update.createdBy ?? null,
        }
      });

      return {
        previousBalance,
        newBalance,
        transaction
      };
    });
  }

  /**
   * Grant cards from subscription upgrade
   */
  static async grantSubscriptionCards(
    tenantId: string, 
    planId: string, 
    cardAllowance: number, 
    createdBy?: string
  ) {
    return await prisma.$transaction(async (tx) => {
      // Update tenant with new subscription card limit
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          subscriptionCardLimit: cardAllowance,
          totalCardAllowance: { increment: cardAllowance },
          currentCardBalance: { increment: cardAllowance }
        }
      });

      // Create audit trail
      return await this.updateCardBalance({
        tenantId,
        amount: cardAllowance,
        type: 'GRANTED',
        source: 'SUBSCRIPTION_UPGRADE',
        description: `Cards granted from subscription plan upgrade`,
        relatedPlanId: planId,
        createdBy: createdBy || null
      });
    });
  }

  /**
   * Use cards for order (deduct from balance)
   */
  static async useCardsForOrder(
    tenantId: string,
    orderId: string,
    quantity: number,
    createdBy?: string
  ) {
    return await this.updateCardBalance({
      tenantId,
      amount: -quantity, // Negative to deduct
      type: 'USED',
      source: 'CARD_ORDER',
      description: `Cards used for order #${orderId}`,
      relatedOrderId: orderId,
      createdBy: createdBy || null
    });
  }

  /**
   * Refund cards from cancelled order
   */
  static async refundCardsFromOrder(
    tenantId: string,
    orderId: string,
    quantity: number,
    createdBy?: string
  ) {
    return await this.updateCardBalance({
      tenantId,
      amount: quantity, // Positive to add back
      type: 'REFUNDED',
      source: 'CARD_ORDER',
      description: `Cards refunded from cancelled order #${orderId}`,
      relatedOrderId: orderId,
      createdBy: createdBy ?? null
    });
  }

  /**
   * Check if tenant can order cards
   */
  static async canOrderCards(tenantId: string, quantity: number): Promise<{
    canOrder: boolean;
    reason?: string;
    availableBalance: number;
    hasActiveSubscription: boolean;
  }> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        currentCardBalance: true,
        subscriptionStatus: true,
        plan: {
          select: {
            allowCardOrdering: true
          }
        }
      }
    });

    if (!tenant) {
      return { canOrder: false, reason: 'Tenant not found', availableBalance: 0, hasActiveSubscription: false };
    }

    const hasActiveSubscription = tenant.subscriptionStatus === 'ACTIVE';
    const availableBalance = tenant.currentCardBalance;

    // Check if plan allows card ordering
    if (hasActiveSubscription && tenant.plan && !tenant.plan.allowCardOrdering) {
      return {
        canOrder: false,
        reason: 'Current subscription plan does not allow card ordering',
        availableBalance,
        hasActiveSubscription
      };
    }

    // Check if enough balance
    if (availableBalance < quantity) {
      return {
        canOrder: false,
        reason: `Insufficient card balance. You have ${availableBalance} cards available, but need ${quantity}`,
        availableBalance,
        hasActiveSubscription
      };
    }

    return {
      canOrder: true,
      availableBalance,
      hasActiveSubscription
    };
  }

  /**
   * Get card limit transaction history
   */
  static async getTransactionHistory(tenantId: string, limit = 50) {
    return await prisma.cardLimitTransaction.findMany({
      where: { tenantId },
      include: {
        relatedOrder: {
          select: {
            id: true,
            quantity: true,
            status: true,
            cardType: true
          }
        },
        relatedPlan: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  /**
   * Initialize card balance for new tenant
   */
  static async initializeTenantCardBalance(tenantId: string, trialLimit = 40) {
    return await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        freeTrialLimit: trialLimit,
        totalCardAllowance: trialLimit,
        currentCardBalance: trialLimit,
        subscriptionCardLimit: 0,
        subscriptionCardsUsed: 0
      }
    });
  }
}
