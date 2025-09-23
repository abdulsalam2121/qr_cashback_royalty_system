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
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
const createStoreSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    address: zod_1.z.string().optional(),
});
const updateStoreSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    address: zod_1.z.string().optional(),
    active: zod_1.z.boolean().optional(),
});
// Get all stores
router.get('/', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { tenantId } = req.user;
    const stores = await prisma.store.findMany({
        where: { tenantId },
        include: {
            _count: {
                select: {
                    users: true,
                    cards: true,
                    transactions: true
                }
            }
        },
        orderBy: { createdAt: 'desc' },
    });
    res.json({ stores });
    return;
}));
// Get store by ID
router.get('/:id', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { tenantId } = req.user;
    const store = await prisma.store.findFirst({
        where: { id, tenantId },
        include: {
            users: {
                select: { id: true, firstName: true, lastName: true, email: true, role: true }
            },
            _count: {
                select: {
                    cards: true,
                    transactions: true
                }
            }
        },
    });
    if (!store) {
        res.status(404).json({ error: 'Store not found' });
        return;
    }
    res.json(store);
    return;
}));
// Create store
router.post('/', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, validate_js_1.validate)(createStoreSchema), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { name, address } = req.body;
    const { tenantId } = req.user;
    const store = await prisma.store.create({
        data: {
            tenantId,
            name,
            address,
            active: true,
        },
    });
    res.status(201).json({ store });
    return;
}));
// Update store
router.put('/:id', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, validate_js_1.validate)(updateStoreSchema), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { tenantId } = req.user;
    const updateData = req.body;
    // Check if store exists
    const existingStore = await prisma.store.findFirst({
        where: { id, tenantId }
    });
    if (!existingStore) {
        res.status(404).json({ error: 'Store not found' });
        return;
    }
    const store = await prisma.store.update({
        where: { id },
        data: updateData,
    });
    res.json({ store });
    return;
}));
// Delete store (soft delete by setting active to false)
router.delete('/:id', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { tenantId } = req.user;
    // Check if store exists
    const existingStore = await prisma.store.findFirst({
        where: { id, tenantId }
    });
    if (!existingStore) {
        res.status(404).json({ error: 'Store not found' });
        return;
    }
    // Check if store has active cards or users
    const [activeCards, activeUsers] = await Promise.all([
        prisma.card.count({ where: { storeId: id, status: 'ACTIVE' } }),
        prisma.user.count({ where: { storeId: id, active: true } })
    ]);
    if (activeCards > 0 || activeUsers > 0) {
        res.status(400).json({
            error: 'Cannot delete store with active cards or users. Deactivate first.'
        });
        return;
    }
    const store = await prisma.store.update({
        where: { id },
        data: { active: false },
    });
    res.json({ message: 'Store deactivated successfully', store });
    return;
}));
exports.default = router;
//# sourceMappingURL=stores.js.map