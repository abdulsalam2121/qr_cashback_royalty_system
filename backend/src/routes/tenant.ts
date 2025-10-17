import express from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { auth } from '../middleware/auth.js';
import { rbac } from '../middleware/rbac.js';
import { resolveTenant } from '../middleware/tenant.js';
import { CardLimitService } from '../services/cardLimitService.js';

const router = express.Router();
const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });

const subscribeSchema = z.object({
  planId: z.string(),
  paymentMethodId: z.string().optional()
});

const addFundsSchema = z.object({
  customerId: z.string(),
  amountCents: z.number().int().min(100).max(100000), // $1 to $1000
});

// Get tenant info
router.get('/:tenantSlug/tenant', resolveTenant, auth, rbac(['tenant_admin', 'cashier']), asyncHandler(async (req: Request, res: Response) => {
  const { tenantSlug } = req.params as { tenantSlug: string };

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    include: {
      plan: true,
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

  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }

  // Include card balance information for all tenants
  let cardBalance = null;
  let subscriptionInfo = null;
  
  try {
    const { CardLimitService } = await import('../services/cardLimitService.js');
    cardBalance = await CardLimitService.getCardBalance(tenant.id);
    
    // Get current card count
    const currentCardCount = await prisma.card.count({
      where: { tenantId: tenant.id }
    });
    
    subscriptionInfo = {
      status: tenant.subscriptionStatus,
      isActive: tenant.subscriptionStatus === 'ACTIVE',
      isTrial: tenant.subscriptionStatus === 'TRIALING',
      planId: tenant.planId,
      planName: tenant.plan?.name || null,
      
      // Card limits based on subscription status
      cardLimit: tenant.subscriptionStatus === 'ACTIVE' 
        ? tenant.subscriptionCardLimit 
        : tenant.freeTrialLimit,
      
      // Cards used calculation - use subscription counter for active subs
      cardsUsed: tenant.subscriptionStatus === 'ACTIVE' 
        ? tenant.subscriptionCardsUsed 
        : currentCardCount,
      
      // Cards remaining calculation
      cardsRemaining: tenant.subscriptionStatus === 'ACTIVE'
        ? Math.max(0, tenant.subscriptionCardLimit - tenant.subscriptionCardsUsed)
        : Math.max(0, tenant.freeTrialLimit - currentCardCount),
      
      // Over-limit scenarios (mainly for downgrades)
      isOverLimit: tenant.subscriptionStatus === 'ACTIVE' && tenant.subscriptionCardsUsed > tenant.subscriptionCardLimit,
      overageAmount: tenant.subscriptionStatus === 'ACTIVE' 
        ? Math.max(0, tenant.subscriptionCardsUsed - tenant.subscriptionCardLimit) 
        : 0,
      
      // Additional metadata
      subscriptionStartDate: tenant.subscriptionStartDate,
      showUpgradePrompt: tenant.subscriptionStatus !== 'ACTIVE' && currentCardCount >= tenant.freeTrialLimit * 0.8,
      
      // Previous plan tracking for transitions
      previousPlanId: tenant.previousPlanId,
      previousPlanName: tenant.previousPlanId ? 'Previous Plan' : null, // Could be enhanced with actual previous plan lookup
      
      // Real-time card count for verification
      totalCardsCreated: currentCardCount,
      
      // Grace period info
      graceEndsAt: tenant.graceEndsAt,
      
      // Transition type
      transitionType: tenant.subscriptionStartDate ? 
        (new Date().getTime() - new Date(tenant.subscriptionStartDate).getTime() < 24 * 60 * 60 * 1000 ? 'recent' : 'established') 
        : null
    };
  } catch (error) {
    console.error('Failed to get card balance:', error);
  }

  res.json({ 
    tenant: {
      ...tenant,
      cardBalance,
      subscriptionInfo
    }
  });
  return;
}));

