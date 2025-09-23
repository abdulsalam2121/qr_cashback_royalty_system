"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const client_1 = require("@prisma/client");
const pino_1 = __importDefault(require("pino"));
const auth_js_1 = __importDefault(require("./routes/auth.js"));
const cards_js_1 = __importDefault(require("./routes/cards.js"));
const customers_js_1 = __importDefault(require("./routes/customers.js"));
const transactions_js_1 = __importDefault(require("./routes/transactions.js"));
const rules_js_1 = __importDefault(require("./routes/rules.js"));
const reports_js_1 = __importDefault(require("./routes/reports.js"));
const notifications_js_1 = __importDefault(require("./routes/notifications.js"));
const stores_js_1 = __importDefault(require("./routes/stores.js"));
const users_js_1 = __importDefault(require("./routes/users.js"));
const platform_js_1 = __importDefault(require("./routes/platform.js"));
const tenant_js_1 = __importDefault(require("./routes/tenant.js"));
const stripe_js_1 = __importDefault(require("./routes/stripe.js"));
const trial_js_1 = __importDefault(require("./routes/trial.js"));
const cardOrders_js_1 = __importDefault(require("./routes/cardOrders.js"));
const cardPrintOrders_js_1 = __importDefault(require("./routes/cardPrintOrders.js"));
const webhooks_js_1 = __importDefault(require("./routes/webhooks.js"));
const admin_js_1 = __importDefault(require("./routes/admin.js"));
const errorHandler_js_1 = require("./middleware/errorHandler.js");
const requestLogger_js_1 = require("./middleware/requestLogger.js");
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
const logger = (0, pino_1.default)();
// Security middleware
app.use((0, helmet_1.default)({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
}));
app.use((0, cors_1.default)({
    origin: [
        process.env.FRONTEND_URL || 'http://localhost:5173',
        'http://localhost:5173',
        'http://localhost:5174'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
}));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 login requests per windowMs
    message: { error: 'Too many login attempts from this IP, please try again later.' },
    skipSuccessfulRequests: true,
});
const transactionLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // limit each IP to 10 transaction requests per minute
    message: { error: 'Too many transaction requests, please slow down.' },
});
app.use(limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/transactions', transactionLimiter);
// Webhooks need raw body access, so add before JSON parsing
app.use('/api/webhooks', webhooks_js_1.default);
// Body parsing middleware
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
app.use((0, cookie_parser_1.default)());
// Request logging
app.use(requestLogger_js_1.requestLogger);
// Health check endpoint
app.get('/healthz', async (req, res) => {
    try {
        // Test database connection
        await prisma.$queryRaw `SELECT 1`;
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: process.env.npm_package_version || '1.0.0',
            database: 'connected'
        });
    }
    catch (error) {
        logger.error({ error }, 'Health check failed');
        res.status(503).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            database: 'disconnected',
            error: 'Database connection failed'
        });
    }
});
// API routes
app.use('/api/auth', auth_js_1.default);
app.use('/api/platform', platform_js_1.default);
app.use('/api/admin', admin_js_1.default);
app.use('/api/card-orders', cardOrders_js_1.default); // Global card orders routes (pricing, etc.)
app.use('/api/t', tenant_js_1.default);
app.use('/api/stripe', stripe_js_1.default);
// Legacy tenant-scoped routes (with tenant middleware)
app.use('/api/t/:tenantSlug/cards', cards_js_1.default);
app.use('/api/t/:tenantSlug/customers', customers_js_1.default);
app.use('/api/t/:tenantSlug/transactions', transactions_js_1.default);
app.use('/api/t/:tenantSlug/rules', rules_js_1.default);
app.use('/api/t/:tenantSlug/reports', reports_js_1.default);
app.use('/api/t/:tenantSlug/notifications', notifications_js_1.default);
app.use('/api/t/:tenantSlug/stores', stores_js_1.default);
app.use('/api/t/:tenantSlug/users', users_js_1.default);
app.use('/api/t/:tenantSlug/trial', trial_js_1.default);
app.use('/api/t/:tenantSlug/card-orders', cardOrders_js_1.default);
app.use('/api/t/:tenantSlug/card-print-orders', cardPrintOrders_js_1.default);
// Error handling
app.use(errorHandler_js_1.errorHandler);
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
// Graceful shutdown
const gracefulShutdown = async (signal) => {
    logger.info(`${signal} received, shutting down gracefully`);
    await prisma.$disconnect();
    process.exit(0);
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT}`);
    logger.info(`📊 Health check available at http://localhost:${PORT}/healthz`);
});
exports.default = app;
//# sourceMappingURL=index.js.map