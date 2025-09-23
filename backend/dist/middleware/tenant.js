"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireActiveSubscription = exports.resolveTenant = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const resolveTenant = async (req, res, next) => {
    try {
        const tenantSlug = req.params.tenantSlug;
        if (!tenantSlug) {
            return res.status(400).json({ error: 'Tenant slug required' });
        }
        const tenant = await prisma.tenant.findUnique({
            where: { slug: tenantSlug },
            include: {
                stores: true,
            }
        });
        if (!tenant) {
            return res.status(404).json({ error: 'Tenant not found' });
        }
        req.tenant = tenant;
        next();
        return;
    }
    catch (error) {
        console.error('Tenant resolution error:', error);
        return res.status(500).json({ error: 'Failed to resolve tenant' });
    }
};
exports.resolveTenant = resolveTenant;
const requireActiveSubscription = (req, res, next) => {
    const tenant = req.tenant;
    if (!tenant) {
        return res.status(400).json({ error: 'Tenant required' });
    }
    const isActive = tenant.subscriptionStatus === 'ACTIVE' ||
        tenant.subscriptionStatus === 'TRIALING' ||
        (tenant.subscriptionStatus === 'PAST_DUE' &&
            tenant.graceEndsAt &&
            new Date(tenant.graceEndsAt) > new Date());
    if (!isActive) {
        return res.status(402).json({
            error: 'Active subscription required',
            subscriptionStatus: tenant.subscriptionStatus
        });
    }
    next();
    return;
};
exports.requireActiveSubscription = requireActiveSubscription;
//# sourceMappingURL=tenant.js.map