// Subscribe to plan
router.post('/:tenantSlug/billing/subscribe', resolveTenant, auth, rbac(['tenant_admin']), validate(subscribeSchema), asyncHandler(async (req: Request, res: Response) => {
  const { tenantSlug } = req.params as { tenantSlug: string };
  const { planId, paymentMethodId } = req.body;
  const { tenantId } = req.user;

  // Get the tenant and plan
  const [tenant, plan] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId }
    }),
    prisma.plan.findUnique({
      where: { id: planId, isActive: true }
    })
  ]);

  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }

  if (!plan) {
    res.status(404).json({ error: 'Plan not found or inactive' });
    return;
  }

  // Check if we have valid Stripe configuration
  const hasStripeConfig = !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY);
  const isValidStripeKey = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') || process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_');
  
  if (!hasStripeConfig || !isValidStripeKey) {
    res.status(500).json({ 
      error: 'Payment processing not configured', 
      details: 'Stripe configuration is required for subscriptions' 
    });
    return;
  }

  if (!plan.stripePriceId || plan.stripePriceId.startsWith('price_demo')) {
    res.status(400).json({ 
      error: 'Invalid plan configuration', 
      details: 'This plan does not have valid pricing configured' 
    });
    return;
  }

  // Require payment method for all subscriptions
  if (!paymentMethodId) {
    res.status(400).json({ 
      error: 'Payment method required', 
      details: 'A payment method must be selected to create a subscription',
      requirePaymentMethod: true
    });
    return;
  }

  try {
    // Ensure we have a Stripe customer
    let customerId = tenant.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: `admin@${tenant.slug}.localhost`,
        metadata: {
          tenantId: tenant.id,
          tenantSlug: tenant.slug
        }
      });
      customerId = customer.id;
      
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { stripeCustomerId: customerId }
      });
    }

    // Ensure the payment method belongs to this customer
    try {
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      
      // If payment method is not attached to any customer, attach it to ours
      if (!paymentMethod.customer) {
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: customerId,
        });
      } 
      // If payment method is attached to a different customer, return error
      else if (paymentMethod.customer !== customerId) {
        res.status(400).json({ 
          error: 'Payment method mismatch', 
          details: 'The selected payment method belongs to a different customer. Please select another payment method or add a new one.'
        });
        return;
      }
    } catch (attachError: any) {
      console.error('Payment method attachment error:', attachError);
      res.status(400).json({ 
        error: 'Payment method processing failed', 
        details: 'Unable to process the selected payment method. Please try adding a new payment method.'
      });
      return;
    }

    // Create subscription with the specified payment method
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: plan.stripePriceId }],
      payment_behavior: 'default_incomplete',
      default_payment_method: paymentMethodId,
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        tenantId: tenant.id,
        planId: plan.id,
        maxCards: plan.maxCards.toString(),
        cardAllowance: (plan as any).cardAllowance?.toString() || '0',
      }
    });

    // Professional Subscription Management System
    await prisma.$transaction(async (tx) => {
      // Get current tenant state with previous plan details
      const currentTenant = await tx.tenant.findUnique({
        where: { id: tenant.id },
        include: { plan: true }
      });

      if (!currentTenant) {
        throw new Error('Tenant not found during transaction');
      }

      // Get current card count for accurate calculations
      const currentCardCount = await tx.card.count({
        where: { tenantId: tenant.id }
      });

      // Determine subscription transition type
      const isFirstSubscription = !currentTenant.planId || currentTenant.subscriptionStatus === 'NONE' || currentTenant.subscriptionStatus === 'TRIALING';
      const isReactivation = currentTenant.subscriptionStatus === 'CANCELED';
      const isUpgrade = currentTenant.planId && currentTenant.plan && (currentTenant.plan as any).cardAllowance < (plan as any).cardAllowance;
      const isDowngrade = currentTenant.planId && currentTenant.plan && (currentTenant.plan as any).cardAllowance > (plan as any).cardAllowance;
      const isRenewal = currentTenant.planId === plan.id;
      const previousPlan = currentTenant.plan;

      // Professional subscription transition logic
      const planCardAllowance = (plan as any).cardAllowance || plan.maxCards || 0;
      let subscriptionCardLimit = planCardAllowance;
      let subscriptionCardsUsed = 0;
      let transitionDescription = '';

      if (process.env.NODE_ENV !== 'production') {
      }

      if (isFirstSubscription) {
        // Scenario 1: New subscription (including trial to subscription)
        subscriptionCardsUsed = 0; // Reset usage for new subscription
        transitionDescription = `New subscription to ${plan.name} plan`;
      } else if (isReactivation) {
        // Scenario 2: Reactivation - resume with last known usage
        subscriptionCardsUsed = currentTenant.subscriptionCardsUsed || 0;
        transitionDescription = `Subscription reactivated to ${plan.name} plan`;
      } else if (isUpgrade) {
        // Scenario 3: Upgrade - reset usage, apply new higher limit
        subscriptionCardsUsed = 0; // Reset usage on upgrade
        transitionDescription = `Upgraded to ${plan.name} plan - usage reset`;
      } else if (isDowngrade) {
        // Scenario 4: Downgrade - preserve existing cards, adjust limits
        subscriptionCardsUsed = Math.min(currentTenant.subscriptionCardsUsed || 0, planCardAllowance);
        transitionDescription = `Downgraded to ${plan.name} plan - existing cards preserved`;
      } else if (isRenewal) {
        // Scenario 5: Same plan renewal - extend subscription, keep usage
        subscriptionCardsUsed = currentTenant.subscriptionCardsUsed || 0;
        transitionDescription = `${plan.name} plan renewed`;
      } else {
        // Default case - lateral move or unknown transition
        subscriptionCardsUsed = currentTenant.subscriptionCardsUsed || 0;
        transitionDescription = `Plan changed to ${plan.name}`;
      }

      // Update tenant with comprehensive subscription data
      await tx.tenant.update({
        where: { id: tenant.id },
        data: { 
          planId: plan.id,
          subscriptionStatus: 'ACTIVE',
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          subscriptionCardLimit: subscriptionCardLimit,
          subscriptionCardsUsed: subscriptionCardsUsed,
          subscriptionStartDate: new Date(),
          // Store previous plan for reference
          previousPlanId: previousPlan?.id || null
        }
      });

      // Create card limit transaction for audit trail
      if (subscriptionCardLimit > 0) {
        await tx.cardLimitTransaction.create({
          data: {
            tenantId: tenant.id,
            type: 'GRANTED',
            source: 'SUBSCRIPTION_UPGRADE',
            amount: subscriptionCardLimit,
            previousBalance: 0,
            newBalance: subscriptionCardLimit,
            description: transitionDescription,
            relatedPlanId: plan.id,
            createdBy: 'subscription-creation'
          }
        });
      }

      // Record the payment with transition context
      const invoiceId = typeof subscription.latest_invoice === 'object' 
        ? subscription.latest_invoice?.id 
        : subscription.latest_invoice;
        
      await tx.payment.create({
        data: {
          tenantId: tenant.id,
          planId: plan.id,
          stripeSubscriptionId: subscription.id,
          stripeInvoiceId: invoiceId || null,
          amount: plan.priceMonthly,
          currency: 'usd',
          status: 'paid',
          description: `Subscription: ${transitionDescription}`,
          metadata: JSON.stringify({
            subscriptionCreated: true,
            planName: plan.name,
            tenantSlug: tenant.slug,
            paymentMethodId,
            transitionType: isFirstSubscription ? 'new' : isUpgrade ? 'upgrade' : isDowngrade ? 'downgrade' : isRenewal ? 'renewal' : 'reactivation',
            previousPlan: previousPlan?.name || null,
            currentCardCount,
            subscriptionCardLimit,
            subscriptionCardsUsed
          })
        }
      });

      // Record comprehensive subscription event
      await tx.subscriptionEvent.create({
        data: {
          tenantId: tenant.id,
          planId: plan.id,
          previousPlanId: previousPlan?.id || null,
          eventType: isFirstSubscription ? 'created' : 
                   isUpgrade ? 'upgraded' : 
                   isDowngrade ? 'downgraded' : 
                   isRenewal ? 'renewed' : 
                   isReactivation ? 'reactivated' : 'modified',
          stripeSubscriptionId: subscription.id,
          metadata: JSON.stringify({
            planName: plan.name,
            previousPlanName: previousPlan?.name || null,
            amount: plan.priceMonthly,
            currency: 'usd',
            paymentMethodId,
            transitionDetails: {
              type: isFirstSubscription ? 'new' : isUpgrade ? 'upgrade' : isDowngrade ? 'downgrade' : isRenewal ? 'renewal' : 'reactivation',
              currentCardCount,
              newCardLimit: subscriptionCardLimit,
              newCardBalance: subscriptionCardLimit - subscriptionCardsUsed,
              previousCardLimit: previousPlan?.maxCards || 0,
              isOverLimit: currentCardCount > plan.maxCards,
              description: transitionDescription
            }
          })
        }
      });

      // Create detailed card limit transaction for audit trail
      await tx.cardLimitTransaction.create({
        data: {
          tenantId: tenant.id,
          type: 'GRANTED',
          source: 'SUBSCRIPTION_UPGRADE', // Use available enum value for all subscription changes
          amount: subscriptionCardLimit,
          previousBalance: currentTenant.currentCardBalance || 0,
          newBalance: subscriptionCardLimit,
          description: transitionDescription,
          relatedPlanId: plan.id,
          createdBy: null
        }
      });

      // Create warning record for downgrades with overage
      if (isDowngrade && currentCardCount > plan.maxCards) {
        await tx.cardLimitTransaction.create({
          data: {
            tenantId: tenant.id,
            type: 'USED', // Represents the overage
            source: 'MANUAL_ADJUSTMENT', // Use available enum value for downgrades
            amount: 0, // No balance change, just a warning record
            previousBalance: subscriptionCardLimit,
            newBalance: subscriptionCardLimit,
            description: `⚠️ DOWNGRADE OVERAGE WARNING: You have ${currentCardCount} cards but your new ${plan.name} plan only allows ${plan.maxCards}. Your existing cards will continue to work normally, but you cannot create new cards until you're under the ${plan.maxCards} card limit.`,
            relatedPlanId: plan.id,
            createdBy: null
          }
        });
      }
    });

    res.json({ 
      message: 'Subscription created successfully',
      subscriptionId: subscription.id,
      redirectUrl: `${process.env.FRONTEND_URL}/t/${tenantSlug}/billing?updated=true&success=true`
    });
    return;
  } catch (error: any) {
    console.error('Payment processing failed:', error);
    
    // Detailed error handling
    if (error.message?.includes('No such price')) {
      res.status(400).json({ 
        error: 'Invalid plan configuration', 
        details: 'The selected plan has an invalid Stripe price configuration.'
      });
    } else if (error.message?.includes('No such payment_method')) {
      res.status(400).json({ 
        error: 'Invalid payment method', 
        details: 'The selected payment method is no longer valid. Please select another payment method.'
      });
    } else if (error.message?.includes('customer')) {
      res.status(400).json({ 
        error: 'Customer processing failed', 
        details: error.message
      });
    } else {
      res.status(400).json({ 
        error: 'Payment failed', 
        details: error.message || 'An unexpected error occurred during payment processing.'
      });
    }
    return;
  }
}));

