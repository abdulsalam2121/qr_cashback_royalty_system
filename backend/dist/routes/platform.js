import express from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { auth } from '../middleware/auth.js';
import { rbac } from '../middleware/rbac.js';
const router = express.Router();
const prisma = new PrismaClient();
const createTenantSchema = z.object({
    name: z.string().min(1),
    slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
    ownerEmail: z.string().email(),
    ownerPassword: z.string().min(6),
    ownerFirstName: z.string().min(1),
    ownerLastName: z.string().min(1),
});
// Get platform statistics
router.get('/stats', auth, rbac(['platform_admin']), asyncHandler(async (req, res) => {
    const [totalTenants, activeTenants, totalStores, totalCustomers, 
    // Mock revenue data - in real app, calculate from Stripe
    totalRevenue, monthlyRevenue,] = await Promise.all([
        prisma.tenant.count(),
        prisma.tenant.count({ where: { subscriptionStatus: 'ACTIVE' } }),
        prisma.store.count(),
        prisma.customer.count(),
        // Mock revenue calculation
        Promise.resolve(0),
        // Mock monthly revenue calculation
        Promise.resolve(0),
    ]);
    res.json({
        totalTenants,
        activeTenants,
        totalStores,
        totalCustomers,
        totalRevenue,
        monthlyRevenue,
    });
    return;
}));
// Get all tenants
router.get('/tenants', auth, rbac(['platform_admin']), asyncHandler(async (req, res) => {
    const { status, search, page = 1, limit = 50 } = req.query;
    const where = {};
    if (status) {
        where.subscriptionStatus = status;
    }
    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { slug: { contains: search, mode: 'insensitive' } },
        ];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [tenants, total] = await Promise.all([
        prisma.tenant.findMany({
            where,
            include: {
                _count: {
                    select: {
                        stores: true,
                        users: true,
                        customers: true,
                        cards: true,
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: Number(limit),
        }),
        prisma.tenant.count({ where }),
    ]);
    res.json({
        tenants,
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
    });
    return;
}));
// Create new tenant
router.post('/tenants', auth, rbac(['platform_admin']), validate(createTenantSchema), asyncHandler(async (req, res) => {
    const { name, slug, ownerEmail, ownerPassword, ownerFirstName, ownerLastName } = req.body;
    // Check if slug is already taken
    const existingTenant = await prisma.tenant.findUnique({
        where: { slug }
    });
    if (existingTenant) {
        res.status(400).json({ error: 'Tenant slug already exists' });
        return;
    }
    // Check if owner email is already taken
    const existingUser = await prisma.user.findUnique({
        where: { email: ownerEmail }
    });
    if (existingUser) {
        res.status(400).json({ error: 'User with this email already exists' });
        return;
    }
    const result = await prisma.$transaction(async (tx) => {
        // Create tenant
        const tenant = await tx.tenant.create({
            data: {
                name,
                slug,
                subscriptionStatus: 'NONE',
            },
        });
        // Create owner user
        const passwordHash = await bcrypt.hash(ownerPassword, 12);
        const user = await tx.user.create({
            data: {
                tenantId: tenant.id,
                email: ownerEmail,
                passwordHash,
                firstName: ownerFirstName,
                lastName: ownerLastName,
                role: 'tenant_admin',
            },
        });
        // Create default store
        const store = await tx.store.create({
            data: {
                tenantId: tenant.id,
                name: 'Main Store',
                active: true,
            },
        });
        // Create default cashback rules
        const cashbackRules = [
            { category: 'PURCHASE', baseRateBps: 500 },
            { category: 'REPAIR', baseRateBps: 300 },
            { category: 'OTHER', baseRateBps: 200 },
        ];
        for (const rule of cashbackRules) {
            await tx.cashbackRule.create({
                data: {
                    tenantId: tenant.id,
                    category: rule.category,
                    baseRateBps: rule.baseRateBps,
                    isActive: true,
                },
            });
        }
        // Create default tier rules
        const tierRules = [
            { tier: 'SILVER', name: 'Silver', minTotalSpendCents: 0, baseRateBps: 500 },
            { tier: 'GOLD', name: 'Gold', minTotalSpendCents: 30000, baseRateBps: 700 },
            { tier: 'PLATINUM', name: 'Platinum', minTotalSpendCents: 70000, baseRateBps: 1000 },
        ];
        for (const rule of tierRules) {
            await tx.tierRule.create({
                data: {
                    tenantId: tenant.id,
                    tier: rule.tier,
                    name: rule.name,
                    minTotalSpendCents: rule.minTotalSpendCents,
                    baseRateBps: rule.baseRateBps,
                    isActive: true,
                },
            });
        }
        return { tenant, user };
    });
    res.status(201).json(result);
    return;
}));
// Update tenant
router.put('/tenants/:id', auth, rbac(['platform_admin']), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;
    const tenant = await prisma.tenant.update({
        where: { id },
        data: updateData,
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
    res.json({ tenant });
    return;
}));
// Get plans (accessible to both platform admins and tenant admins)
router.get('/plans', auth, rbac(['platform_admin', 'tenant_admin']), asyncHandler(async (req, res) => {
    const plans = await prisma.plan.findMany({
        where: {
            isActive: true
        },
        orderBy: {
            createdAt: 'asc'
        }
    });
    // Convert database format to frontend format
    const formattedPlans = plans.map(plan => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        priceMonthly: plan.priceMonthly,
        billingPeriod: plan.billingPeriod === 'THREE_MONTHS' ? '3months' :
            plan.billingPeriod === 'SIX_MONTHS' ? '6months' :
                plan.billingPeriod === 'YEARLY' ? 'yearly' : 'monthly',
        billingPeriodMultiplier: plan.billingPeriodMultiplier,
        stripePriceId: plan.stripePriceId,
        features: plan.features,
        limits: {
            stores: plan.maxStores,
            staff: plan.maxStaff,
            cards: plan.maxCards,
            transactions: plan.maxTransactions
        }
    }));
    res.json({ plans: formattedPlans });
    return;
}));
// Create plan (platform admin only)
router.post('/plans', auth, rbac(['platform_admin']), asyncHandler(async (req, res) => {
    const { name, description, priceMonthly, billingPeriod, stripePriceId, features, limits, cardAllowance = 0, allowCardOrdering = true } = req.body;
    // Convert frontend billingPeriod to database format
    const dbBillingPeriod = billingPeriod === '3months' ? 'THREE_MONTHS' :
        billingPeriod === '6months' ? 'SIX_MONTHS' :
            billingPeriod === 'yearly' ? 'YEARLY' :
                'MONTHLY';
    const billingPeriodMultiplier = {
        'monthly': 1,
        '3months': 3,
        '6months': 6,
        'yearly': 12
    }[billingPeriod] || 1;
    const newPlan = await prisma.plan.create({
        data: {
            name,
            description,
            priceMonthly: parseInt(priceMonthly),
            billingPeriod: dbBillingPeriod,
            billingPeriodMultiplier,
            stripePriceId,
            features: Array.isArray(features) ? features : [],
            maxStores: parseInt(limits?.stores) || -1,
            maxStaff: parseInt(limits?.staff) || -1,
            maxCards: parseInt(limits?.cards) || -1,
            maxTransactions: parseInt(limits?.transactions) || -1,
        }
    });
    // Convert back to frontend format
    const formattedPlan = {
        id: newPlan.id,
        name: newPlan.name,
        description: newPlan.description,
        priceMonthly: newPlan.priceMonthly,
        billingPeriod: newPlan.billingPeriod === 'THREE_MONTHS' ? '3months' :
            newPlan.billingPeriod === 'SIX_MONTHS' ? '6months' :
                newPlan.billingPeriod === 'YEARLY' ? 'yearly' : 'monthly',
        billingPeriodMultiplier: newPlan.billingPeriodMultiplier,
        stripePriceId: newPlan.stripePriceId,
        features: newPlan.features,
        limits: {
            stores: newPlan.maxStores,
            staff: newPlan.maxStaff,
            cards: newPlan.maxCards,
            transactions: newPlan.maxTransactions
        }
    };
    res.status(201).json({ plan: formattedPlan });
    return;
}));
// Update plan (platform admin only)
router.put('/plans/:id', auth, rbac(['platform_admin']), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, description, priceMonthly, billingPeriod, stripePriceId, features, limits } = req.body;
    if (!id) {
        res.status(400).json({ error: 'Plan ID is required' });
        return;
    }
    // Convert frontend billingPeriod to database format
    const dbBillingPeriod = billingPeriod === '3months' ? 'THREE_MONTHS' :
        billingPeriod === '6months' ? 'SIX_MONTHS' :
            billingPeriod === 'yearly' ? 'YEARLY' :
                'MONTHLY';
    const billingPeriodMultiplier = {
        'monthly': 1,
        '3months': 3,
        '6months': 6,
        'yearly': 12
    }[billingPeriod] || 1;
    const updatedPlan = await prisma.plan.update({
        where: { id },
        data: {
            name,
            description,
            priceMonthly: parseInt(priceMonthly),
            billingPeriod: dbBillingPeriod,
            billingPeriodMultiplier,
            stripePriceId,
            features: Array.isArray(features) ? features : [],
            maxStores: parseInt(limits?.stores) || -1,
            maxStaff: parseInt(limits?.staff) || -1,
            maxCards: parseInt(limits?.cards) || -1,
            maxTransactions: parseInt(limits?.transactions) || -1,
        }
    });
    // Convert back to frontend format
    const formattedPlan = {
        id: updatedPlan.id,
        name: updatedPlan.name,
        description: updatedPlan.description,
        priceMonthly: updatedPlan.priceMonthly,
        billingPeriod: updatedPlan.billingPeriod === 'THREE_MONTHS' ? '3months' :
            updatedPlan.billingPeriod === 'SIX_MONTHS' ? '6months' :
                updatedPlan.billingPeriod === 'YEARLY' ? 'yearly' : 'monthly',
        billingPeriodMultiplier: updatedPlan.billingPeriodMultiplier,
        stripePriceId: updatedPlan.stripePriceId,
        features: updatedPlan.features,
        limits: {
            stores: updatedPlan.maxStores,
            staff: updatedPlan.maxStaff,
            cards: updatedPlan.maxCards,
            transactions: updatedPlan.maxTransactions
        }
    };
    res.json({ plan: formattedPlan });
    return;
}));
// Delete plan (platform admin only)
router.delete('/plans/:id', auth, rbac(['platform_admin']), asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        res.status(400).json({ error: 'Plan ID is required' });
        return;
    }
    await prisma.plan.update({
        where: { id },
        data: { isActive: false }
    });
    res.status(204).send();
    return;
}));
// Get platform card print orders (for printing management)
router.get('/card-print-orders', auth, rbac(['platform_admin']), asyncHandler(async (req, res) => {
    console.log('Platform Admin Print Orders API called');
    console.log('User:', req.user);
    console.log('Query params:', req.query);
    const { page = 1, limit = 20, status, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const where = {};
    if (status) {
        where.status = status;
    }
    if (search) {
        where.OR = [
            { tenant: { name: { contains: search, mode: 'insensitive' } } },
            { tenant: { slug: { contains: search, mode: 'insensitive' } } },
            { tenantAdminName: { contains: search, mode: 'insensitive' } },
            { storeName: { contains: search, mode: 'insensitive' } }
        ];
    }
    console.log('Where clause:', JSON.stringify(where, null, 2));
    const [orders, total] = await Promise.all([
        prisma.cardPrintOrder.findMany({
            where,
            skip,
            take: Number(limit),
            include: {
                tenant: {
                    select: {
                        id: true,
                        name: true,
                        slug: true
                    }
                },
                cards: {
                    select: {
                        id: true,
                        cardUid: true,
                        status: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        }),
        prisma.cardPrintOrder.count({ where })
    ]);
    console.log(`Found ${total} total orders, returning ${orders.length} orders`);
    console.log('Orders:', orders.map(o => ({ id: o.id, tenantName: o.tenant?.name, status: o.status })));
    res.json({
        orders,
        pagination: {
            total,
            pages: Math.ceil(total / Number(limit)),
            currentPage: Number(page),
            limit: Number(limit)
        }
    });
}));
// Get single card print order (platform admin)
router.get('/card-print-orders/:id', auth, rbac(['platform_admin']), asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!id) {
        res.status(400).json({ error: 'Order ID is required' });
        return;
    }
    const order = await prisma.cardPrintOrder.findUnique({
        where: { id },
        include: {
            tenant: {
                select: {
                    id: true,
                    name: true,
                    slug: true
                }
            },
            cards: {
                select: {
                    id: true,
                    cardUid: true,
                    status: true,
                    qrUrl: true
                }
            }
        }
    });
    if (!order) {
        res.status(404).json({ error: 'Print order not found' });
        return;
    }
    res.json({ order });
}));
// Update card print order status (platform admin)
const updatePrintOrderSchema = z.object({
    status: z.enum([
        'CREATED',
        'PRINTING_ACCEPTED',
        'PRINTING_IN_PROGRESS',
        'PRINTED',
        'READY_FOR_DELIVERY',
        'DELIVERED',
        'READY_FOR_PICKUP',
        'COLLECTED',
        'CANCELLED'
    ]).optional(),
    notes: z.string().optional(),
    trackingInfo: z.string().optional()
});
router.put('/card-print-orders/:id', auth, rbac(['platform_admin']), validate(updatePrintOrderSchema), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, notes, trackingInfo } = req.body;
    const { id: adminId } = req.user;
    if (!id) {
        res.status(400).json({ error: 'Order ID is required' });
        return;
    }
    const order = await prisma.cardPrintOrder.findUnique({
        where: { id }
    });
    if (!order) {
        res.status(404).json({ error: 'Print order not found' });
        return;
    }
    const updateData = {
        updatedAt: new Date()
    };
    if (status) {
        updateData.status = status;
        // Set timestamps based on status
        if (status === 'PRINTING_ACCEPTED') {
            updateData.acceptedAt = new Date();
        }
        else if (status === 'PRINTED') {
            updateData.printedAt = new Date();
        }
        else if (status === 'DELIVERED') {
            updateData.deliveredAt = new Date();
        }
    }
    if (notes)
        updateData.notes = notes;
    if (trackingInfo)
        updateData.trackingInfo = trackingInfo;
    const updatedOrder = await prisma.cardPrintOrder.update({
        where: { id },
        data: updateData,
        include: {
            tenant: {
                select: {
                    id: true,
                    name: true,
                    slug: true
                }
            },
            cards: {
                select: {
                    id: true,
                    cardUid: true,
                    status: true
                }
            }
        }
    });
    res.json({
        order: updatedOrder,
        message: 'Print order updated successfully'
    });
}));
export default router;
//# sourceMappingURL=platform.js.map