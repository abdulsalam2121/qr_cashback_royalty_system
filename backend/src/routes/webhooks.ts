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

  console.log('Received Stripe webhook event:', event.type);

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
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('Processing checkout.session.completed:', session.id);

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
    console.log('Subscription checkout completed, waiting for subscription.created webhook');
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

        console.log(`Added ${amountCents} cents to card ${cardId} for customer ${customerId}`);
      }
    }
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log('Processing customer.subscription.created:', subscription.id);

  const tenantId = subscription.metadata?.tenantId;
  const planId = subscription.metadata?.planId;
  const cardAllowance = parseInt(subscription.metadata?.cardAllowance || '0');

  if (!tenantId || !planId) {
    console.error('Missing tenant or plan metadata in subscription');
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Update tenant with subscription details
      const updatedTenant = await tx.tenant.update({
        where: { id: tenantId },
        data: {
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: subscription.status === 'trialing' ? 'TRIALING' : 'ACTIVE',
          planId: planId,
          trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        }
      });

      // Grant cards from subscription if applicable
      if (cardAllowance > 0) {
        const { CardLimitService } = await import('../services/cardLimitService.js');
        await CardLimitService.grantSubscriptionCards(tenantId, planId, cardAllowance);
        console.log(`Granted ${cardAllowance} cards to tenant ${tenantId}`);
      }

      console.log(`Subscription created for tenant ${tenantId}, status: ${subscription.status}`);
    });
  } catch (error) {
    console.error('Error processing subscription creation:', error);
    throw error;
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('Processing customer.subscription.updated:', subscription.id);

  const tenantId = subscription.metadata?.tenantId;

  if (!tenantId) {
    console.error('Missing tenant metadata in subscription');
    return;
  }

  try {
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

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionStatus,
        trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        graceEndsAt: subscription.status === 'past_due' && subscription.current_period_end 
          ? new Date((subscription.current_period_end + 7 * 24 * 60 * 60) * 1000) // 7 days grace period
          : null,
      }
    });

    console.log(`Subscription updated for tenant ${tenantId}, status: ${subscriptionStatus}`);
  } catch (error) {
    console.error('Error processing subscription update:', error);
    throw error;
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('Processing customer.subscription.deleted:', subscription.id);

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

    console.log(`Subscription canceled for tenant ${tenantId}`);
  } catch (error) {
    console.error('Error processing subscription deletion:', error);
    throw error;
  }
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('Processing invoice.payment_succeeded:', invoice.id);

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

      console.log(`Payment succeeded for tenant ${tenantId}, status set to ACTIVE`);
    }
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  console.log('Processing invoice.payment_failed:', invoice.id);

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

      console.log(`Payment failed for tenant ${tenantId}, grace period set until ${graceEndsAt}`);
    }
  }
}

export default router;
