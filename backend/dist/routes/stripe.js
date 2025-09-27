"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const stripe_1 = __importDefault(require("stripe"));
const asyncHandler_js_1 = require("../middleware/asyncHandler.js");
const decimal_js_1 = require("decimal.js");
const tiers_js_1 = require("../utils/tiers.js");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
// Stripe webhook handler
router.post('/webhook', express_1.default.raw({ type: 'application/json' }), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
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
                // Handle one-time payments (like card orders)
                if (paymentIntent.metadata?.orderId) {
                    await handleCardOrderPaymentIntent(paymentIntent);
                }
                // Handle QR payment transactions
                else if (paymentIntent.metadata?.paymentLinkId) {
                    await handlePurchaseTransactionPaymentIntent(paymentIntent);
                }
                break;
            }
            default:
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`Unhandled event type: ${event.type}`);
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
            console.log(`Card order payment confirmed`);
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
            console.log(`Card order payment intent succeeded`);
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
            // Process cashback if applicable
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
                    const newTotalSpend = new decimal_js_1.Decimal(card.customer.totalSpend).add(new decimal_js_1.Decimal(purchaseTransaction.amountCents).div(100));
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
                    await (0, tiers_js_1.updateCustomerTier)(card.customer.id, purchaseTransaction.tenantId, tx);
                }
            }
            if (process.env.NODE_ENV !== 'production') {
                console.log(`Purchase transaction payment intent succeeded for transaction ${purchaseTransaction.id}`);
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
            console.log(`Successfully added $${(amountCents / 100).toFixed(2)} to card`);
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
            console.log(`Updated tenant subscription status to ${status}${planId ? ` with plan` : ''}`);
        }
    }
    else {
        console.error(`No tenant found for subscription ${subscription.id} or customer ${subscription.customer}`);
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
exports.default = router;
//# sourceMappingURL=stripe.js.map