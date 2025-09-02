import express from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { auth } from '../middleware/auth.js';
import { rbac } from '../middleware/rbac.js';
import { resolveTenant } from '../middleware/tenant.js';
const router = express.Router();
const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
const subscribeSchema = z.object({
    planId: z.string(),
});
// Get tenant info
router.get('/:tenantSlug/tenant', resolveTenant, auth, rbac(['tenant_admin', 'cashier']), asyncHandler(async (req, res) => {
    const { tenantSlug } = req.params;
    const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug },
        include: {
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
    res.json({ tenant });
    return;
}));
// Subscribe to plan
router.post('/:tenantSlug/billing/subscribe', resolveTenant, auth, rbac(['tenant_admin']), validate(subscribeSchema), asyncHandler(async (req, res) => {
    const { tenantSlug } = req.params;
    const { planId } = req.body;
    const { tenantId } = req.user;
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId }
    });
    if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
    }
    // Get price ID based on plan
    const priceId = planId === 'basic'
        ? process.env.STRIPE_PRICE_ID_BASIC
        : process.env.STRIPE_PRICE_ID_PRO;
    if (!priceId) {
        res.status(400).json({ error: 'Invalid plan selected' });
        return;
    }
    try {
        let customerId = tenant.stripeCustomerId;
        // Create Stripe customer if doesn't exist
        if (!customerId) {
            const customerParams = {
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
        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${process.env.FRONTEND_URL}/t/${tenantSlug}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL}/t/${tenantSlug}/billing`,
            metadata: {
                tenantId: tenant.id,
                planId,
            },
        });
        res.json({ checkoutUrl: session.url });
        return;
    }
    catch (error) {
        console.error('Stripe error:', error);
        res.status(500).json({ error: 'Failed to create checkout session' });
        return;
    }
}));
// Get billing portal
router.get('/:tenantSlug/billing/portal', resolveTenant, auth, rbac(['tenant_admin']), asyncHandler(async (req, res) => {
    const { tenantSlug } = req.params;
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
    }
    catch (error) {
        console.error('Stripe error:', error);
        res.status(500).json({ error: 'Failed to create billing portal session' });
        return;
    }
}));
export default router;
//# sourceMappingURL=tenant.js.map