// Get billing portal
router.get('/:tenantSlug/billing/portal', resolveTenant, auth, rbac(['tenant_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { tenantSlug } = req.params as { tenantSlug: string };
  const { tenantId } = req.user;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }
  });

  if (!tenant || !tenant.stripeCustomerId) {
    res.status(400).json({ error: 'No billing information found' });
    return;
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/t/${tenantSlug}/billing`,
    });

    res.json({ portalUrl: session.url });
    return;
  } catch (error) {
    console.error('Stripe error:', error);
    res.status(500).json({ error: 'Failed to create billing portal session' });
    return;
  }
}));

// Get payment methods
router.get('/:tenantSlug/billing/payment-methods', resolveTenant, auth, rbac(['tenant_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = req.user;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }
  });

  if (!tenant) {
    res.json({ paymentMethods: [] });
    return;
  }

  // If no Stripe customer ID or it's a demo ID, return empty array
  if (!tenant.stripeCustomerId || tenant.stripeCustomerId.startsWith('demo_customer_')) {
    res.json({ paymentMethods: [] });
    return;
  }

  try {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: tenant.stripeCustomerId,
      type: 'card',
    });

    res.json({ paymentMethods: paymentMethods.data });
    return;
  } catch (error) {
    console.error('Stripe error:', error);
    res.json({ paymentMethods: [] }); // Return empty instead of error for better UX
    return;
  }
}));

// Create setup intent for adding payment method
router.post('/:tenantSlug/billing/setup-intent', resolveTenant, auth, rbac(['tenant_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { tenantSlug } = req.params as { tenantSlug: string };
  const { tenantId } = req.user;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }
  });

  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }

  // Check if we have valid Stripe configuration
  const hasStripeConfig = !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY);
  const isValidStripeKey = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') || process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_');
  
  if (!hasStripeConfig || !isValidStripeKey) {
    if (process.env.NODE_ENV !== 'production') {
    }
    
    // Return a demo setup intent for testing
    res.json({ 
      clientSecret: 'pi_demo_setup_intent_for_testing',
      setupIntentId: 'si_demo_setup_intent',
      demo: true,
      message: 'Demo mode: No real payment processing'
    });
    return;
  }

  try {
    let customerId = tenant.stripeCustomerId;

    // Check if this is a demo customer ID that doesn't exist in Stripe
    if (customerId && customerId.startsWith('demo_customer_')) {
      if (process.env.NODE_ENV !== 'production') {
      }
      customerId = null;
      
      // Clear the demo customer ID from the database
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { stripeCustomerId: null }
      });
    }

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customerParams: any = {
        email: req.user.email,
        metadata: {
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
        },
      };
      
      if (tenant.name) {
        customerParams.name = tenant.name;
      }
      
      const customer = await stripe.customers.create(customerParams);
      
      customerId = customer.id;
      
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { stripeCustomerId: customerId }
      });
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
      metadata: {
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
      },
    });

    res.json({ 
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id 
    });
    return;
  } catch (error: any) {
    console.error('Stripe setup intent error:', error);
    
    // Detailed error handling
    if (error.type === 'StripeInvalidRequestError') {
      res.status(400).json({ 
        error: 'Invalid Stripe configuration',
        details: error.message,
        suggestion: 'Please check your Stripe API keys'
      });
    } else if (error.type === 'StripeAPIError') {
      res.status(503).json({ 
        error: 'Stripe service temporarily unavailable',
        details: error.message
      });
    } else if (error.type === 'StripeConnectionError') {
      res.status(503).json({ 
        error: 'Unable to connect to Stripe',
        details: 'Please check your internet connection'
      });
    } else if (error.type === 'StripeAuthenticationError') {
      res.status(401).json({ 
        error: 'Stripe authentication failed',
        details: 'Invalid Stripe API key',
        suggestion: 'Please verify your Stripe secret key'
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to create setup intent',
        details: error.message || 'Unknown error occurred'
      });
    }
    return;
  }
}));

// Delete payment method
router.delete('/:tenantSlug/billing/payment-methods/:paymentMethodId', resolveTenant, auth, rbac(['tenant_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { paymentMethodId } = req.params as { paymentMethodId: string };

  try {
    await stripe.paymentMethods.detach(paymentMethodId);
    res.json({ message: 'Payment method removed successfully' });
    return;
  } catch (error) {
    console.error('Stripe error:', error);
    res.status(500).json({ error: 'Failed to remove payment method' });
    return;
  }
}));

// Set default payment method
router.post('/:tenantSlug/billing/payment-methods/:paymentMethodId/set-default', resolveTenant, auth, rbac(['tenant_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { paymentMethodId } = req.params as { paymentMethodId: string };
  const { tenantId } = req.user;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }
  });

  if (!tenant || !tenant.stripeCustomerId) {
    res.status(404).json({ error: 'Tenant not found or no Stripe customer' });
    return;
  }

  try {
    await stripe.customers.update(tenant.stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    res.json({ message: 'Default payment method updated successfully' });
    return;
  } catch (error) {
    console.error('Stripe error:', error);
    res.status(500).json({ error: 'Failed to set default payment method' });
    return;
  }
}));

// Get invoices
router.get('/:tenantSlug/billing/invoices', resolveTenant, auth, rbac(['tenant_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = req.user;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }
  });

  if (!tenant) {
    res.json({ invoices: [] });
    return;
  }

  // If no Stripe customer ID or it's a demo ID, return empty array
  if (!tenant.stripeCustomerId || tenant.stripeCustomerId.startsWith('demo_customer_')) {
    res.json({ invoices: [] });
    return;
  }

  try {
    const invoices = await stripe.invoices.list({
      customer: tenant.stripeCustomerId,
      limit: 20,
    });

    res.json({ invoices: invoices.data });
    return;
  } catch (error) {
    console.error('Stripe error:', error);
    res.json({ invoices: [] }); // Return empty instead of error for better UX
    return;
  }
}));

// Get usage statistics
router.get('/:tenantSlug/billing/usage', resolveTenant, auth, rbac(['tenant_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = req.user;

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        plan: true,
        _count: {
          select: {
            stores: true,
            users: true,
            cards: true,
            transactions: true,
          }
        }
      }
    });

    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    // Calculate current billing period
    const now = new Date();
    const currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get current month transactions
    const currentMonthTransactions = await prisma.transaction.count({
      where: {
        tenantId,
        createdAt: {
          gte: currentPeriodStart,
          lte: currentPeriodEnd,
        }
      }
    });

    // Get card balance if subscription is active
    let cardBalance = null;
    if (tenant.subscriptionStatus === 'ACTIVE') {
      const { CardLimitService } = await import('../services/cardLimitService.js');
      cardBalance = await CardLimitService.getCardBalance(tenantId);
    }

    const usageStats = {
      currentPeriodStart: currentPeriodStart.toISOString(),
      currentPeriodEnd: currentPeriodEnd.toISOString(),
      cardsUsed: tenant._count.cards,
      cardsLimit: tenant.plan?.maxCards || -1,
      cardsRemaining: cardBalance?.currentBalance || 0,
      subscriptionCardsUsed: cardBalance?.subscriptionUsed || 0,
      subscriptionCardsLimit: cardBalance?.subscriptionLimit || 0,
      transactionsUsed: currentMonthTransactions,
      transactionsLimit: tenant.plan?.maxTransactions || -1,
      transactionsThisMonth: currentMonthTransactions,
      storesUsed: tenant._count.stores,
      storesLimit: tenant.plan?.maxStores || -1,
      staffUsed: tenant._count.users,
      staffLimit: tenant.plan?.maxStaff || -1,
    };

    res.json({ usage: usageStats });
    return;
  } catch (error) {
    console.error('Failed to fetch usage stats:', error);
    res.status(500).json({ error: 'Failed to fetch usage statistics' });
    return;
  }
}));

// Add funds to customer card
router.post('/:tenantSlug/customers/:customerId/add-funds', resolveTenant, auth, rbac(['tenant_admin', 'cashier']), validate(addFundsSchema), asyncHandler(async (req: Request, res: Response) => {
  const { tenantSlug, customerId } = req.params as { tenantSlug: string; customerId: string };
  const { amountCents } = req.body;
  const { tenantId } = req.user;

  // Get customer and their active card
  const customer = await prisma.customer.findFirst({
    where: { 
      id: customerId, 
      tenantId 
    },
    include: {
      cards: {
        where: { status: 'ACTIVE' },
        take: 1
      }
    }
  });

  if (!customer) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }

  if (!customer.cards.length) {
    res.status(400).json({ error: 'Customer does not have an active card' });
    return;
  }

  const card = customer.cards[0]!; // We know it exists due to the check above

  // Get or create Stripe customer for the tenant
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId }
  });

  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }

  try {
    let stripeCustomerId = tenant.stripeCustomerId;

    // Create Stripe customer if doesn't exist
    if (!stripeCustomerId) {
      const customerParams: any = {
        email: req.user.email,
        metadata: {
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
        },
      };
      
      if (tenant.name) {
        customerParams.name = tenant.name;
      }
      
      const stripeCustomer = await stripe.customers.create(customerParams);
      
      stripeCustomerId = stripeCustomer.id;
      
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { stripeCustomerId }
      });
    }

    // Create checkout session for adding funds
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Add Funds to ${customer.firstName} ${customer.lastName}'s Card`,
              description: `Card: ${card.cardUid} | Current Balance: $${(card.balanceCents / 100).toFixed(2)}`,
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/t/${tenantSlug}/customers/${customerId}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/t/${tenantSlug}/customers/${customerId}?payment=canceled`,
      metadata: {
        type: 'customer_funds',
        tenantId: tenant.id,
        customerId: customer.id,
        cardId: card.id,
        amountCents: amountCents.toString(),
      },
    });

    res.json({ checkoutUrl: session.url });
    return;
  } catch (error) {
    console.error('Stripe checkout error:', error);
    res.status(500).json({ error: 'Failed to create payment session. Please try again.' });
    return;
  }
}));

export default router;

