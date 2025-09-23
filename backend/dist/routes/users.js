"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const asyncHandler_js_1 = require("../middleware/asyncHandler.js");
const validate_js_1 = require("../middleware/validate.js");
const auth_js_1 = require("../middleware/auth.js");
const rbac_js_1 = require("../middleware/rbac.js");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
const createUserSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
    firstName: zod_1.z.string().min(1),
    lastName: zod_1.z.string().min(1),
    role: zod_1.z.enum(['tenant_admin', 'cashier', 'customer']),
    storeId: zod_1.z.string().optional(),
});
const updateUserSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1).optional(),
    lastName: zod_1.z.string().min(1).optional(),
    role: zod_1.z.enum(['tenant_admin', 'cashier', 'customer']).optional(),
    storeId: zod_1.z.string().optional(),
    active: zod_1.z.boolean().optional(),
});
// Get all users
router.get('/', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { tenantId } = req.user;
    const users = await prisma.user.findMany({
        where: { tenantId },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            active: true,
            createdAt: true,
            lastLogin: true,
            store: {
                select: { id: true, name: true }
            }
        },
        orderBy: { createdAt: 'desc' },
    });
    res.json({ users });
    return;
}));
// Get user by ID
router.get('/:id', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { tenantId } = req.user;
    const { id } = req.params;
    const user = await prisma.user.findFirst({
        where: { id, tenantId },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            active: true,
            createdAt: true,
            lastLogin: true,
            store: {
                select: { id: true, name: true }
            }
        },
    });
    if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    res.json({ user });
    return;
}));
// Create user
router.post('/', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, validate_js_1.validate)(createUserSchema), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { tenantId } = req.user;
    const { email, firstName, lastName, password, role, storeId } = req.body;
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
        where: { email },
    });
    if (existingUser) {
        res.status(400).json({ error: 'User with this email already exists' });
        return;
    }
    // Hash password
    const hashedPassword = await bcryptjs_1.default.hash(password, 12);
    // Create user
    const user = await prisma.user.create({
        data: {
            email,
            firstName,
            lastName,
            passwordHash: hashedPassword,
            role,
            tenantId,
            storeId,
        },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            active: true,
            createdAt: true,
            store: {
                select: { id: true, name: true }
            }
        },
    });
    res.status(201).json({ user });
    return;
}));
// Update user
router.put('/:id', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, validate_js_1.validate)(updateUserSchema), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { tenantId } = req.user;
    const updateData = req.body;
    // Check if user exists
    const existingUser = await prisma.user.findFirst({
        where: { id, tenantId }
    });
    if (!existingUser) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    // Verify store exists if being updated
    if (updateData.storeId) {
        const store = await prisma.store.findFirst({
            where: { id: updateData.storeId, tenantId }
        });
        if (!store) {
            res.status(400).json({ error: 'Store not found' });
            return;
        }
    }
    const user = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            active: true,
            createdAt: true,
            store: {
                select: { id: true, name: true }
            }
        }
    });
    res.json({ user });
    return;
}));
// Change password
router.put('/:id/password', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { tenantId } = req.user;
    const { password } = req.body;
    if (!password || password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters' });
        return;
    }
    // Check if user exists
    const existingUser = await prisma.user.findFirst({
        where: { id, tenantId }
    });
    if (!existingUser) {
        res.status(404).json({ error: 'User not found' });
        return;
    }
    const passwordHash = await bcryptjs_1.default.hash(password, 12);
    await prisma.user.update({
        where: { id },
        data: { passwordHash }
    });
    res.json({ message: 'Password updated successfully' });
    return;
}));
exports.default = router;
//# sourceMappingURL=users.js.map