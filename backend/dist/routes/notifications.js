"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const asyncHandler_js_1 = require("../middleware/asyncHandler.js");
const validate_js_1 = require("../middleware/validate.js");
const auth_js_1 = require("../middleware/auth.js");
const rbac_js_1 = require("../middleware/rbac.js");
const notification_js_1 = require("../services/notification.js");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
const testNotificationSchema = zod_1.z.object({
    customerId: zod_1.z.string(),
    template: zod_1.z.enum(['CASHBACK_EARNED', 'CASHBACK_REDEEMED', 'TIER_UPGRADED', 'WELCOME']),
    variables: zod_1.z.record(zod_1.z.string()).optional(),
});
// Send test notification
router.post('/test', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, validate_js_1.validate)(testNotificationSchema), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { customerId, template, variables = {} } = req.body;
    const { tenantId } = req.user;
    // Verify customer exists
    const customer = await prisma.customer.findFirst({
        where: { id: customerId, tenantId }
    });
    if (!customer) {
        res.status(404).json({ error: 'Customer not found' });
        return;
    }
    // Default variables for testing
    const defaultVariables = {
        customerName: `${customer.firstName} ${customer.lastName}`,
        amount: '10.00',
        balance: '25.50',
        storeName: 'Main Store',
        cardUid: 'TEST001',
        newTier: 'GOLD',
        ...variables
    };
    try {
        await (0, notification_js_1.sendNotification)(customerId, template, defaultVariables, tenantId);
        res.json({ message: 'Test notification sent successfully' });
        return;
    }
    catch (error) {
        console.error('Failed to send test notification:', error);
        res.status(500).json({ error: 'Failed to send notification' });
        return;
    }
}));
// Get notification history
router.get('/', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { tenantId } = req.user;
    const { customerId, status, page = 1, limit = 50 } = req.query;
    const where = { tenantId };
    if (customerId) {
        where.customerId = customerId;
    }
    if (status) {
        where.status = status;
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
            where,
            include: {
                customer: {
                    select: { firstName: true, lastName: true, phone: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: Number(limit),
        }),
        prisma.notification.count({ where }),
    ]);
    res.json({
        notifications,
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
    });
    return;
}));
// Get notification statistics
router.get('/stats', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { tenantId } = req.user;
    const [totalNotifications, sentNotifications, failedNotifications, pendingNotifications] = await Promise.all([
        prisma.notification.count({ where: { tenantId } }),
        prisma.notification.count({ where: { tenantId, status: 'SENT' } }),
        prisma.notification.count({ where: { tenantId, status: 'FAILED' } }),
        prisma.notification.count({ where: { tenantId, status: 'PENDING' } }),
    ]);
    // Get notifications by template
    const templateStats = await prisma.notification.groupBy({
        by: ['template'],
        where: { tenantId },
        _count: {
            _all: true
        }
    });
    // Get notifications by channel
    const channelStats = await prisma.notification.groupBy({
        by: ['channel'],
        where: { tenantId },
        _count: {
            _all: true
        }
    });
    res.json({
        total: totalNotifications,
        sent: sentNotifications,
        failed: failedNotifications,
        pending: pendingNotifications,
        byTemplate: templateStats,
        byChannel: channelStats,
    });
    return;
}));
// Retry failed notifications
router.post('/retry-failed', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { tenantId } = req.user;
    const failedNotifications = await prisma.notification.findMany({
        where: {
            tenantId,
            status: 'FAILED',
            createdAt: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
        },
        take: 10 // Limit retries per request
    });
    let retriedCount = 0;
    for (const notification of failedNotifications) {
        try {
            await (0, notification_js_1.sendNotification)(notification.customerId, notification.template, notification.payload, tenantId, notification.channel);
            retriedCount++;
        }
        catch (error) {
            console.error(`Failed to retry notification ${notification.id}:`, error);
        }
    }
    res.json({
        message: `Retried ${retriedCount} of ${failedNotifications.length} failed notifications`
    });
    return;
}));
exports.default = router;
//# sourceMappingURL=notifications.js.map