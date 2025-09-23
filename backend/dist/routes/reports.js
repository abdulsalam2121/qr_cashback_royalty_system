"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const asyncHandler_js_1 = require("../middleware/asyncHandler.js");
const auth_js_1 = require("../middleware/auth.js");
const rbac_js_1 = require("../middleware/rbac.js");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
// Get dashboard statistics
router.get('/dashboard', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin', 'cashier']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { tenantId, storeId, role } = req.user;
    const where = { tenantId };
    // Cashiers only see their store's data
    if (role === 'cashier' && storeId) {
        where.storeId = storeId;
    }
    const [totalCustomers, totalCards, totalTransactions, cashbackStats, activeOffers] = await Promise.all([
        prisma.customer.count({ where: { tenantId } }),
        prisma.card.count({ where: { tenantId } }),
        prisma.transaction.count({ where }),
        prisma.transaction.aggregate({
            where,
            _sum: {
                cashbackCents: true,
                amountCents: true,
            },
            _count: {
                _all: true
            }
        }),
        prisma.offer.count({
            where: {
                tenantId,
                isActive: true,
                startAt: { lte: new Date() },
                endAt: { gte: new Date() }
            }
        })
    ]);
    // Get cashback issued vs redeemed
    const [earnTransactions, redeemTransactions] = await Promise.all([
        prisma.transaction.aggregate({
            where: { ...where, type: 'EARN' },
            _sum: { cashbackCents: true }
        }),
        prisma.transaction.aggregate({
            where: { ...where, type: 'REDEEM' },
            _sum: { amountCents: true }
        })
    ]);
    res.json({
        totalCustomers,
        totalCards,
        totalTransactions,
        totalCashbackIssued: earnTransactions._sum.cashbackCents || 0,
        totalCashbackRedeemed: redeemTransactions._sum.amountCents || 0,
        activeOffers,
    });
}));
// Get transaction reports
router.get('/transactions', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin', 'cashier']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { tenantId, storeId, role } = req.user;
    const { from, to, storeFilter, category, type, page = 1, limit = 100 } = req.query;
    const where = { tenantId };
    // Cashiers only see their store's data
    if (role === 'cashier' && storeId) {
        where.storeId = storeId;
    }
    else if (storeFilter && role === 'tenant_admin') {
        where.storeId = storeFilter;
    }
    if (category) {
        where.category = category;
    }
    if (type) {
        where.type = type;
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
    const [transactions, total, summary] = await Promise.all([
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
        prisma.transaction.aggregate({
            where,
            _sum: {
                amountCents: true,
                cashbackCents: true,
            },
            _count: {
                _all: true
            }
        })
    ]);
    res.json({
        transactions,
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
        summary: {
            totalAmount: summary._sum.amountCents || 0,
            totalCashback: summary._sum.cashbackCents || 0,
            count: summary._count._all || 0,
        }
    });
}));
// Get top customers
router.get('/top-customers', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { tenantId } = req.user;
    const { limit = 50 } = req.query;
    const customers = await prisma.customer.findMany({
        where: { tenantId },
        include: {
            _count: {
                select: { transactions: true }
            },
            cards: {
                select: { balanceCents: true }
            }
        },
        orderBy: { totalSpend: 'desc' },
        take: Number(limit),
    });
    // Calculate total balance for each customer
    const customersWithBalance = customers.map(customer => ({
        ...customer,
        totalBalance: customer.cards.reduce((sum, card) => sum + card.balanceCents, 0)
    }));
    res.json({ customers: customersWithBalance });
}));
// Export customers CSV
router.get('/export/customers', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { tenantId } = req.user;
    const customers = await prisma.customer.findMany({
        where: { tenantId },
        include: {
            cards: {
                select: { balanceCents: true, status: true }
            },
            _count: {
                select: { transactions: true }
            }
        },
        orderBy: { createdAt: 'desc' },
    });
    // Generate CSV
    const csvHeader = 'ID,First Name,Last Name,Email,Phone,Tier,Total Spend,Total Balance,Active Cards,Total Transactions,Created At\n';
    const csvRows = customers.map(customer => {
        const totalBalance = customer.cards.reduce((sum, card) => sum + card.balanceCents, 0);
        const activeCards = customer.cards.filter(card => card.status === 'ACTIVE').length;
        return [
            customer.id,
            customer.firstName,
            customer.lastName,
            customer.email || '',
            customer.phone || '',
            customer.tier,
            (Number(customer.totalSpend) * 100).toFixed(0), // Convert to cents
            totalBalance,
            activeCards,
            customer._count.transactions,
            customer.createdAt.toISOString()
        ].join(',');
    }).join('\n');
    const csv = csvHeader + csvRows;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=customers.csv');
    res.send(csv);
}));
// Export transactions CSV
router.get('/export/transactions', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin', 'cashier']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { tenantId, storeId, role } = req.user;
    const { from, to, storeFilter, category, type } = req.query;
    const where = { tenantId };
    // Cashiers only see their store's data
    if (role === 'cashier' && storeId) {
        where.storeId = storeId;
    }
    else if (storeFilter && role === 'tenant_admin') {
        where.storeId = storeFilter;
    }
    if (category)
        where.category = category;
    if (type)
        where.type = type;
    if (from || to) {
        where.createdAt = {};
        if (from)
            where.createdAt.gte = new Date(from);
        if (to)
            where.createdAt.lte = new Date(to);
    }
    const transactions = await prisma.transaction.findMany({
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
    });
    // Generate CSV
    const csvHeader = 'ID,Date,Type,Category,Customer,Card UID,Store,Cashier,Amount,Cashback,Before Balance,After Balance,Note\n';
    const csvRows = transactions.map(tx => [
        tx.id,
        tx.createdAt.toISOString(),
        tx.type,
        tx.category,
        `${tx.customer.firstName} ${tx.customer.lastName}`,
        tx.card.cardUid,
        tx.store.name,
        `${tx.cashier.firstName} ${tx.cashier.lastName}`,
        tx.amountCents,
        tx.cashbackCents,
        tx.beforeBalanceCents,
        tx.afterBalanceCents,
        tx.note || ''
    ].join(',')).join('\n');
    const csv = csvHeader + csvRows;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=transactions.csv');
    res.send(csv);
}));
exports.default = router;
//# sourceMappingURL=reports.js.map