"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const qrcode_1 = __importDefault(require("qrcode"));
const nanoid_1 = require("nanoid");
const jszip_1 = __importDefault(require("jszip"));
const sharp_1 = __importDefault(require("sharp"));
const asyncHandler_js_1 = require("../middleware/asyncHandler.js");
const validate_js_1 = require("../middleware/validate.js");
const auth_js_1 = require("../middleware/auth.js");
const rbac_js_1 = require("../middleware/rbac.js");
const trialService_js_1 = require("../services/trialService.js");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
const createBatchSchema = zod_1.z.object({
    count: zod_1.z.number().int().min(1).max(1000), // Hard limit of 1000 cards per batch
    storeId: zod_1.z.string().optional(),
});
const activateSchema = zod_1.z.object({
    cardUid: zod_1.z.string(),
    storeId: zod_1.z.string(),
    customer: zod_1.z.object({
        firstName: zod_1.z.string().min(1),
        lastName: zod_1.z.string().min(1),
        phone: zod_1.z.string().optional(),
        email: zod_1.z.string().email().optional(),
    }).optional(),
    customerId: zod_1.z.string().optional(),
}).refine(data => data.customer || data.customerId, {
    message: "Either customer data or customerId must be provided"
});
const blockSchema = zod_1.z.object({
    reason: zod_1.z.string().optional(),
});
const updateStoreSchema = zod_1.z.object({
    storeId: zod_1.z.string(),
});
// Create batch of cards
router.post('/batch', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, validate_js_1.validate)(createBatchSchema), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { count, storeId } = req.body;
    const { tenantId } = req.user;
    // Import CardLimitService
    const { CardLimitService } = await Promise.resolve().then(() => __importStar(require('../services/cardLimitService.js')));
    // Enforce maximum batch size regardless of subscription
    if (count > 1000) {
        res.status(400).json({
            error: 'Batch size too large',
            message: 'Maximum 1000 cards can be created per batch',
            maxAllowed: 1000,
            requestedCount: count
        });
        return;
    }
    // Check trial status and subscription
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
            plan: true
        }
    });
    if (!tenant) {
        res.status(404).json({ error: 'Tenant not found' });
        return;
    }
    // Get current card count for accurate calculations
    const currentCardCount = await prisma.card.count({
        where: { tenantId }
    });
    console.log(`Card creation request: tenant=${tenantId}, count=${count}, currentCards=${currentCardCount}`);
    console.log(`Tenant status: ${tenant.subscriptionStatus}, planId: ${tenant.planId}`);
    console.log(`Subscription limits: ${tenant.subscriptionCardsUsed}/${tenant.subscriptionCardLimit}`);
    // Handle card limit validation based on subscription status
    if (tenant.subscriptionStatus === 'ACTIVE') {
        // For active subscriptions, use subscription card limits
        const cardsRemaining = Math.max(0, tenant.subscriptionCardLimit - tenant.subscriptionCardsUsed);
        console.log(`Active subscription: ${tenant.subscriptionCardsUsed}/${tenant.subscriptionCardLimit} used, ${cardsRemaining} remaining`);
        // Check if tenant is over their subscription limit (downgrade scenario)
        if (tenant.subscriptionCardsUsed > tenant.subscriptionCardLimit) {
            res.status(403).json({
                error: 'Card creation blocked',
                message: `Your account has used ${tenant.subscriptionCardsUsed} cards but your ${tenant.plan?.name || 'current'} plan only allows ${tenant.subscriptionCardLimit}. You cannot create new cards until your usage is reduced. Consider upgrading your plan.`,
                currentCards: currentCardCount,
                subscriptionUsed: tenant.subscriptionCardsUsed,
                subscriptionLimit: tenant.subscriptionCardLimit,
                planName: tenant.plan?.name || 'Current Plan',
                suggestedActions: [
                    'Upgrade to a higher plan',
                    'Contact support for assistance'
                ]
            });
            return;
        }
        // Check if request exceeds remaining subscription allowance
        if (count > cardsRemaining) {
            res.status(403).json({
                error: 'Insufficient subscription allowance',
                message: `You can create ${cardsRemaining} more cards from your ${tenant.plan?.name || 'current'} subscription. You're trying to create ${count} cards.`,
                subscriptionUsed: tenant.subscriptionCardsUsed,
                subscriptionLimit: tenant.subscriptionCardLimit,
                cardsRemaining,
                currentCards: currentCardCount,
                requestedCount: count,
                planName: tenant.plan?.name || 'Current Plan'
            });
            return;
        }
    }
    else {
        // For trial users or inactive subscriptions, check trial limits
        console.log(`Trial/inactive subscription: ${currentCardCount}/${tenant.freeTrialLimit} cards used`);
        if (currentCardCount + count > tenant.freeTrialLimit) {
            res.status(403).json({
                error: 'Subscription required',
                message: `Your free trial allows up to ${tenant.freeTrialLimit} cards. You currently have ${currentCardCount} cards and are trying to create ${count} more. Please upgrade to a paid subscription to continue creating cards.`,
                cardsCreated: currentCardCount,
                trialLimit: tenant.freeTrialLimit,
                requestedCount: count,
                remainingTrialCards: Math.max(0, tenant.freeTrialLimit - currentCardCount)
            });
            return;
        }
    }
    const cards = [];
    for (let i = 0; i < count; i++) {
        const cardUid = (0, nanoid_1.nanoid)(12).toUpperCase();
        // Generate QR code URL
        const qrData = `${process.env.APP_BASE_URL}/c/${cardUid}`;
        try {
            const qrUrl = await qrcode_1.default.toDataURL(qrData, {
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
    const createdCards = await prisma.$transaction(async (tx) => {
        // Create the cards
        const result = await tx.card.createMany({
            data: cards,
        });
        // Get the tenant information for the print order
        const tenantWithStore = await tx.tenant.findUnique({
            where: { id: tenantId },
            include: {
                stores: storeId ? {
                    where: { id: storeId },
                    take: 1
                } : {
                    take: 1
                },
                users: {
                    where: { role: 'tenant_admin' },
                    take: 1,
                    select: {
                        email: true,
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });
        // Create a print order for the Platform Admin
        const tenantAdmin = tenantWithStore?.users?.[0];
        const store = tenantWithStore?.stores?.[0];
        const printOrder = await tx.cardPrintOrder.create({
            data: {
                tenantId,
                quantity: count,
                status: 'CREATED',
                storeName: store?.name || 'Unknown Store',
                storeAddress: store?.address || 'No address provided',
                tenantAdminEmail: tenantAdmin?.email || 'No email available',
                tenantAdminName: tenantAdmin?.firstName && tenantAdmin?.lastName
                    ? `${tenantAdmin.firstName} ${tenantAdmin.lastName}`
                    : 'Unknown Admin',
                deliveryMethod: 'PICKUP', // Default to pickup
                notes: `Automatic print order for ${count} cards created by ${tenantAdmin?.firstName || 'Tenant Admin'}`
            }
        });
        // Update the cards to link them to the print order
        await tx.card.updateMany({
            where: {
                tenantId,
                cardUid: { in: cards.map(c => c.cardUid) }
            },
            data: {
                printOrderId: printOrder.id
            }
        });
        return result;
    });
    // Update subscription usage counter if subscription is active
    if (tenant.subscriptionStatus === 'ACTIVE') {
        try {
            await prisma.tenant.update({
                where: { id: tenantId },
                data: {
                    subscriptionCardsUsed: { increment: count }
                }
            });
            // Create audit trail for subscription card usage
            await prisma.cardLimitTransaction.create({
                data: {
                    tenantId,
                    type: 'USED',
                    source: 'SUBSCRIPTION_UPGRADE',
                    amount: -count,
                    previousBalance: tenant.subscriptionCardLimit - tenant.subscriptionCardsUsed,
                    newBalance: tenant.subscriptionCardLimit - (tenant.subscriptionCardsUsed + count),
                    description: `${count} cards created from subscription allowance`,
                    createdBy: req.user?.id || 'system'
                }
            });
            console.log(`Updated subscription usage: ${tenant.subscriptionCardsUsed + count}/${tenant.subscriptionCardLimit}`);
        }
        catch (error) {
            console.error('Failed to update subscription usage:', error);
            // Don't fail the card creation for accounting errors
        }
    }
    else {
        // For trial users, update trial usage
        try {
            await prisma.tenant.update({
                where: { id: tenantId },
                data: {
                    freeTrialCardsCreated: { increment: count }
                }
            });
            console.log(`Updated trial usage: ${tenant.freeTrialCardsCreated + count}/${tenant.freeTrialLimit}`);
        }
        catch (error) {
            console.error('Failed to update trial usage:', error);
            // Don't fail the card creation for accounting errors
        }
    }
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
router.get('/', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin', 'cashier']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
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
// Special endpoint for POS terminal card lookup - requires only cashier auth
router.get('/lookup/:cardUid', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin', 'cashier']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { cardUid } = req.params;
    const { tenantId } = req.user;
    console.log('🔍 POS Card Lookup:', { cardUid, tenantId, userRole: req.user.role });
    const card = await prisma.card.findUnique({
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
    // Verify card belongs to the same tenant
    if (card.tenantId !== tenantId) {
        console.log('❌ POS Card Lookup: Tenant mismatch', {
            cardTenantId: card.tenantId,
            userTenantId: tenantId
        });
        res.status(403).json({ error: 'Unauthorized - card belongs to different tenant' });
        return;
    }
    // Always return full card info for POS operations by cashiers/admins
    console.log('✅ POS Card Lookup: Success', {
        cardUid: card.cardUid,
        hasCustomer: !!card.customer,
        customerName: card.customer ? `${card.customer.firstName} ${card.customer.lastName}` : null
    });
    res.json({
        ...card,
        storeName: card.store?.name || null
    });
}));
// Get card by UID
router.get('/:cardUid', auth_js_1.auth, (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { cardUid } = req.params;
    console.log('🔍 GET /cards/:cardUid called');
    console.log('Card UID:', cardUid);
    console.log('User:', req.user ? {
        id: req.user.userId,
        role: req.user.role,
        tenantId: req.user.tenantId
    } : 'No user (unauthenticated)');
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
    console.log('Card found:', card ? {
        cardUid: card.cardUid,
        status: card.status,
        customerId: card.customerId,
        hasCustomer: !!card.customer,
        customerName: card.customer ? `${card.customer.firstName} ${card.customer.lastName}` : null
    } : 'No card found');
    if (!card) {
        res.status(404).json({ error: 'Card not found' });
        return;
    }
    // Check if user is authenticated and authorized
    const isAuthenticated = !!req.user;
    // Enhanced authorization logic with better debugging
    let isAuthorized = false;
    let authFailReason = '';
    if (isAuthenticated) {
        const tenantMatch = card.tenantId === req.user?.tenantId;
        const isPlatformAdmin = req.user.role === 'platform_admin';
        const isTenantAdmin = req.user.role === 'tenant_admin';
        const isCashier = req.user.role === 'cashier';
        const isCardOwner = req.user.role === 'customer' && card.customerId === req.user.customerId;
        if (isPlatformAdmin) {
            isAuthorized = true;
        }
        else if (!tenantMatch) {
            authFailReason = 'Tenant ID mismatch';
        }
        else if (isTenantAdmin || isCashier) {
            isAuthorized = true;
        }
        else if (isCardOwner) {
            isAuthorized = true;
        }
        else {
            authFailReason = 'Role not authorized for this card';
        }
    }
    else {
        authFailReason = 'User not authenticated';
    }
    console.log('🔍 Enhanced Auth Check:', {
        isAuthenticated,
        isAuthorized,
        authFailReason,
        userRole: req.user?.role,
        userTenantId: req.user?.tenantId,
        cardTenantId: card.tenantId,
        tenantMatch: isAuthenticated ? card.tenantId === req.user?.tenantId : false,
        cardUid: card.cardUid,
        hasCustomer: !!card.customer,
        customerName: card.customer ? `${card.customer.firstName} ${card.customer.lastName}` : null
    });
    // Return limited info for unauthenticated requests
    if (!isAuthenticated) {
        console.log('❌ Returning limited info (unauthenticated)');
        res.json({
            cardUid: card.cardUid,
            status: card.status,
            storeName: card.store?.name,
            isActive: card.status === 'ACTIVE',
            // Add debug info in development
            ...(process.env.NODE_ENV === 'development' && {
                _debug: { reason: 'unauthenticated', authFailReason }
            })
        });
        return;
    }
    // Return full info for authorized requests
    if (isAuthorized) {
        console.log('✅ Returning full info (authorized)');
        res.json({
            ...card,
            storeName: card.store?.name || null
        });
        return;
    }
    else {
        console.log(`❌ Unauthorized access attempt: ${authFailReason}`);
        res.status(403).json({
            error: 'Unauthorized',
            message: authFailReason,
            // Add debug info in development
            ...(process.env.NODE_ENV === 'development' && {
                _debug: {
                    reason: 'unauthorized',
                    authFailReason,
                    userRole: req.user?.role,
                    userTenantId: req.user?.tenantId,
                    cardTenantId: card.tenantId
                }
            })
        });
        return;
    }
}));
// Activate card
router.post('/activate', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin', 'cashier']), (0, validate_js_1.validate)(activateSchema), (0, asyncHandler_js_1.asyncHandler)(async (req, res, next) => {
    const { cardUid, storeId, customer, customerId } = req.body;
    const { tenantId } = req.user;
    // Check trial limits first
    const trialResult = await (0, trialService_js_1.trackCardActivation)(tenantId, cardUid);
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
router.put('/:cardUid/store', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, validate_js_1.validate)(updateStoreSchema), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
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
router.post('/:cardUid/block', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, validate_js_1.validate)(blockSchema), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
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
// Download individual QR code as image
router.get('/:cardUid/qr/download', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin', 'cashier']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { cardUid } = req.params;
    const { tenantId } = req.user;
    const { format = 'png', size = '300' } = req.query;
    if (!cardUid) {
        res.status(400).json({ error: 'Card UID is required' });
        return;
    }
    const card = await prisma.card.findFirst({
        where: { cardUid, tenantId }
    });
    if (!card) {
        res.status(404).json({ error: 'Card not found' });
        return;
    }
    try {
        const qrData = `${process.env.APP_BASE_URL}/c/${cardUid}`;
        const qrSize = parseInt(size) || 300;
        // Generate QR code
        const qrBuffer = await qrcode_1.default.toBuffer(qrData, {
            width: qrSize,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            },
            type: 'png'
        });
        let responseBuffer = qrBuffer;
        let contentType = 'image/png';
        let extension = 'png';
        // Convert to different formats if requested
        if (format === 'jpg' || format === 'jpeg') {
            responseBuffer = await (0, sharp_1.default)(qrBuffer)
                .jpeg({ quality: 95 })
                .toBuffer();
            contentType = 'image/jpeg';
            extension = 'jpg';
        }
        else if (format === 'svg') {
            const svgString = await qrcode_1.default.toString(qrData, {
                type: 'svg',
                width: qrSize,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
            responseBuffer = Buffer.from(svgString);
            contentType = 'image/svg+xml';
            extension = 'svg';
        }
        const filename = `qr-code-${cardUid}.${extension}`;
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(responseBuffer);
    }
    catch (error) {
        console.error('QR code generation error:', error);
        res.status(500).json({ error: 'Failed to generate QR code' });
    }
}));
// Download bulk QR codes as ZIP
router.post('/qr/bulk-download', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { tenantId } = req.user;
    const { cardUids, format = 'png', size = '300', includeLabels = true } = req.body;
    if (!cardUids || !Array.isArray(cardUids) || cardUids.length === 0) {
        res.status(400).json({ error: 'Card UIDs array is required' });
        return;
    }
    if (cardUids.length > 1000) {
        res.status(400).json({ error: 'Maximum 1000 cards allowed per download' });
        return;
    }
    try {
        const cards = await prisma.card.findMany({
            where: {
                cardUid: { in: cardUids },
                tenantId
            },
            include: {
                customer: true,
                store: true
            }
        });
        if (cards.length === 0) {
            res.status(404).json({ error: 'No cards found' });
            return;
        }
        const zip = new jszip_1.default();
        const qrSize = parseInt(size) || 300;
        for (const card of cards) {
            const qrData = `${process.env.APP_BASE_URL}/c/${card.cardUid}`;
            // Generate QR code
            const qrBuffer = await qrcode_1.default.toBuffer(qrData, {
                width: qrSize,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                },
                type: 'png'
            });
            let fileBuffer = qrBuffer;
            let extension = 'png';
            // Convert to different formats if requested
            if (format === 'jpg' || format === 'jpeg') {
                fileBuffer = await (0, sharp_1.default)(qrBuffer)
                    .jpeg({ quality: 95 })
                    .toBuffer();
                extension = 'jpg';
            }
            else if (format === 'svg') {
                const svgString = await qrcode_1.default.toString(qrData, {
                    type: 'svg',
                    width: qrSize,
                    margin: 2,
                    color: {
                        dark: '#000000',
                        light: '#FFFFFF'
                    }
                });
                fileBuffer = Buffer.from(svgString);
                extension = 'svg';
            }
            // Create filename with card info
            let filename = `${card.cardUid}.${extension}`;
            if (includeLabels && card.customer) {
                const customerName = `${card.customer.firstName}-${card.customer.lastName}`.replace(/[^a-zA-Z0-9-]/g, '');
                filename = `${card.cardUid}-${customerName}.${extension}`;
            }
            zip.file(filename, fileBuffer);
        }
        // Add a CSV file with card information
        if (includeLabels) {
            const csvData = [
                ['Card UID', 'Customer Name', 'Email', 'Phone', 'Store', 'Status', 'Balance'],
                ...cards.map(card => [
                    card.cardUid,
                    card.customer ? `${card.customer.firstName} ${card.customer.lastName}` : 'Unassigned',
                    card.customer?.email || '',
                    card.customer?.phone || '',
                    card.store?.name || 'Not assigned',
                    card.status,
                    (card.balanceCents / 100).toFixed(2)
                ])
            ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
            zip.file('card-info.csv', csvData);
        }
        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `qr-codes-${timestamp}.zip`;
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(zipBuffer);
    }
    catch (error) {
        console.error('Bulk QR download error:', error);
        res.status(500).json({ error: 'Failed to generate QR codes archive' });
    }
}));
// Generate print-ready QR codes for card printing
router.post('/qr/print-ready', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { tenantId } = req.user;
    const { cardUids, printFormat = 'standard', cardsPerPage = 8 } = req.body;
    if (!cardUids || !Array.isArray(cardUids) || cardUids.length === 0) {
        res.status(400).json({ error: 'Card UIDs array is required' });
        return;
    }
    const cards = await prisma.card.findMany({
        where: {
            cardUid: { in: cardUids },
            tenantId
        },
        include: {
            customer: true,
            store: true
        }
    });
    if (cards.length === 0) {
        res.status(404).json({ error: 'No cards found' });
        return;
    }
    try {
        const zip = new jszip_1.default();
        // Standard card size: 85.6mm x 53.98mm (credit card size)
        // Print resolution: 300 DPI
        const cardWidthPx = Math.round(85.6 * 300 / 25.4); // 1012px
        const cardHeightPx = Math.round(53.98 * 300 / 25.4); // 638px
        const qrSize = 200; // QR code size in pixels
        for (const card of cards) {
            const qrData = `${process.env.APP_BASE_URL}/c/${card.cardUid}`;
            // Generate QR code
            const qrBuffer = await qrcode_1.default.toBuffer(qrData, {
                width: qrSize,
                margin: 1,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                },
                type: 'png'
            });
            if (printFormat === 'standard') {
                // Single QR code per file (for individual card printing)
                zip.file(`${card.cardUid}-qr.png`, qrBuffer);
            }
            else if (printFormat === 'card-template') {
                // Create a card-sized template with QR code positioned for printing
                const cardCanvas = (0, sharp_1.default)({
                    create: {
                        width: cardWidthPx,
                        height: cardHeightPx,
                        channels: 3,
                        background: { r: 255, g: 255, b: 255 }
                    }
                });
                // Position QR code (you can adjust position based on your card design)
                const qrPositionX = cardWidthPx - qrSize - 50; // Right side with margin
                const qrPositionY = Math.round((cardHeightPx - qrSize) / 2); // Vertically centered
                const cardWithQr = await cardCanvas
                    .composite([{
                        input: qrBuffer,
                        left: qrPositionX,
                        top: qrPositionY
                    }])
                    .png()
                    .toBuffer();
                zip.file(`${card.cardUid}-card-template.png`, cardWithQr);
            }
        }
        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `print-ready-qr-codes-${timestamp}.zip`;
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(zipBuffer);
    }
    catch (error) {
        console.error('Print-ready QR generation error:', error);
        res.status(500).json({ error: 'Failed to generate print-ready QR codes' });
    }
}));
exports.default = router;
//# sourceMappingURL=cards.js.map