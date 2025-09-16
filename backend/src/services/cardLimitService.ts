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
   * Get current card balance for a tenant - UPDATED FOR NEW LOGIC
   */
  static async getCardBalance(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        subscriptionCardLimit: true,
        subscriptionCardsUsed: true,
        freeTrialLimit: true,
        freeTrialCardsCreated: true,
        subscriptionStatus: true,
      }
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    // Calculate current balances based on subscription status
    let currentBalance = 0;
    let totalAllowance = 0;

    if (tenant.subscriptionStatus === 'ACTIVE') {
      // For active subscriptions, use subscription limits
      currentBalance = Math.max(0, tenant.subscriptionCardLimit - tenant.subscriptionCardsUsed);
      totalAllowance = tenant.subscriptionCardLimit;
    } else {
      // For trial/inactive subscriptions, use trial limits
      currentBalance = Math.max(0, tenant.freeTrialLimit - tenant.freeTrialCardsCreated);
      totalAllowance = tenant.freeTrialLimit;
    }

    return {
      currentBalance,
      totalAllowance,
      subscriptionLimit: tenant.subscriptionCardLimit,
      subscriptionUsed: tenant.subscriptionCardsUsed,
      subscriptionRemaining: Math.max(0, tenant.subscriptionCardLimit - tenant.subscriptionCardsUsed),
      trialLimit: tenant.freeTrialLimit,
      trialUsed: tenant.freeTrialCardsCreated,
      trialRemaining: Math.max(0, tenant.freeTrialLimit - tenant.freeTrialCardsCreated),
      isSubscriptionActive: tenant.subscriptionStatus === 'ACTIVE'
    };
  }

  /**
   * Update card balance and create audit trail - UPDATED FOR NEW LOGIC
   */
  static async updateCardBalance(update: CardLimitUpdate) {
    return await prisma.$transaction(async (tx) => {
      // Get current tenant data
      const tenant = await tx.tenant.findUnique({
        where: { id: update.tenantId },
        select: { 
          subscriptionCardLimit: true,
          subscriptionCardsUsed: true,
          freeTrialLimit: true,
          freeTrialCardsCreated: true,
          subscriptionStatus: true
        }
      });

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      // Calculate balances based on subscription status
      let previousBalance = 0;
      let newBalance = 0;
      let updateData: any = {};

      if (update.source === 'SUBSCRIPTION_UPGRADE' && update.type === 'USED') {
        // For subscription card usage
        previousBalance = tenant.subscriptionCardLimit - tenant.subscriptionCardsUsed;
        newBalance = previousBalance + update.amount; // amount is negative for USED
        
        if (newBalance < 0) {
          throw new Error('Insufficient subscription allowance');
        }

        updateData.subscriptionCardsUsed = { increment: Math.abs(update.amount) };
      } else if (update.source === 'TRIAL' && update.type === 'USED') {
        // For trial card usage
        previousBalance = tenant.freeTrialLimit - tenant.freeTrialCardsCreated;
        newBalance = previousBalance + update.amount; // amount is negative for USED
        
        if (newBalance < 0) {
          throw new Error('Insufficient trial allowance');
        }

        updateData.freeTrialCardsCreated = { increment: Math.abs(update.amount) };
      } else {
        // For other operations (GRANTED, REFUNDED), use previous logic
        const currentBalance = tenant.subscriptionStatus === 'ACTIVE' 
          ? tenant.subscriptionCardLimit - tenant.subscriptionCardsUsed
          : tenant.freeTrialLimit - tenant.freeTrialCardsCreated;
        
        previousBalance = currentBalance;
        newBalance = currentBalance + update.amount;
      }

      // Update tenant with changes
      if (Object.keys(updateData).length > 0) {
        await tx.tenant.update({
          where: { id: update.tenantId },
          data: updateData
        });
      }

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
   * Grant cards from subscription upgrade - UPDATED FOR NEW LOGIC
   */
  static async grantSubscriptionCards(
    tenantId: string, 
    planId: string, 
    cardAllowance: number, 
    createdBy?: string,
    isUpgrade: boolean = false
  ) {
    return await prisma.$transaction(async (tx) => {
      const currentTenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        include: { plan: true }
      });

      if (!currentTenant) {
        throw new Error('Tenant not found');
      }

      let subscriptionCardsUsed = 0;
      let transactionDescription = '';

      if (isUpgrade) {
        // On upgrade, reset usage counter to 0
        subscriptionCardsUsed = 0;
        transactionDescription = `Cards granted from subscription upgrade - usage reset`;
      } else {
        // On new subscription or reactivation, keep existing usage or start from 0
        subscriptionCardsUsed = currentTenant.subscriptionCardsUsed || 0;
        transactionDescription = `Cards granted from subscription plan`;
      }

      // Update tenant with new subscription card limit and usage
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          subscriptionCardLimit: cardAllowance,
          subscriptionCardsUsed: subscriptionCardsUsed
        }
      });

      // Create audit trail
      return await tx.cardLimitTransaction.create({
        data: {
          tenantId,
          type: 'GRANTED',
          source: 'SUBSCRIPTION_UPGRADE',
          amount: cardAllowance,
          previousBalance: currentTenant.subscriptionCardLimit || 0,
          newBalance: cardAllowance,
          description: transactionDescription,
          relatedPlanId: planId,
          createdBy: createdBy || null
        }
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
