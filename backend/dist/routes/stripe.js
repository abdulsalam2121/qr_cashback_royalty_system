import express from 'express';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { Decimal } from 'decimal.js';
import { updateCustomerTier } from '../utils/tiers.js';
import { CustomerEmailService } from '../services/customerEmailService.js';
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
                // Handle customer fund additions
                else if (session.metadata?.type === 'customer_funds') {
                    await handleCustomerFundsPayment(session);
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
                // Get fresh payment intent from Stripe to ensure we have latest metadata
                let freshPaymentIntent = paymentIntent;
                try {
                    freshPaymentIntent = await stripe.paymentIntents.retrieve(paymentIntent.id);
                }
                catch (error) {
                    console.error('Failed to fetch fresh payment intent:', error);
                }
                // Handle one-time payments (like card orders)
                if (freshPaymentIntent.metadata?.orderId) {
                    await handleCardOrderPaymentIntent(freshPaymentIntent);
                }
                // Handle QR payment transactions
                else if (freshPaymentIntent.metadata?.paymentLinkId) {
                    await handlePurchaseTransactionPaymentIntent(freshPaymentIntent);
                }
                // Handle customer fund additions
                else if (freshPaymentIntent.metadata?.type === 'customer_funds') {
                    await handleCustomerFundsPaymentIntent(freshPaymentIntent);
                }
                else {
                    // Fallback: check if description contains "loyalty card"
                    if (freshPaymentIntent.description?.includes('loyalty card')) {
                        try {
                            await handleCustomerFundsPaymentIntent(freshPaymentIntent);
                        }
                        catch (error) {
                            console.error('Manual customer funds processing failed:', error);
                        }
                    }
                }
                break;
            }
            default:
                if (process.env.NODE_ENV !== 'production') {
                }
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
        if (process.env.NODE_ENV !== 'production') {
        }
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
        if (process.env.NODE_ENV !== 'production') {
        }
    }
    catch (error) {
        console.error(`Failed to update card order ${orderId}:`, error);
    }
}
// Handle payment intent for purchase transactions (QR payments)
async function handlePurchaseTransactionPaymentIntent(paymentIntent) {
    const paymentLinkId = paymentIntent.metadata?.paymentLinkId;
    if (!paymentLinkId) {
        console.error('No payment link ID in payment intent metadata');
        return;
    }
    try {
        await prisma.$transaction(async (tx) => {
            // Find the purchase transaction linked to this payment link
            const purchaseTransaction = await tx.purchaseTransaction.findFirst({
                where: {
                    paymentLinkId: paymentLinkId,
                    paymentStatus: 'PENDING'
                },
                include: {
                    customer: true
                }
            });
            if (!purchaseTransaction) {
                console.error(`No pending purchase transaction found for payment link ${paymentLinkId}`);
                return;
            }
            // Update purchase transaction status
            const updatedTransaction = await tx.purchaseTransaction.update({
                where: { id: purchaseTransaction.id },
                data: {
                    paymentStatus: 'COMPLETED',
                    paidAt: new Date(),
                }
            });
            // Mark payment link as used
            await tx.paymentLink.update({
                where: { id: paymentLinkId },
                data: { usedAt: new Date() }
            });
            // Check if this is a store credit transaction
            const isStoreCredit = updatedTransaction.description?.startsWith('STORE_CREDIT:');
            if (isStoreCredit) {
                // Handle store credit - add amount directly to card balance
                if (purchaseTransaction.cardUid) {
                    const card = await tx.card.findUnique({
                        where: { cardUid: purchaseTransaction.cardUid },
                        include: { customer: true }
                    });
                    if (card && card.customer) {
                        const beforeBalance = card.balanceCents;
                        const newBalance = beforeBalance + updatedTransaction.amountCents;
                        // Update card balance
                        await tx.card.update({
                            where: { id: card.id },
                            data: { balanceCents: newBalance }
                        });
                        // Create an ADJUST transaction record
                        await tx.transaction.create({
                            data: {
                                tenantId: purchaseTransaction.tenantId,
                                storeId: purchaseTransaction.storeId,
                                cardId: card.id,
                                customerId: card.customer.id,
                                cashierId: purchaseTransaction.cashierId,
                                type: 'ADJUST',
                                category: 'OTHER',
                                amountCents: updatedTransaction.amountCents,
                                cashbackCents: 0,
                                beforeBalanceCents: beforeBalance,
                                afterBalanceCents: newBalance,
                                note: `Store Credit via ${updatedTransaction.paymentMethod}: ${purchaseTransaction.id} (Stripe)`,
                            }
                        });
                    }
                }
            }
            else {
                // Process regular purchase with cashback if applicable
                if (purchaseTransaction.cardUid && purchaseTransaction.cashbackCents && purchaseTransaction.cashbackCents > 0) {
                    const card = await tx.card.findUnique({
                        where: { cardUid: purchaseTransaction.cardUid },
                        include: { customer: true }
                    });
                    if (card && card.customer) {
                        const newBalance = card.balanceCents + purchaseTransaction.cashbackCents;
                        // Update card balance
                        await tx.card.update({
                            where: { id: card.id },
                            data: { balanceCents: newBalance }
                        });
                        // Update customer total spend
                        const newTotalSpend = new Decimal(card.customer.totalSpend).add(new Decimal(purchaseTransaction.amountCents).div(100));
                        await tx.customer.update({
                            where: { id: card.customer.id },
                            data: { totalSpend: newTotalSpend }
                        });
                        // Create traditional cashback transaction record
                        await tx.transaction.create({
                            data: {
                                tenantId: purchaseTransaction.tenantId,
                                storeId: purchaseTransaction.storeId,
                                cardId: card.id,
                                customerId: card.customer.id,
                                cashierId: purchaseTransaction.cashierId,
                                type: 'EARN',
                                category: purchaseTransaction.category,
                                amountCents: purchaseTransaction.amountCents,
                                cashbackCents: purchaseTransaction.cashbackCents,
                                beforeBalanceCents: card.balanceCents,
                                afterBalanceCents: newBalance,
                                note: `Purchase transaction: ${purchaseTransaction.id} (Stripe Payment)`,
                            }
                        });
                        // Check for tier upgrade
                        await updateCustomerTier(card.customer.id, purchaseTransaction.tenantId, tx);
                    }
                }
            }
            if (process.env.NODE_ENV !== 'production') {
            }
        });
    }
    catch (error) {
        console.error(`Failed to process purchase transaction for payment link ${paymentLinkId}:`, error);
    }
}
// Handle customer funds payment completion
async function handleCustomerFundsPayment(session) {
    const metadata = session.metadata;
    if (!metadata?.customerId || !metadata?.cardId || !metadata?.amountCents) {
        console.error('Missing required metadata for customer funds payment');
        return;
    }
    try {
        const amountCents = parseInt(metadata.amountCents);
        const cardId = metadata.cardId;
        // Add funds to customer's card balance
        await prisma.$transaction(async (tx) => {
            const card = await tx.card.findUnique({
                where: { id: cardId },
                include: { customer: true }
            });
            if (!card || !card.customerId) {
                throw new Error(`Card ${cardId} not found or has no customer`);
            }
            const newBalance = card.balanceCents + amountCents;
            // Update card balance
            await tx.card.update({
                where: { id: card.id },
                data: { balanceCents: newBalance }
            });
            // Create transaction record
            await tx.transaction.create({
                data: {
                    type: 'EARN',
                    category: 'OTHER',
                    amountCents: amountCents,
                    cashbackCents: 0, // No cashback for adding funds
                    beforeBalanceCents: card.balanceCents,
                    afterBalanceCents: newBalance,
                    customerId: card.customerId,
                    cardId: card.id,
                    tenantId: card.tenantId,
                    storeId: card.storeId || card.tenantId, // Use the card's store or fallback to tenant
                    cashierId: card.customerId, // Use customer as cashier for system transactions
                    sourceIp: '127.0.0.1', // System
                    note: `Funds added via Stripe payment - Session: ${session.id}`,
                }
            });
        });
        if (process.env.NODE_ENV !== 'production') {
        }
    }
    catch (error) {
        console.error(`Failed to process customer funds payment for session ${session.id}:`, error);
    }
}
async function updateTenantSubscription(subscription) {
    const status = mapStripeStatus(subscription.status);
    let trialEndsAt = null;
    if (subscription.trial_end) {
        trialEndsAt = new Date(subscription.trial_end * 1000);
    }
    // Get plan ID from subscription metadata
    const planId = subscription.metadata?.planId;
    // Prepare update data
    const updateData = {
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: status,
        trialEndsAt,
        graceEndsAt: status === 'ACTIVE' ? null : null, // Clear grace period when active
    };
    // If we have a plan ID from metadata, update the plan
    if (planId) {
        // Verify the plan exists and is active
        const plan = await prisma.plan.findUnique({
            where: { id: planId, isActive: true }
        });
        if (plan) {
            updateData.planId = planId;
        }
    }
    // Update tenant using customer ID if subscription ID doesn't exist yet
    const tenant = await prisma.tenant.findFirst({
        where: {
            OR: [
                { stripeSubscriptionId: subscription.id },
                { stripeCustomerId: subscription.customer }
            ]
        }
    });
    if (tenant) {
        await prisma.tenant.update({
            where: { id: tenant.id },
            data: updateData
        });
        if (process.env.NODE_ENV !== 'production') {
        }
    }
    else {
        console.error(`No tenant found for subscription ${subscription.id} or customer ${subscription.customer}`);
    }
}
// Handle customer funds payment intent
async function handleCustomerFundsPaymentIntent(paymentIntent) {
    const { customerId, cardUid, tenantId } = paymentIntent.metadata;
    if (!customerId || !cardUid || !tenantId) {
        console.error('[WEBHOOK] Missing required metadata for customer funds payment:', paymentIntent.metadata);
        return;
    }
    try {
        const amountCents = paymentIntent.amount;
        await prisma.$transaction(async (tx) => {
            // Get current card balance
            const card = await tx.card.findUnique({
                where: { cardUid },
                select: { id: true, balanceCents: true }
            });
            if (!card) {
                console.error(`[WEBHOOK] Card not found for UID: ${cardUid}`);
                throw new Error('Card not found');
            }
            const beforeBalance = card.balanceCents;
            const afterBalance = beforeBalance + amountCents;
            // Update card balance
            await tx.card.update({
                where: { cardUid },
                data: { balanceCents: afterBalance }
            });
            // Create transaction record
            const transaction = await tx.transaction.create({
                data: {
                    tenantId,
                    storeId: card.id, // Use card ID as placeholder
                    cardId: card.id,
                    customerId,
                    cashierId: customerId, // Customer added funds themselves
                    type: 'ADJUST',
                    category: 'OTHER',
                    amountCents,
                    cashbackCents: 0,
                    beforeBalanceCents: beforeBalance,
                    afterBalanceCents: afterBalance,
                    note: `Funds added via credit card payment - Payment Intent: ${paymentIntent.id}`,
                }
            });
            return transaction;
        });
        // Send email notification
        try {
            const customer = await prisma.customer.findUnique({
                where: { id: customerId },
                include: { tenant: true }
            });
            if (customer?.email) {
                const updatedCard = await prisma.card.findUnique({
                    where: { cardUid },
                    select: { balanceCents: true }
                });
                if (updatedCard) {
                    await CustomerEmailService.sendFundsAddedNotification(tenantId, customerId, {
                        customerName: `${customer.firstName} ${customer.lastName}`,
                        amountAdded: `$${(amountCents / 100).toFixed(2)}`,
                        newBalance: `$${(updatedCard.balanceCents / 100).toFixed(2)}`,
                        tenantName: customer.tenant.name,
                        timestamp: new Date().toLocaleString()
                    });
                }
            }
        }
        catch (emailError) {
            console.error('Email notification error:', emailError);
        }
        if (process.env.NODE_ENV !== 'production') {
        }
    }
    catch (error) {
        console.error(`Failed to process customer funds for payment ${paymentIntent.id}:`, error);
    }
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