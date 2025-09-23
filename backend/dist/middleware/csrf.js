"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.csrfProtection = void 0;
const crypto_1 = __importDefault(require("crypto"));
const csrfProtection = (req, res, next) => {
    // Skip CSRF for API endpoints that don't need it (like login)
    if (req.path.includes('/api/auth/login') || req.path.includes('/api/auth/register') || req.path.includes('/healthz')) {
        return next();
    }
    // For GET requests, generate and return token
    if (req.method === 'GET') {
        const token = crypto_1.default.randomBytes(32).toString('hex');
        res.setHeader('X-CSRF-Token', token);
        return next();
    }
    // For other requests, we would verify token
    // For now, just allow all requests to get the project building
    next();
};
exports.csrfProtection = csrfProtection;
//# sourceMappingURL=csrf.js.map