import express from 'express';
import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';
import { Request, Response } from 'express';

const router = express.Router();
const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });

// Stripe webhook endpoint - must be raw body for signature verification
router.post('/stripe', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('Stripe webhook secret not configured');
    res.status(400).send('Webhook secret not configured');
    return;
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('Received Stripe webhook event:', event.type);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        if (process.env.NODE_ENV !== 'production') {
          console.log(`Unhandled event type: ${event.type}`);
        }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  if (process.env.NODE_ENV !== 'production') {
    console.log('Processing checkout.session.completed');
  }

  const tenantId = session.metadata?.tenantId;
  const planId = session.metadata?.planId;
  const cardAllowance = parseInt(session.metadata?.cardAllowance || '0');

  if (!tenantId || !planId) {
    console.error('Missing tenant or plan metadata in checkout session');
    return;
  }

  // Check if this is a subscription or one-time payment
  if (session.mode === 'subscription' && session.subscription) {
    // Subscription will be handled by subscription.created webhook
    if (process.env.NODE_ENV !== 'production') {
      console.log('Subscription checkout completed, waiting for subscription.created webhook');
    }
  } else if (session.mode === 'payment') {
    // Handle one-time payments (like adding customer funds)
    const paymentType = session.metadata?.type;
    
    if (paymentType === 'customer_funds') {
      const customerId = session.metadata?.customerId;
      const cardId = session.metadata?.cardId;
      const amountCents = parseInt(session.metadata?.amountCents || '0');

      if (customerId && cardId && amountCents > 0) {
        await prisma.card.update({
          where: { id: cardId },
          data: { balanceCents: { increment: amountCents } }
        });

        if (process.env.NODE_ENV !== 'production') {
          console.log(`Added ${amountCents} cents to card for customer`);
        }
      }
    }
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  if (process.env.NODE_ENV !== 'production') {
    console.log('Processing customer.subscription.created');
  }

  const tenantId = subscription.metadata?.tenantId;
  const planId = subscription.metadata?.planId;
  const cardAllowance = parseInt(subscription.metadata?.cardAllowance || '0');

  if (!tenantId || !planId) {
    console.error('Missing tenant or plan metadata in subscription');
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Get current tenant and plan details
      const currentTenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        include: { plan: true }
      });

      const newPlan = await tx.plan.findUnique({
        where: { id: planId }
      });

      if (!currentTenant || !newPlan) {
        throw new Error('Tenant or plan not found');
      }

      // Get current card count for calculations
      const currentCardCount = await tx.card.count({
        where: { tenantId }
      });

      // Determine subscription scenario
      const isNewSubscription = !currentTenant.planId || currentTenant.subscriptionStatus === 'NONE';
      const isReactivation = currentTenant.subscriptionStatus === 'CANCELED';
      const previousPlanId = currentTenant.planId;

      if (process.env.NODE_ENV !== 'production') {
        console.log(`Subscription scenario: ${isNewSubscription ? 'NEW' : isReactivation ? 'REACTIVATION' : 'UPDATE'}`);
        console.log(`Current cards: ${currentCardCount}, New plan limit: ${cardAllowance}`);
      }

      // Calculate new subscription values
      let subscriptionCardsUsed = 0;
      let subscriptionCardLimit = cardAllowance;
      let transactionDescription = '';

      if (isNewSubscription) {
        // New subscription: reset usage, set limit
        subscriptionCardsUsed = 0;
        transactionDescription = `New subscription to ${newPlan.name} plan`;
      } else if (isReactivation) {
        // Reactivation: use last known usage or reset
        subscriptionCardsUsed = currentTenant.subscriptionCardsUsed || 0;
        transactionDescription = `Subscription reactivated to ${newPlan.name} plan`;
      } else {
        // Upgrade/downgrade: keep existing usage
        subscriptionCardsUsed = currentTenant.subscriptionCardsUsed || 0;
        transactionDescription = `Subscription updated to ${newPlan.name} plan`;
      }

      // Update tenant with comprehensive subscription data
      await tx.tenant.update({
        where: { id: tenantId },
        data: {
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: subscription.status === 'trialing' ? 'TRIALING' : 'ACTIVE',
          planId: planId,
          previousPlanId: previousPlanId,
          subscriptionCardLimit: subscriptionCardLimit,
          subscriptionCardsUsed: subscriptionCardsUsed,
          subscriptionStartDate: new Date(),
          trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        }
      });

      // Create card limit transaction for audit trail
      if (cardAllowance > 0) {
        await tx.cardLimitTransaction.create({
          data: {
            tenantId,
            type: 'GRANTED',
            source: 'SUBSCRIPTION_UPGRADE',
            amount: cardAllowance,
            previousBalance: currentTenant.currentCardBalance || 0,
            newBalance: (currentTenant.currentCardBalance || 0) + cardAllowance,
            description: transactionDescription,
            relatedPlanId: planId,
            createdBy: 'webhook-subscription-created'
          }
        });
      }

      // Record subscription event
      await tx.subscriptionEvent.create({
        data: {
          tenantId,
          planId,
          previousPlanId,
          eventType: isNewSubscription ? 'created' : isReactivation ? 'reactivated' : 'updated',
          stripeSubscriptionId: subscription.id,
          metadata: JSON.stringify({
            planName: newPlan.name,
            cardAllowance,
            currentCardCount,
            subscriptionCardsUsed,
            subscriptionCardLimit,
            transitionType: isNewSubscription ? 'new' : isReactivation ? 'reactivation' : 'update'
          })
        }
      });

      if (process.env.NODE_ENV !== 'production') {
        console.log(`Subscription created: ${transactionDescription}`);
        console.log(`Card limits: ${subscriptionCardsUsed}/${subscriptionCardLimit} used`);
      }
    });
  } catch (error) {
    console.error('Error processing subscription creation:', error);
    throw error;
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  if (process.env.NODE_ENV !== 'production') {
    console.log('Processing customer.subscription.updated');
  }

  const tenantId = subscription.metadata?.tenantId;
  const planId = subscription.metadata?.planId;
  const cardAllowance = parseInt(subscription.metadata?.cardAllowance || '0');

  if (!tenantId) {
    console.error('Missing tenant metadata in subscription');
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Get current tenant and plan details
      const currentTenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        include: { plan: true }
      });

      if (!currentTenant) {
        throw new Error('Tenant not found');
      }

      // Map Stripe subscription status to our enum
      let subscriptionStatus: 'NONE' | 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED';
      
      switch (subscription.status) {
        case 'trialing':
          subscriptionStatus = 'TRIALING';
          break;
        case 'active':
          subscriptionStatus = 'ACTIVE';
          break;
        case 'past_due':
          subscriptionStatus = 'PAST_DUE';
          break;
        case 'canceled':
        case 'unpaid':
          subscriptionStatus = 'CANCELED';
          break;
        default:
          subscriptionStatus = 'NONE';
      }

      // Get current card count for limit calculations
      const currentCardCount = await tx.card.count({
        where: { tenantId }
      });

      // Determine if this is a plan change
      const isPlanChange = planId && planId !== currentTenant.planId;
      const newPlan = planId ? await tx.plan.findUnique({ where: { id: planId } }) : null;

      let updateData: any = {
        subscriptionStatus,
        trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        graceEndsAt: subscription.status === 'past_due' && subscription.current_period_end 
          ? new Date((subscription.current_period_end + 7 * 24 * 60 * 60) * 1000) // 7 days grace period
          : null,
      };

      let eventType = 'updated';
      let transactionDescription = 'Subscription status updated';

      if (isPlanChange && newPlan) {
        // Handle plan changes (upgrade/downgrade)
        const isUpgrade = currentTenant.plan && newPlan.cardAllowance > (currentTenant.plan as any).cardAllowance;
        const isDowngrade = currentTenant.plan && newPlan.cardAllowance < (currentTenant.plan as any).cardAllowance;

        if (process.env.NODE_ENV !== 'production') {
          console.log(`Plan change detected: ${currentTenant.plan?.name} -> ${newPlan.name}`);
          console.log(`Card allowance change: ${(currentTenant.plan as any)?.cardAllowance || 0} -> ${cardAllowance}`);
        }

        if (isUpgrade) {
          // Upgrade: Reset usage, apply new limit
          updateData.planId = planId;
          updateData.previousPlanId = currentTenant.planId;
          updateData.subscriptionCardLimit = cardAllowance;
          updateData.subscriptionCardsUsed = 0;
          eventType = 'upgraded';
          transactionDescription = `Upgraded to ${newPlan.name} plan - usage reset`;
        } else if (isDowngrade) {
          // Downgrade: Keep existing cards, adjust limits
          updateData.planId = planId;
          updateData.previousPlanId = currentTenant.planId;
          updateData.subscriptionCardLimit = cardAllowance;
          // Keep existing usage, don't reset
          eventType = 'downgraded';
          transactionDescription = `Downgraded to ${newPlan.name} plan - existing cards preserved`;
        } else {
          // Same tier or lateral move
          updateData.planId = planId;
          updateData.previousPlanId = currentTenant.planId;
          updateData.subscriptionCardLimit = cardAllowance;
          transactionDescription = `Plan changed to ${newPlan.name}`;
        }

        // Create transaction record for plan changes
        if (cardAllowance !== (currentTenant.subscriptionCardLimit || 0)) {
          await tx.cardLimitTransaction.create({
            data: {
              tenantId,
              type: 'GRANTED',
              source: 'SUBSCRIPTION_UPGRADE',
              amount: cardAllowance - (currentTenant.subscriptionCardLimit || 0),
              previousBalance: currentTenant.currentCardBalance || 0,
              newBalance: (currentTenant.currentCardBalance || 0) + (cardAllowance - (currentTenant.subscriptionCardLimit || 0)),
              description: transactionDescription,
              relatedPlanId: planId,
              createdBy: 'webhook-subscription-updated'
            }
          });
        }
      } else if (subscriptionStatus === 'CANCELED') {
        // Handle cancellation
        eventType = 'cancelled';
        transactionDescription = 'Subscription cancelled';
      } else if (subscriptionStatus === 'ACTIVE' && currentTenant.subscriptionStatus === 'CANCELED') {
        // Handle reactivation
        eventType = 'reactivated';
        transactionDescription = 'Subscription reactivated';
      }

      // Update tenant
      await tx.tenant.update({
        where: { id: tenantId },
        data: updateData
      });

      // Record subscription event
      await tx.subscriptionEvent.create({
        data: {
          tenantId,
          planId: planId || currentTenant.planId || '',
          previousPlanId: isPlanChange ? currentTenant.planId : null,
          eventType,
          stripeSubscriptionId: subscription.id,
          metadata: JSON.stringify({
            subscriptionStatus,
            planName: newPlan?.name || currentTenant.plan?.name,
            previousPlanName: isPlanChange ? currentTenant.plan?.name : null,
            cardAllowance,
            currentCardCount,
            transitionType: eventType
          })
        }
      });

      if (process.env.NODE_ENV !== 'production') {
        console.log(`Subscription updated: ${transactionDescription}`);
      }
    });
  } catch (error) {
    console.error('Error processing subscription update:', error);
    throw error;
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  if (process.env.NODE_ENV !== 'production') {
    console.log('Processing customer.subscription.deleted');
  }

  const tenantId = subscription.metadata?.tenantId;

  if (!tenantId) {
    console.error('Missing tenant metadata in subscription');
    return;
  }

  try {
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionStatus: 'CANCELED',
        stripeSubscriptionId: null,
        trialEndsAt: null,
        graceEndsAt: null,
      }
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log(`Subscription canceled`);
    }
  } catch (error) {
    console.error('Error processing subscription deletion:', error);
    throw error;
  }
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  if (process.env.NODE_ENV !== 'production') {
    console.log('Processing invoice.payment_succeeded');
  }

  if (invoice.subscription) {
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    const tenantId = subscription.metadata?.tenantId;

    if (tenantId) {
      // Update tenant status to active if payment succeeded
      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          subscriptionStatus: 'ACTIVE',
          graceEndsAt: null, // Clear grace period
        }
      });

      if (process.env.NODE_ENV !== 'production') {
        console.log(`Payment succeeded, status set to ACTIVE`);
      }
    }
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  if (process.env.NODE_ENV !== 'production') {
    console.log('Processing invoice.payment_failed');
  }

  if (invoice.subscription) {
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
    const tenantId = subscription.metadata?.tenantId;

    if (tenantId) {
      // Set grace period (7 days from now)
      const graceEndsAt = new Date();
      graceEndsAt.setDate(graceEndsAt.getDate() + 7);

      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          subscriptionStatus: 'PAST_DUE',
          graceEndsAt,
        }
      });

      if (process.env.NODE_ENV !== 'production') {
        console.log(`Payment failed, grace period set until ${graceEndsAt}`);
      }
    }
  }
}

export default router;
