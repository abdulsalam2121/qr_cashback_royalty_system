"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const decimal_js_1 = require("decimal.js");
const asyncHandler_js_1 = require("../middleware/asyncHandler.js");
const validate_js_1 = require("../middleware/validate.js");
const auth_js_1 = require("../middleware/auth.js");
const rbac_js_1 = require("../middleware/rbac.js");
const cashback_js_1 = require("../utils/cashback.js");
const notification_js_1 = require("../services/notification.js");
const tiers_js_1 = require("../utils/tiers.js");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
const earnSchema = zod_1.z.object({
    cardUid: zod_1.z.string(),
    amountCents: zod_1.z.number().int().positive(),
    category: zod_1.z.enum(['PURCHASE', 'REPAIR', 'OTHER']),
    storeId: zod_1.z.string(),
    note: zod_1.z.string().optional(),
});
const redeemSchema = zod_1.z.object({
    cardUid: zod_1.z.string(),
    amountCents: zod_1.z.number().int().positive(),
    storeId: zod_1.z.string(),
    note: zod_1.z.string().optional(),
});
// Earn cashback
router.post('/earn', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin', 'cashier']), (0, validate_js_1.validate)(earnSchema), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { cardUid, amountCents, category, storeId, note } = req.body;
    const { tenantId, userId: cashierId } = req.user;
    const result = await prisma.$transaction(async (tx) => {
        // Get card with customer and current balance
        const card = await tx.card.findUnique({
            where: { cardUid },
            include: {
                customer: true,
                store: true
            },
        });
        if (!card) {
            throw new Error('Card not found');
        }
        if (card.tenantId !== tenantId) {
            throw new Error('Unauthorized');
        }
        if (card.status !== 'ACTIVE') {
            throw new Error('Card is not active');
        }
        if (!card.customer) {
            throw new Error('Card is not linked to a customer');
        }
        // Enforce store binding
        if (card.storeId !== storeId) {
            throw new Error(`This card can only be used at ${card.store?.name}. Current store binding prevents cross-store transactions.`);
        }
        // Verify store exists
        const store = await tx.store.findFirst({
            where: { id: storeId, tenantId }
        });
        if (!store) {
            throw new Error('Store not found');
        }
        // Calculate cashback
        const cashbackCents = await (0, cashback_js_1.calculateCashback)(amountCents, category, card.customer.tier, tenantId, tx);
        const beforeBalanceCents = card.balanceCents;
        const afterBalanceCents = beforeBalanceCents + cashbackCents;
        // Create transaction record
        const transaction = await tx.transaction.create({
            data: {
                tenantId,
                storeId,
                cardId: card.id,
                customerId: card.customerId,
                cashierId,
                type: 'EARN',
                category: category,
                amountCents,
                cashbackCents,
                beforeBalanceCents,
                afterBalanceCents,
                note,
                sourceIp: req.ip || null,
            },
            include: {
                customer: true,
                store: true,
                cashier: {
                    select: { firstName: true, lastName: true }
                }
            }
        });
        // Update card balance
        await tx.card.update({
            where: { id: card.id },
            data: { balanceCents: afterBalanceCents }
        });
        // Update customer total spend
        const newTotalSpend = new decimal_js_1.Decimal(card.customer.totalSpend).add(new decimal_js_1.Decimal(amountCents).div(100));
        await tx.customer.update({
            where: { id: card.customerId },
            data: { totalSpend: newTotalSpend }
        });
        // Check for tier upgrade
        const updatedCustomer = await (0, tiers_js_1.updateCustomerTier)(card.customerId, tenantId, tx);
        return { transaction, customer: updatedCustomer, storeName: card.store?.name };
    });
    // Send notification (async, don't block response)
    setImmediate(async () => {
        try {
            await (0, notification_js_1.sendNotification)(result.transaction.customerId, 'CASHBACK_EARNED', {
                customerName: `${result.customer.firstName} ${result.customer.lastName}`,
                amount: (result.transaction.cashbackCents / 100).toFixed(2),
                balance: (result.transaction.afterBalanceCents / 100).toFixed(2),
                storeName: result.storeName || 'Unknown Store',
                transactionAmount: (result.transaction.amountCents / 100).toFixed(2),
            }, tenantId);
        }
        catch (error) {
            console.error('Failed to send notification:', error);
        }
    });
    res.json({
        message: 'Cashback earned successfully',
        transaction: result.transaction,
        cashbackEarned: result.transaction.cashbackCents,
        newBalance: result.transaction.afterBalanceCents,
    });
}));
// Redeem cashback
router.post('/redeem', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin', 'cashier']), (0, validate_js_1.validate)(redeemSchema), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { cardUid, amountCents, storeId, note } = req.body;
    const { tenantId, userId: cashierId } = req.user;
    const result = await prisma.$transaction(async (tx) => {
        // Get card with customer and current balance
        const card = await tx.card.findUnique({
            where: { cardUid },
            include: {
                customer: true,
                store: true
            },
        });
        if (!card) {
            throw new Error('Card not found');
        }
        if (card.tenantId !== tenantId) {
            throw new Error('Unauthorized');
        }
        if (card.status !== 'ACTIVE') {
            throw new Error('Card is not active');
        }
        if (!card.customer) {
            throw new Error('Card is not linked to a customer');
        }
        // Enforce store binding
        if (card.storeId !== storeId) {
            throw new Error(`This card can only be used at ${card.store?.name}. Current store binding prevents cross-store transactions.`);
        }
        // Check sufficient balance
        if (card.balanceCents < amountCents) {
            throw new Error('Insufficient balance for redemption');
        }
        // Verify store exists
        const store = await tx.store.findFirst({
            where: { id: storeId, tenantId }
        });
        if (!store) {
            throw new Error('Store not found');
        }
        const beforeBalanceCents = card.balanceCents;
        const afterBalanceCents = beforeBalanceCents - amountCents;
        // Create transaction record
        const transaction = await tx.transaction.create({
            data: {
                tenantId,
                storeId,
                cardId: card.id,
                customerId: card.customerId,
                cashierId,
                type: 'REDEEM',
                category: 'OTHER',
                amountCents,
                cashbackCents: 0,
                beforeBalanceCents,
                afterBalanceCents,
                note,
                sourceIp: req.ip || null,
            },
            include: {
                customer: true,
                store: true,
                cashier: {
                    select: { firstName: true, lastName: true }
                }
            }
        });
        // Update card balance
        await tx.card.update({
            where: { id: card.id },
            data: { balanceCents: afterBalanceCents }
        });
        return {
            ...transaction,
            customer: card.customer,
            store: card.store
        };
    });
    // Send notification (async, don't block response)
    setImmediate(async () => {
        try {
            await (0, notification_js_1.sendNotification)(result.customerId, 'CASHBACK_REDEEMED', {
                customerName: `${result.customer.firstName} ${result.customer.lastName}`,
                amount: (result.amountCents / 100).toFixed(2),
                balance: (result.afterBalanceCents / 100).toFixed(2),
                storeName: result.store?.name || 'Unknown Store',
            }, tenantId);
        }
        catch (error) {
            console.error('Failed to send notification:', error);
        }
    });
    res.json({
        message: 'Cashback redeemed successfully',
        transaction: result,
        amountRedeemed: result.amountCents,
        newBalance: result.afterBalanceCents,
    });
}));
// Get transactions
router.get('/', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin', 'cashier']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { tenantId, storeId, role } = req.user;
    const { type, category, customerId, cardUid, storeFilter, from, to, page = 1, limit = 50 } = req.query;
    const where = { tenantId };
    // Cashiers can only see transactions from their store
    if (role === 'cashier' && storeId) {
        where.storeId = storeId;
    }
    if (type) {
        where.type = type;
    }
    if (category) {
        where.category = category;
    }
    if (customerId) {
        where.customerId = customerId;
    }
    if (cardUid) {
        where.card = { cardUid };
    }
    if (storeFilter && role === 'admin') {
        where.storeId = storeFilter;
    }
    if (from || to) {
        where.createdAt = {};
        if (from) {
            where.createdAt.gte = new Date(from);
        }
        if (to) {
            where.createdAt.lte = new Date(to);
        }
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
            where,
            include: {
                customer: {
                    select: { firstName: true, lastName: true, tier: true }
                },
                card: {
                    select: { cardUid: true }
                },
                store: {
                    select: { name: true }
                },
                cashier: {
                    select: { firstName: true, lastName: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: Number(limit),
        }),
        prisma.transaction.count({ where }),
    ]);
    // Flatten the nested structure for the frontend
    const flattenedTransactions = transactions.map(transaction => ({
        ...transaction,
        customerName: transaction.customer ?
            `${transaction.customer.firstName} ${transaction.customer.lastName}` : '',
        cardUid: transaction.card?.cardUid || '',
        storeName: transaction.store?.name || '',
        cashierName: transaction.cashier ?
            `${transaction.cashier.firstName} ${transaction.cashier.lastName}` : '',
        // Remove the nested objects to avoid confusion
        customer: undefined,
        card: undefined,
        store: undefined,
        cashier: undefined,
    }));
    res.json({
        transactions: flattenedTransactions,
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
    });
}));
// Get transaction by ID
router.get('/:id', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin', 'cashier']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { tenantId, storeId, role } = req.user;
    const where = { id, tenantId };
    // Cashiers can only see transactions from their store
    if (role === 'cashier' && storeId) {
        where.storeId = storeId;
    }
    const transaction = await prisma.transaction.findFirst({
        where,
        include: {
            customer: true,
            card: {
                select: { cardUid: true, qrUrl: true }
            },
            store: true,
            cashier: {
                select: { firstName: true, lastName: true, email: true }
            }
        },
    });
    if (!transaction) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
    }
    res.json(transaction);
    return;
}));
exports.default = router;
//# sourceMappingURL=transactions.js.map