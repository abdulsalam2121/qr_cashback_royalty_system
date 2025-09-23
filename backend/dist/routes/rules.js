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
const initializeDefaults_js_1 = require("../utils/initializeDefaults.js");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
// Initialize default rules endpoint
router.post('/initialize', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { tenantId } = req.user;
    try {
        await (0, initializeDefaults_js_1.initializeDefaultRules)(tenantId);
        // Fetch the newly created rules
        const [cashbackRules, tierRules] = await Promise.all([
            prisma.cashbackRule.findMany({
                where: { tenantId },
                orderBy: { category: 'asc' },
            }),
            prisma.tierRule.findMany({
                where: { tenantId },
                orderBy: { minTotalSpendCents: 'asc' },
            }),
        ]);
        res.json({
            message: 'Default rules initialized successfully',
            cashbackRules,
            tierRules
        });
    }
    catch (error) {
        console.error('Failed to initialize default rules:', error);
        res.status(500).json({ error: 'Failed to initialize default rules' });
    }
}));
const updateCashbackRulesSchema = zod_1.z.object({
    rules: zod_1.z.array(zod_1.z.object({
        category: zod_1.z.enum(['PURCHASE', 'REPAIR', 'OTHER']),
        baseRateBps: zod_1.z.number().int().min(0).max(10000),
        isActive: zod_1.z.boolean().optional(),
    }))
});
const updateTierRulesSchema = zod_1.z.object({
    rules: zod_1.z.array(zod_1.z.object({
        tier: zod_1.z.enum(['SILVER', 'GOLD', 'PLATINUM']),
        name: zod_1.z.string(),
        minTotalSpendCents: zod_1.z.number().int().min(0),
        baseRateBps: zod_1.z.number().int().min(0).max(10000),
        isActive: zod_1.z.boolean().optional(),
    }))
});
const createOfferSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    description: zod_1.z.string().optional(),
    rateMultiplierBps: zod_1.z.number().int().min(0).max(10000),
    startAt: zod_1.z.string().datetime(),
    endAt: zod_1.z.string().datetime(),
    isActive: zod_1.z.boolean().optional(),
});
const updateOfferSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().optional(),
    rateMultiplierBps: zod_1.z.number().int().min(0).max(10000).optional(),
    startAt: zod_1.z.string().datetime().optional(),
    endAt: zod_1.z.string().datetime().optional(),
    isActive: zod_1.z.boolean().optional(),
});
// Get cashback rules
router.get('/cashback', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { tenantId } = req.user;
    const rules = await prisma.cashbackRule.findMany({
        where: { tenantId },
        orderBy: { category: 'asc' },
    });
    res.json({ rules });
    return;
}));
// Update cashback rules
router.put('/cashback', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, validate_js_1.validate)(updateCashbackRulesSchema), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { rules } = req.body;
    const { tenantId } = req.user;
    const updatedRules = await Promise.all(rules.map(async (rule) => {
        return await prisma.cashbackRule.upsert({
            where: {
                tenantId_category: {
                    tenantId,
                    category: rule.category
                }
            },
            update: {
                baseRateBps: rule.baseRateBps,
                isActive: rule.isActive ?? true,
            },
            create: {
                tenantId,
                category: rule.category,
                baseRateBps: rule.baseRateBps,
                isActive: rule.isActive ?? true,
            },
        });
    }));
    res.json({ rules: updatedRules });
    return;
}));
// Get tier rules
router.get('/tiers', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { tenantId } = req.user;
    const rules = await prisma.tierRule.findMany({
        where: { tenantId },
        orderBy: { minTotalSpendCents: 'asc' },
    });
    res.json({ rules });
    return;
}));
// Update tier rules
router.put('/tiers', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, validate_js_1.validate)(updateTierRulesSchema), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { rules } = req.body;
    const { tenantId } = req.user;
    const updatedRules = await Promise.all(rules.map(async (rule) => {
        return await prisma.tierRule.upsert({
            where: {
                tenantId_tier: {
                    tenantId,
                    tier: rule.tier
                }
            },
            update: {
                name: rule.name,
                minTotalSpendCents: rule.minTotalSpendCents,
                baseRateBps: rule.baseRateBps,
                isActive: rule.isActive ?? true,
            },
            create: {
                tenantId,
                tier: rule.tier,
                name: rule.name,
                minTotalSpendCents: rule.minTotalSpendCents,
                baseRateBps: rule.baseRateBps,
                isActive: rule.isActive ?? true,
            },
        });
    }));
    res.json({ rules: updatedRules });
    return;
}));
// Get offers
router.get('/offers', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { tenantId } = req.user;
    const offers = await prisma.offer.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
    });
    res.json({ offers });
    return;
}));
// Create offer
router.post('/offers', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, validate_js_1.validate)(createOfferSchema), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { name, description, rateMultiplierBps, startAt, endAt, isActive } = req.body;
    const { tenantId } = req.user;
    const offer = await prisma.offer.create({
        data: {
            tenantId,
            name,
            description,
            rateMultiplierBps,
            startAt: new Date(startAt),
            endAt: new Date(endAt),
            isActive: isActive ?? true,
        },
    });
    res.status(201).json({ offer });
    return;
}));
// Update offer
router.put('/offers/:id', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, validate_js_1.validate)(updateOfferSchema), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { tenantId } = req.user;
    const updateData = req.body;
    // Check if offer exists
    const existingOffer = await prisma.offer.findFirst({
        where: { id, tenantId }
    });
    if (!existingOffer) {
        res.status(404).json({ error: 'Offer not found' });
        return;
    }
    // Convert date strings to Date objects
    const processedData = { ...updateData };
    if (processedData.startAt) {
        processedData.startAt = new Date(processedData.startAt);
    }
    if (processedData.endAt) {
        processedData.endAt = new Date(processedData.endAt);
    }
    const offer = await prisma.offer.update({
        where: { id },
        data: processedData,
    });
    res.json({ offer });
    return;
}));
// Delete offer
router.delete('/offers/:id', auth_js_1.auth, (0, rbac_js_1.rbac)(['tenant_admin']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const { tenantId } = req.user;
    // Check if offer exists
    const existingOffer = await prisma.offer.findFirst({
        where: { id, tenantId }
    });
    if (!existingOffer) {
        res.status(404).json({ error: 'Offer not found' });
        return;
    }
    await prisma.offer.delete({
        where: { id }
    });
    res.json({ message: 'Offer deleted successfully' });
    return;
}));
exports.default = router;
//# sourceMappingURL=rules.js.map