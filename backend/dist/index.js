import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import pino from 'pino';
// START DEBUG - This should show up in logs if deployed correctly
console.log('🚀 SERVER STARTING - Index.ts loaded at:', new Date().toISOString());
console.log('🔧 NODE_ENV:', process.env.NODE_ENV);
console.log('🌍 Working directory:', process.cwd());
import authRoutes from './routes/auth.js';
import cardRoutes from './routes/cards.js';
import publicCardRoutes from './routes/publicCards.js';
import customerRoutes from './routes/customers.js';
import transactionRoutes from './routes/transactions.js';
import purchaseTransactionRoutes from './routes/purchaseTransactions.js';
import rulesRoutes from './routes/rules.js';
import reportRoutes from './routes/reports.js';
import notificationRoutes from './routes/notifications.js';
import storeRoutes from './routes/stores.js';
import userRoutes from './routes/users.js';
import platformRoutes from './routes/platform.js';
import tenantRoutes from './routes/tenant.js';
import stripeRoutes from './routes/stripe.js';
import trialRoutes from './routes/trial.js';
import cardOrderRoutes from './routes/cardOrders.js';
import cardPrintOrderRoutes from './routes/cardPrintOrders.js';
import webhookRoutes from './routes/webhooks.js';
import adminRoutes from './routes/admin.js';
import customerAuthRoutes from './routes/customerAuth.js';
import customerDashboardRoutes from './routes/customerDashboard.js';
import { customerAuthLimiter, customerAPILimiter } from './middleware/customerSecurity.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
// Debug: Check if cardPrintOrderRoutes is loaded correctly
console.log('📦 cardPrintOrderRoutes loaded:', !!cardPrintOrderRoutes, typeof cardPrintOrderRoutes);
const app = express();
const prisma = new PrismaClient();
const logger = pino();
// Security middleware
app.use(helmet({
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
app.use(cors({
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
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 login requests per windowMs
    message: { error: 'Too many login attempts from this IP, please try again later.' },
    skipSuccessfulRequests: true,
});
const transactionLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // limit each IP to 10 transaction requests per minute
    message: { error: 'Too many transaction requests, please slow down.' },
});
app.use(limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/transactions', transactionLimiter);
// Stripe webhook endpoint needs raw body for signature verification
// This must come BEFORE the express.json() middleware
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
// Webhooks need raw body access, so add before JSON parsing
app.use('/api/webhooks', webhookRoutes);
// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
// Request logging
app.use(requestLogger);
// Debug middleware to log all requests
app.use((req, res, next) => {
    console.log(`🔍 ${req.method} ${req.url} - ${new Date().toISOString()}`);
    next();
});
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
app.use('/api/auth', authRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/card-orders', cardOrderRoutes); // Global card orders routes (pricing, etc.)
app.use('/api/stripe', stripeRoutes);
// Public routes (accessible without tenant context)
app.use('/api/purchase-transactions', purchaseTransactionRoutes);
app.use('/api/cards', publicCardRoutes);
// Customer dashboard routes (public, session-based)
app.use('/api/customer-auth', customerAuthLimiter, customerAuthRoutes);
app.use('/api/customer', customerAPILimiter, customerDashboardRoutes);
// Tenant-scoped routes (must come before /api/t to avoid conflicts)
console.log('🔧 Registering tenant-scoped routes...');
app.use('/api/t/:tenantSlug/cards', cardRoutes);
app.use('/api/t/:tenantSlug/customers', customerRoutes);
app.use('/api/t/:tenantSlug/transactions', transactionRoutes);
console.log('🔧 Registering purchase-transactions route...');
app.use('/api/t/:tenantSlug/purchase-transactions', purchaseTransactionRoutes);
app.use('/api/t/:tenantSlug/rules', rulesRoutes);
app.use('/api/t/:tenantSlug/reports', reportRoutes);
app.use('/api/t/:tenantSlug/notifications', notificationRoutes);
app.use('/api/t/:tenantSlug/stores', storeRoutes);
app.use('/api/t/:tenantSlug/users', userRoutes);
app.use('/api/t/:tenantSlug/trial', trialRoutes);
app.use('/api/t/:tenantSlug/card-orders', cardOrderRoutes);
console.log('🖨️ Registering cardPrintOrderRoutes at /api/t/:tenantSlug/card-print-orders');
app.use('/api/t/:tenantSlug/card-print-orders', cardPrintOrderRoutes);
// General tenant routes (must come after specific tenant-scoped routes)
app.use('/api/t', tenantRoutes);
// Error handling
app.use(errorHandler);
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
    console.log('✅ SERVER FULLY STARTED - Routes should be registered now');
    console.log('🖨️ Card Print Orders route should be available at: /api/t/:tenantSlug/card-print-orders');
});
export default app;
//# sourceMappingURL=index.js.map