import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import pino from 'pino';

import authRoutes from './routes/auth.js';
import cardRoutes from './routes/cards.js';
import customerRoutes from './routes/customers.js';
import transactionRoutes from './routes/transactions.js';
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
import webhookRoutes from './routes/webhooks.js';
import adminRoutes from './routes/admin.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';

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

// Webhooks need raw body access, so add before JSON parsing
app.use('/api/webhooks', webhookRoutes);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Request logging
app.use(requestLogger);

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
app.use('/api/platform', platformRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/card-orders', cardOrderRoutes); // Global card orders routes (pricing, etc.)
app.use('/api/t', tenantRoutes);
app.use('/api/stripe', stripeRoutes);

// Legacy tenant-scoped routes (with tenant middleware)
app.use('/api/t/:tenantSlug/cards', cardRoutes);
app.use('/api/t/:tenantSlug/customers', customerRoutes);
app.use('/api/t/:tenantSlug/transactions', transactionRoutes);
app.use('/api/t/:tenantSlug/rules', rulesRoutes);
app.use('/api/t/:tenantSlug/reports', reportRoutes);
app.use('/api/t/:tenantSlug/notifications', notificationRoutes);
app.use('/api/t/:tenantSlug/stores', storeRoutes);
app.use('/api/t/:tenantSlug/users', userRoutes);
app.use('/api/t/:tenantSlug/trial', trialRoutes);
app.use('/api/t/:tenantSlug/card-orders', cardOrderRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
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

export default app;