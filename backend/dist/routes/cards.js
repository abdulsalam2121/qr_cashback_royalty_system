import express from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import QRCode from 'qrcode';
import { nanoid } from 'nanoid';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { auth } from '../middleware/auth.js';
import { rbac } from '../middleware/rbac.js';
import { trackCardActivation } from '../services/trialService.js';
const router = express.Router();
const prisma = new PrismaClient();
const createBatchSchema = z.object({
    count: z.number().int().min(1).max(1000),
    storeId: z.string().optional(),
});
const activateSchema = z.object({
    cardUid: z.string(),
    storeId: z.string(),
    customer: z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        phone: z.string().optional(),
        email: z.string().email().optional(),
    }).optional(),
    customerId: z.string().optional(),
}).refine(data => data.customer || data.customerId, {
    message: "Either customer data or customerId must be provided"
});
const blockSchema = z.object({
    reason: z.string().optional(),
});
const updateStoreSchema = z.object({
    storeId: z.string(),
});
// Create batch of cards
router.post('/batch', auth, rbac(['tenant_admin']), validate(createBatchSchema), asyncHandler(async (req, res) => {
    const { count, storeId } = req.body;
    const { tenantId } = req.user;
    // Check trial status and subscription
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId }
    });
    if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
    }
    // Check if tenant has exceeded free trial and needs subscription for creating more cards
    const currentCardCount = await prisma.card.count({
        where: { tenantId }
    });
    if (currentCardCount + count > tenant.freeTrialLimit &&
        tenant.subscriptionStatus !== 'ACTIVE') {
        res.status(403).json({
            error: 'Subscription required',
            message: `Your free trial allows up to ${tenant.freeTrialLimit} cards. You currently have ${currentCardCount} cards and are trying to create ${count} more. Please upgrade to a paid subscription to continue creating cards.`,
            cardsCreated: currentCardCount,
            trialLimit: tenant.freeTrialLimit,
            requestedCount: count
        });
        return;
    }
    const cards = [];
    for (let i = 0; i < count; i++) {
        const cardUid = nanoid(12).toUpperCase();
        // Generate QR code URL
        const qrData = `${process.env.APP_BASE_URL}/c/${cardUid}`;
        try {
            const qrUrl = await QRCode.toDataURL(qrData, {
                width: 200,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
            cards.push({
                cardUid,
                tenantId,
                storeId,
                qrUrl,
                status: 'UNASSIGNED',
                balanceCents: 0,
            });
        }
        catch (error) {
            console.error(`Failed to generate QR code for card ${cardUid}:`, error);
            res.status(500).json({ error: 'Failed to generate QR codes' });
            return;
        }
    }
    const createdCards = await prisma.card.createMany({
        data: cards,
    });
    const cardList = await prisma.card.findMany({
        where: {
            tenantId,
            cardUid: { in: cards.map(c => c.cardUid) }
        },
        include: {
            store: true,
            customer: true,
        },
        orderBy: { createdAt: 'desc' }
    });
    res.status(201).json({
        message: `Created ${createdCards.count} cards`,
        cards: cardList.map(card => ({
            ...card,
            storeName: card.store?.name || null
        }))
    });
    return;
}));
// Get all cards
router.get('/', auth, rbac(['tenant_admin', 'cashier']), asyncHandler(async (req, res) => {
    const { tenantId, storeId, role } = req.user;
    const { status, search, page = 1, limit = 50 } = req.query;
    const where = { tenantId };
    // Cashiers can only see cards from their store
    if (role === 'cashier' && storeId) {
        where.OR = [
            { storeId },
            { storeId: null } // Unassigned cards
        ];
    }
    if (status) {
        where.status = status;
    }
    if (search) {
        where.OR = [
            { cardUid: { contains: search, mode: 'insensitive' } },
            { customer: {
                    OR: [
                        { firstName: { contains: search, mode: 'insensitive' } },
                        { lastName: { contains: search, mode: 'insensitive' } },
                        { email: { contains: search, mode: 'insensitive' } },
                    ]
                } }
        ];
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [cards, total] = await Promise.all([
        prisma.card.findMany({
            where,
            include: {
                store: true,
                customer: true,
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: Number(limit),
        }),
        prisma.card.count({ where }),
    ]);
    res.json({
        cards: cards.map(card => ({
            ...card,
            storeName: card.store?.name || null
        })),
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
    });
}));
// Get card by UID
router.get('/:cardUid', asyncHandler(async (req, res) => {
    const { cardUid } = req.params;
    let card = await prisma.card.findUnique({
        where: { cardUid },
        include: {
            store: true,
            customer: {
                include: {
                    transactions: {
                        take: 10,
                        orderBy: { createdAt: 'desc' },
                        include: {
                            store: true,
                            cashier: {
                                select: { firstName: true, lastName: true }
                            }
                        }
                    }
                }
            },
        },
    });
    if (!card) {
        res.status(404).json({ error: 'Card not found' });
        return;
    }
    // Check if user is authenticated and authorized
    const isAuthenticated = req.user;
    const isAuthorized = isAuthenticated &&
        (req.user.role === 'admin' ||
            req.user.role === 'cashier' ||
            (req.user.role === 'customer' && card.customerId === req.user.customerId));
    // Return limited info for unauthenticated requests
    if (!isAuthenticated) {
        res.json({
            cardUid: card.cardUid,
            status: card.status,
            storeName: card.store?.name,
            isActive: card.status === 'ACTIVE',
        });
        return;
    }
    // Return full info for authorized requests
    if (isAuthorized) {
        res.json({
            ...card,
            storeName: card.store?.name || null
        });
        return;
    }
    else {
        res.status(403).json({ error: 'Unauthorized' });
        return;
    }
}));
// Activate card
router.post('/activate', auth, rbac(['tenant_admin', 'cashier']), validate(activateSchema), asyncHandler(async (req, res, next) => {
    const { cardUid, storeId, customer, customerId } = req.body;
    const { tenantId } = req.user;
    // Check trial limits first
    const trialResult = await trackCardActivation(tenantId, cardUid);
    if (!trialResult.success) {
        res.status(403).json({
            error: 'Activation limit reached',
            message: trialResult.message,
            trialStatus: {
                activationsUsed: trialResult.activationsUsed,
                activationsRemaining: trialResult.activationsRemaining,
                trialExceeded: trialResult.trialExceeded
            }
        });
        return;
    }
    // Start transaction
    try {
        const result = await prisma.$transaction(async (tx) => {
            const card = await tx.card.findUnique({
                where: { cardUid },
                include: { customer: true }
            });
            if (!card) {
                throw new Error('Card not found');
            }
            if (card.tenantId !== tenantId) {
                throw new Error('Unauthorized');
            }
            if (card.status !== 'UNASSIGNED') {
                throw new Error('Card is already activated');
            }
            // Verify store exists
            const store = await tx.store.findFirst({
                where: { id: storeId, tenantId }
            });
            if (!store) {
                throw new Error('Store not found');
            }
            let customerRecord;
            if (customerId) {
                // Use existing customer
                customerRecord = await tx.customer.findFirst({
                    where: { id: customerId, tenantId }
                });
                if (!customerRecord) {
                    throw new Error('Customer not found');
                }
            }
            else if (customer) {
                // Create new customer or find existing by email
                if (customer.email) {
                    customerRecord = await tx.customer.findUnique({
                        where: { email: customer.email }
                    });
                }
                if (!customerRecord) {
                    customerRecord = await tx.customer.create({
                        data: {
                            ...customer,
                            tenantId,
                            tier: 'SILVER',
                            totalSpend: 0,
                        },
                    });
                }
            }
            // Update card
            const updatedCard = await tx.card.update({
                where: { id: card.id },
                data: {
                    customerId: customerRecord.id,
                    storeId,
                    status: 'ACTIVE',
                    activatedAt: new Date(),
                },
                include: {
                    customer: true,
                    store: true,
                },
            });
            return { card: updatedCard, customer: customerRecord };
        });
        res.json({
            message: 'Card activated successfully',
            card: {
                ...result.card,
                storeName: result.card.store?.name || null
            },
            trialStatus: {
                activationsUsed: trialResult.activationsUsed,
                activationsRemaining: trialResult.activationsRemaining,
                trialExceeded: trialResult.trialExceeded
            }
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(400).json({ error: message });
    }
}));
// Update card store assignment
router.put('/:cardUid/store', auth, rbac(['tenant_admin']), validate(updateStoreSchema), asyncHandler(async (req, res) => {
    const { cardUid } = req.params;
    const { storeId } = req.body;
    const { tenantId } = req.user;
    // Find the card
    const card = await prisma.card.findFirst({
        where: { cardUid, tenantId },
        include: {
            customer: true,
            store: true,
        }
    });
    if (!card) {
        res.status(404).json({ error: 'Card not found' });
        return;
    }
    // Check if the card is assigned to a customer
    if (card.status === 'UNASSIGNED') {
        res.status(400).json({ error: 'Cannot assign store to unassigned card. Please assign the card to a customer first.' });
        return;
    }
    // Verify the store exists and belongs to the tenant
    const store = await prisma.store.findFirst({
        where: { id: storeId, tenantId }
    });
    if (!store) {
        res.status(404).json({ error: 'Store not found' });
        return;
    }
    // Update the card's store assignment
    const updatedCard = await prisma.card.update({
        where: { id: card.id },
        data: { storeId },
        include: {
            customer: true,
            store: true,
        },
    });
    res.json({
        message: 'Card store assignment updated successfully',
        card: {
            ...updatedCard,
            storeName: updatedCard.store?.name || null,
        },
    });
}));
// Block/unblock card
router.post('/:cardUid/block', auth, rbac(['tenant_admin']), validate(blockSchema), asyncHandler(async (req, res) => {
    const { cardUid } = req.params;
    const { reason } = req.body;
    const { tenantId } = req.user;
    const card = await prisma.card.findFirst({
        where: { cardUid, tenantId }
    });
    if (!card) {
        res.status(404).json({ error: 'Card not found' });
        return;
    }
    const newStatus = card.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED';
    const updatedCard = await prisma.card.update({
        where: { id: card.id },
        data: {
            status: newStatus,
        },
        include: {
            customer: true,
            store: true,
        },
    });
    res.json({
        message: `Card ${newStatus.toLowerCase()} successfully`,
        card: {
            ...updatedCard,
            storeName: updatedCard.store?.name || null
        }
    });
}));
export default router;
//# sourceMappingURL=cards.js.map