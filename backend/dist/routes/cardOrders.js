"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const stripe_1 = __importDefault(require("stripe"));
const asyncHandler_js_1 = require("../middleware/asyncHandler.js");
const auth_js_1 = require("../middleware/auth.js");
const rbac_js_1 = require("../middleware/rbac.js");
const validate_js_1 = require("../middleware/validate.js");
const cardLimitService_js_1 = require("../services/cardLimitService.js");
const zod_1 = require("zod");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
// Card pricing configuration
const CARD_PRICES = {
    SINGLE_SIDED: 2.10,
    DOUBLE_SIDED_CUSTOM: 3.90
};
// Validation schemas
const createOrderSchema = zod_1.z.object({
    cardType: zod_1.z.enum(['SINGLE_SIDED', 'DOUBLE_SIDED_CUSTOM']),
    quantity: zod_1.z.number().min(1).max(10000),
    sourceType: zod_1.z.enum(['TRIAL', 'SUBSCRIPTION', 'ADDITIONAL']).default('SUBSCRIPTION'),
    deductFromBalance: zod_1.z.boolean().default(true),
    storeName: zod_1.z.string().optional(),
    storePhone: zod_1.z.string().optional(),
    storeAddress: zod_1.z.string().optional(),
    customDesign: zod_1.z.string().optional(),
    shippingAddress: zod_1.z.string().min(1, 'Shipping address is required')
});
const createCheckoutSchema = zod_1.z.object({
    cardType: zod_1.z.enum(['SINGLE_SIDED', 'DOUBLE_SIDED_CUSTOM']),
    quantity: zod_1.z.number().min(1).max(10000),
    sourceType: zod_1.z.enum(['TRIAL', 'SUBSCRIPTION', 'ADDITIONAL']).default('SUBSCRIPTION'),
    deductFromBalance: zod_1.z.boolean().default(true),
    storeName: zod_1.z.string().optional(),
    storePhone: zod_1.z.string().optional(),
    storeAddress: zod_1.z.string().optional(),
    customDesign: zod_1.z.string().optional(),
    shippingAddress: zod_1.z.string().min(1, 'Shipping address is required')
});
const updateOrderSchema = zod_1.z.object({
    status: zod_1.z.enum(['PENDING_APPROVAL', 'APPROVED', 'PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']).optional(),
    trackingNumber: zod_1.z.string().optional()
});
// Get card pricing
router.get('/pricing', (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    res.json({
        prices: CARD_PRICES,
        currency: 'USD'
    });
}));
// Check card ordering eligibility
router.get('/eligibility', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { tenantId } = req.user;
    const { quantity = 1 } = req.query;
    const eligibility = await cardLimitService_js_1.CardLimitService.canOrderCards(tenantId, Number(quantity));
    const balance = await cardLimitService_js_1.CardLimitService.getCardBalance(tenantId);
    res.json({
        ...eligibility,
        balance,
        recommendations: {
            maxOrderQuantity: balance.currentBalance,
            needsUpgrade: !eligibility.canOrder && !eligibility.hasActiveSubscription
        }
    });
}));
// Get orders for tenant
router.get('/', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { tenantId } = req.user;
    const { page = 1, limit = 10, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = { tenantId };
    if (status) {
        where.status = status;
    }
    const [orders, total] = await Promise.all([
        prisma.cardOrder.findMany({
            where,
            skip,
            take: Number(limit),
            orderBy: { createdAt: 'desc' }
        }),
        prisma.cardOrder.count({ where })
    ]);
    res.json({
        orders,
        pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            pages: Math.ceil(total / Number(limit))
        }
    });
}));
// Get single order
router.get('/:id', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, asyncHandler_js_1.asyncHandler)(async (req, res, next) => {
    const { tenantId } = req.user;
    const { id } = req.params;
    if (!id) {
        res.status(400).json({ error: 'Order ID is required' });
        return;
    }
    const order = await prisma.cardOrder.findFirst({
        where: { id, tenantId }
    });
    if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
    }
    res.json({ order });
}));
// Create Stripe checkout session for card order
router.post('/checkout', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, validate_js_1.validate)(createCheckoutSchema), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { tenantId, email } = req.user;
    const { cardType, quantity, storeName, storePhone, storeAddress, customDesign, shippingAddress } = req.body;
    // Check trial status
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId }
    });
    if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
    }
    // Check if tenant has exceeded free trial and needs subscription
    if (tenant.freeTrialActivations >= tenant.freeTrialLimit &&
        tenant.subscriptionStatus !== 'ACTIVE') {
        res.status(403).json({
            error: 'Subscription required',
            message: 'Your free trial has ended. Please upgrade to a paid subscription to continue ordering cards.',
            trialActivations: tenant.freeTrialActivations,
            trialLimit: tenant.freeTrialLimit
        });
        return;
    }
    const unitPrice = CARD_PRICES[cardType];
    const totalPrice = unitPrice * quantity;
    const totalPriceCents = Math.round(totalPrice * 100);
    try {
        let customerId = tenant.stripeCustomerId;
        // Create Stripe customer if doesn't exist
        if (!customerId) {
            const customerParams = {
                email: email,
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
        // Create pending order first
        const order = await prisma.cardOrder.create({
            data: {
                tenantId,
                cardType,
                quantity,
                unitPrice,
                totalPrice,
                storeName,
                storePhone,
                storeAddress,
                customDesign,
                shippingAddress,
                status: 'PENDING_PAYMENT'
            }
        });
        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: cardType === 'SINGLE_SIDED' ? 'Single-Sided Loyalty Cards' : 'Double-Sided Custom Loyalty Cards',
                            description: `${quantity} ${cardType === 'SINGLE_SIDED' ? 'single-sided' : 'double-sided custom'} loyalty cards`,
                            metadata: {
                                cardType,
                                storeName: storeName || '',
                                shippingAddress
                            }
                        },
                        unit_amount: Math.round(unitPrice * 100), // Convert to cents
                    },
                    quantity: quantity,
                },
            ],
            mode: 'payment',
            success_url: `${process.env.FRONTEND_URL}/t/${tenant.slug}/card-orders?session_id={CHECKOUT_SESSION_ID}&success=true&order_id=${order.id}`,
            cancel_url: `${process.env.FRONTEND_URL}/t/${tenant.slug}/card-orders?canceled=true&order_id=${order.id}`,
            metadata: {
                tenantId: tenant.id,
                orderId: order.id,
                cardType,
                quantity: quantity.toString(),
            },
            shipping_address_collection: {
                allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'ES', 'IT'],
            },
            custom_text: {
                shipping_address: {
                    message: 'Please provide the address where you want your loyalty cards delivered.'
                },
                submit: {
                    message: 'Your order will be processed within 5-7 business days after payment confirmation.'
                }
            }
        });
        res.json({
            checkoutUrl: session.url,
            orderId: order.id,
            sessionId: session.id
        });
    }
    catch (error) {
        console.error('Stripe checkout error:', error);
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
}));
// Create new order (Direct order without payment - for admin testing)
router.post('/', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, validate_js_1.validate)(createOrderSchema), (0, asyncHandler_js_1.asyncHandler)(async (req, res, next) => {
    const { tenantId, id: userId } = req.user;
    const { cardType, quantity, sourceType = 'SUBSCRIPTION', deductFromBalance = true, storeName, storePhone, storeAddress, customDesign, shippingAddress } = req.body;
    // Check card ordering eligibility
    const eligibility = await cardLimitService_js_1.CardLimitService.canOrderCards(tenantId, quantity);
    if (!eligibility.canOrder) {
        res.status(403).json({
            error: 'Cannot order cards',
            message: eligibility.reason,
            availableBalance: eligibility.availableBalance,
            hasActiveSubscription: eligibility.hasActiveSubscription
        });
        return;
    }
    const unitPrice = CARD_PRICES[cardType];
    const totalPrice = unitPrice * quantity;
    // Create order with transaction
    const result = await prisma.$transaction(async (tx) => {
        // Create the order
        const order = await tx.cardOrder.create({
            data: {
                tenantId,
                cardType,
                quantity,
                unitPrice,
                totalPrice,
                sourceType,
                deductFromBalance,
                storeName,
                storePhone,
                storeAddress,
                customDesign,
                shippingAddress,
                status: deductFromBalance ? 'PENDING_APPROVAL' : 'PENDING'
            }
        });
        // Deduct cards from balance if required
        if (deductFromBalance) {
            await cardLimitService_js_1.CardLimitService.useCardsForOrder(tenantId, order.id, quantity, userId);
        }
        return order;
    });
    res.status(201).json({ order: result });
}));
// Approve order (platform admin only)
router.post('/:id/approve', auth_js_1.auth, (0, rbac_js_1.rbac)(['platform_admin']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { id: userId } = req.user;
    if (!id) {
        res.status(400).json({ error: 'Order ID is required' });
        return;
    }
    const order = await prisma.cardOrder.findUnique({
        where: { id }
    });
    if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
    }
    if (order.status !== 'PENDING_APPROVAL') {
        res.status(400).json({ error: 'Order is not pending approval' });
        return;
    }
    const updatedOrder = await prisma.cardOrder.update({
        where: { id },
        data: {
            status: 'APPROVED',
            approvedAt: new Date(),
            approvedBy: userId
        }
    });
    res.json({ order: updatedOrder });
}));
// Reject order and refund cards (platform admin only)
router.post('/:id/reject', auth_js_1.auth, (0, rbac_js_1.rbac)(['platform_admin']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { id: userId } = req.user;
    const { reason } = req.body;
    if (!id) {
        res.status(400).json({ error: 'Order ID is required' });
        return;
    }
    const order = await prisma.cardOrder.findUnique({
        where: { id }
    });
    if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
    }
    if (order.status !== 'PENDING_APPROVAL') {
        res.status(400).json({ error: 'Order is not pending approval' });
        return;
    }
    await prisma.$transaction(async (tx) => {
        // Update order status
        await tx.cardOrder.update({
            where: { id },
            data: {
                status: 'CANCELLED',
                approvedBy: userId
            }
        });
        // Refund cards if they were deducted
        const orderWithDetails = order;
        if (orderWithDetails.deductFromBalance) {
            await cardLimitService_js_1.CardLimitService.refundCardsFromOrder(order.tenantId, order.id, order.quantity, userId);
        }
    });
    res.json({ message: 'Order rejected and cards refunded' });
}));
// Update order (admin only - for platform management)
router.put('/:id', auth_js_1.auth, (0, rbac_js_1.rbac)(['platform_admin']), (0, validate_js_1.validate)(updateOrderSchema), (0, asyncHandler_js_1.asyncHandler)(async (req, res, next) => {
    const { id } = req.params;
    const updateData = req.body;
    if (!id) {
        res.status(400).json({ error: 'Order ID is required' });
        return;
    }
    // Add timestamp fields based on status
    if (updateData.status === 'SHIPPED') {
        updateData.shippedAt = new Date();
    }
    else if (updateData.status === 'DELIVERED') {
        updateData.deliveredAt = new Date();
    }
    const order = await prisma.cardOrder.update({
        where: { id },
        data: updateData
    });
    res.json({ order });
}));
// Cancel order
router.delete('/:id', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, asyncHandler_js_1.asyncHandler)(async (req, res, next) => {
    const { tenantId } = req.user;
    const { id } = req.params;
    if (!id) {
        res.status(400).json({ error: 'Order ID is required' });
        return;
    }
    const order = await prisma.cardOrder.findFirst({
        where: { id, tenantId }
    });
    if (!order) {
        res.status(404).json({ error: 'Order not found' });
        return;
    }
    if (order.status !== 'PENDING') {
        res.status(400).json({
            error: 'Cannot cancel order',
            message: 'Only pending orders can be cancelled'
        });
        return;
    }
    const updatedOrder = await prisma.cardOrder.update({
        where: { id },
        data: { status: 'CANCELLED' }
    });
    res.json({ order: updatedOrder });
}));
// Get card balance and limits
router.get('/balance', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { tenantId } = req.user;
    const balance = await cardLimitService_js_1.CardLimitService.getCardBalance(tenantId);
    res.json({ balance });
}));
// Get card limit transaction history
router.get('/balance/history', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { tenantId } = req.user;
    const { limit = 50 } = req.query;
    const history = await cardLimitService_js_1.CardLimitService.getTransactionHistory(tenantId, Number(limit));
    res.json({ history });
}));
exports.default = router;
//# sourceMappingURL=cardOrders.js.map