import express from 'express';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { asyncHandler } from '../middleware/asyncHandler.js';
const router = express.Router();
const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
// Stripe webhook handler
router.post('/webhook', express.raw({ type: 'application/json' }), asyncHandler(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    }
    catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }
    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                // Handle card order payments
                if (session.metadata?.orderId) {
                    await handleCardOrderPayment(session);
                }
                break;
            }
            case 'customer.subscription.created':
            case 'customer.subscription.updated': {
                const subscription = event.data.object;
                await updateTenantSubscription(subscription);
                break;
            }
            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                await prisma.tenant.updateMany({
                    where: { stripeSubscriptionId: subscription.id },
                    data: {
                        subscriptionStatus: 'CANCELED',
                        graceEndsAt: null,
                    }
                });
                break;
            }
            case 'invoice.payment_succeeded': {
                const invoice = event.data.object;
                if (invoice.subscription) {
                    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
                    await updateTenantSubscription(subscription);
                }
                break;
            }
            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                if (invoice.subscription) {
                    await prisma.tenant.updateMany({
                        where: { stripeSubscriptionId: invoice.subscription },
                        data: {
                            subscriptionStatus: 'PAST_DUE',
                            graceEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 day grace period
                        }
                    });
                }
                break;
            }
            case 'payment_intent.succeeded': {
                const paymentIntent = event.data.object;
                // Handle one-time payments (like card orders)
                if (paymentIntent.metadata?.orderId) {
                    await handleCardOrderPaymentIntent(paymentIntent);
                }
                break;
            }
            default:
                console.log(`Unhandled event type: ${event.type}`);
        }
        res.json({ received: true });
        return;
    }
    catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({ error: 'Webhook processing failed' });
        return;
    }
}));
// Handle card order payment completion
async function handleCardOrderPayment(session) {
    const orderId = session.metadata?.orderId;
    if (!orderId) {
        console.error('No order ID in session metadata');
        return;
    }
    try {
        await prisma.cardOrder.update({
            where: { id: orderId },
            data: {
                status: 'PENDING',
                stripeSessionId: session.id,
                stripePaymentId: session.payment_intent,
                paidAt: new Date(),
            }
        });
        console.log(`Card order ${orderId} payment confirmed`);
    }
    catch (error) {
        console.error(`Failed to update card order ${orderId}:`, error);
    }
}
// Handle payment intent for card orders
async function handleCardOrderPaymentIntent(paymentIntent) {
    const orderId = paymentIntent.metadata?.orderId;
    if (!orderId) {
        console.error('No order ID in payment intent metadata');
        return;
    }
    try {
        await prisma.cardOrder.update({
            where: { id: orderId },
            data: {
                status: 'PENDING',
                stripePaymentId: paymentIntent.id,
                paidAt: new Date(),
            }
        });
        console.log(`Card order ${orderId} payment intent succeeded`);
    }
    catch (error) {
        console.error(`Failed to update card order ${orderId}:`, error);
    }
}
async function updateTenantSubscription(subscription) {
    const status = mapStripeStatus(subscription.status);
    let trialEndsAt = null;
    if (subscription.trial_end) {
        trialEndsAt = new Date(subscription.trial_end * 1000);
    }
    await prisma.tenant.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: {
            subscriptionStatus: status,
            trialEndsAt,
            graceEndsAt: status === 'ACTIVE' ? null : null, // Clear grace period when active
        }
    });
}
function mapStripeStatus(stripeStatus) {
    switch (stripeStatus) {
        case 'trialing':
            return 'TRIALING';
        case 'active':
            return 'ACTIVE';
        case 'past_due':
            return 'PAST_DUE';
        case 'canceled':
        case 'unpaid':
            return 'CANCELED';
        default:
            return 'CANCELED';
    }
}
export default router;
//# sourceMappingURL=stripe.js.map