"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const auth = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        // Verify user still exists and is active
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            include: {
                tenant: {
                    select: {
                        id: true,
                        slug: true,
                        name: true,
                        subscriptionStatus: true,
                    }
                }
            }
        });
        if (!user || !user.active) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        req.user = {
            userId: user.id,
            email: user.email,
            role: user.role,
            tenantId: user.tenantId,
            tenantSlug: user.tenant?.slug,
            storeId: user.storeId,
            firstName: user.firstName,
            lastName: user.lastName,
        };
        next();
        return;
    }
    catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(401).json({ error: 'Invalid token' });
    }
};
exports.auth = auth;
//# sourceMappingURL=auth.js.map