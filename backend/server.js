import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import pino from 'pino';

import authRoutes from './dist/routes/auth.js';
import cardRoutes from './dist/routes/cards.js';
import customerRoutes from './dist/routes/customers.js';
import transactionRoutes from './dist/routes/transactions.js';
import rulesRoutes from './dist/routes/rules.js';
import reportRoutes from './dist/routes/reports.js';
import notificationRoutes from './dist/routes/notifications.js';
import storeRoutes from './dist/routes/stores.js';
import userRoutes from './dist/routes/users.js';
import platformRoutes from './dist/routes/platform.js';
import tenantRoutes from './dist/routes/tenant.js';
import stripeRoutes from './dist/routes/stripe.js';
import trialRoutes from './dist/routes/trial.js';
import cardOrderRoutes from './dist/routes/cardOrders.js';
import adminRoutes from './dist/routes/admin.js';
import customerAuthRoutes from './dist/routes/customerAuth.js';
import customerDashboardRoutes from './dist/routes/customerDashboard.js';
import publicCardRoutes from './dist/routes/publicCards.js';
import purchaseTransactionRoutes from './dist/routes/purchaseTransactions.js';
import cardPrintOrderRoutes from './dist/routes/cardPrintOrders.js';
import repairRoutes from './dist/routes/repairs.js';
import webhookRoutes from './dist/routes/webhooks.js';
import { customerAuthLimiter, customerAPILimiter } from './dist/middleware/customerSecurity.js';
import { errorHandler } from './dist/middleware/errorHandler.js';
import { requestLogger } from './dist/middleware/requestLogger.js';

const app = express();
const prisma = new PrismaClient();
const logger = pino();

// START DEBUG - This should show up in logs if deployed correctly

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

// Trust proxy for rate limiting behind reverse proxy
// app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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
app.use('/api/webhooks', webhookRoutes);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Request logging
app.use(requestLogger);

// Debug middleware to log all requests
app.use((req, res, next) => {
  next();
});

// Health check endpoint
app.get('/healthz', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      database: 'connected'
    });
  } catch (error) {
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
app.use('/api/admin', adminRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/card-orders', cardOrderRoutes); // Global card orders routes (pricing, etc.)
app.use('/api/t', tenantRoutes);
app.use('/api/stripe', stripeRoutes);

// Public routes (accessible without tenant context)
app.use('/api/purchase-transactions', purchaseTransactionRoutes);
app.use('/api/cards', publicCardRoutes);

// Customer dashboard routes (public, session-based)
app.use('/api/customer-auth', customerAuthLimiter, customerAuthRoutes);
app.use('/api/customer', customerAPILimiter, customerDashboardRoutes);

// Legacy tenant-scoped routes (with tenant middleware)
app.use('/api/t/:tenantSlug/cards', cardRoutes);
app.use('/api/t/:tenantSlug/customers', customerRoutes);
app.use('/api/t/:tenantSlug/transactions', transactionRoutes);
app.use('/api/t/:tenantSlug/purchase-transactions', purchaseTransactionRoutes);
app.use('/api/t/:tenantSlug/rules', rulesRoutes);
app.use('/api/t/:tenantSlug/reports', reportRoutes);
app.use('/api/t/:tenantSlug/notifications', notificationRoutes);
app.use('/api/t/:tenantSlug/stores', storeRoutes);
app.use('/api/t/:tenantSlug/users', userRoutes);
app.use('/api/t/:tenantSlug/trial', trialRoutes);
app.use('/api/t/:tenantSlug/card-orders', cardOrderRoutes);
app.use('/api/t/:tenantSlug/card-print-orders', cardPrintOrderRoutes);
app.use('/api/t/:tenantSlug/repairs', repairRoutes);


// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received, shutting down gracefully`);
  try {
    await prisma.$disconnect();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error({ error }, 'Error during graceful shutdown');
  }
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR1', () => gracefulShutdown('SIGUSR1')); // PM2 reload signal
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // PM2 graceful reload signal

const PORT = process.env.PORT || 3002;
const HOST = process.env.HOST || '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  logger.info(`🚀 Server running on ${HOST}:${PORT}`);
  logger.info(`📊 Health check available at http://${HOST}:${PORT}/healthz`);
  logger.info(`🔧 Process ID: ${process.pid}`);
  logger.info(`📂 Working directory: ${process.cwd()}`);
  logger.info(`⚡ Node.js version: ${process.version}`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Handle server errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use`);
  } else {
    logger.error({ error }, 'Server error');
  }
  process.exit(1);
});

export default app;
