import express, { Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();
const prisma = new PrismaClient();

// Customer session management
interface CustomerSession {
  cardUid: string;
  customerId: string;
  tenantId: string;
  createdAt: Date;
  expiresAt: Date;
}

// Store active sessions in memory (in production, use Redis)
const activeSessions = new Map<string, CustomerSession>();

// Validation schemas
const qrLoginSchema = z.object({
  cardUid: z.string().min(1, 'Card UID is required'),
  tenantSlug: z.string().nullable().optional()
});

const manualLoginSchema = z.object({
  cardUid: z.string().min(1, 'Card UID is required'),
  tenantSlug: z.string().nullable().optional()
});

// Generate secure session token
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Create customer session
function createSession(cardUid: string, customerId: string, tenantId: string): string {
  const sessionToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  activeSessions.set(sessionToken, {
    cardUid,
    customerId,
    tenantId,
    createdAt: new Date(),
    expiresAt
  });

  return sessionToken;
}

// Customer middleware for session validation
export const customerAuth = (req: Request & { customer?: any }, res: Response, next: any): void => {
  const sessionToken = req.headers.authorization?.replace('Bearer ', '') || 
                      req.cookies?.customerSession;

  if (!sessionToken) {
    res.status(401).json({ error: 'No session token provided' });
    return;
  }

  const session = activeSessions.get(sessionToken);
  
  if (!session || session.expiresAt < new Date()) {
    if (session) {
      activeSessions.delete(sessionToken);
    }
    res.status(401).json({ error: 'Session expired or invalid' });
    return;
  }

  req.customer = {
    cardUid: session.cardUid,
    customerId: session.customerId,
    tenantId: session.tenantId,
    sessionToken
  };

  next();
};

// QR Code Login - Card is scanned
router.post('/qr-login', validate(qrLoginSchema), asyncHandler(async (req: Request, res: Response) => {
  const { cardUid, tenantSlug } = req.body;

  try {
    // Find the card and associated customer
    const card = await prisma.card.findUnique({
      where: { cardUid },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            tier: true,
            totalSpend: true
          }
        },
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    if (!card) {
      res.status(404).json({ 
        error: 'Card not found',
        message: 'Invalid QR code or card UID' 
      });
      return;
    }

    if (card.status !== 'ACTIVE') {
      res.status(400).json({ 
        error: 'Card not active',
        message: 'This card is not active. Please contact support.' 
      });
      return;
    }

    if (!card.customer) {
      res.status(400).json({ 
        error: 'Card not assigned',
        message: 'This card is not assigned to a customer. Please visit a store to activate.' 
      });
      return;
    }

    // Validate tenant if provided
    if (tenantSlug && card.tenant.slug !== tenantSlug) {
      res.status(400).json({ 
        error: 'Invalid tenant',
        message: 'Card does not belong to this business' 
      });
      return;
    }

    // Create customer session
    const sessionToken = createSession(card.cardUid, card.customer.id, card.tenant.id);

    res.json({
      success: true,
      sessionToken,
      customer: card.customer,
      card: {
        id: card.id,
        cardUid: card.cardUid,
        balanceCents: card.balanceCents,
        status: card.status
      },
      tenant: card.tenant
    });
  } catch (error) {
    console.error('QR login error:', error);
    res.status(500).json({ 
      error: 'Login failed',
      message: 'Unable to process login. Please try again.' 
    });
  }
}));

// Manual Card UID Login
router.post('/manual-login', validate(manualLoginSchema), asyncHandler(async (req: Request, res: Response) => {
  const { cardUid, tenantSlug } = req.body;

  console.log(`Manual login attempt received:`, {
    cardUid: cardUid,
    tenantSlug: tenantSlug,
    body: req.body
  });

  try {
    const normalizedCardUid = cardUid.trim().toUpperCase();
    console.log(`Normalized cardUid: ${normalizedCardUid}`);
    
    // Find the card and associated customer
    const card = await prisma.card.findUnique({
      where: { cardUid: normalizedCardUid },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            tier: true,
            totalSpend: true
          }
        },
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    console.log(`Card lookup result:`, card ? 'Found' : 'Not found');

    if (!card) {
      console.log(`Card not found for UID: ${normalizedCardUid}`);
      res.status(404).json({ 
        error: 'Card not found',
        message: 'Invalid card UID. Please check and try again.' 
      });
      return;
    }

    if (card.status !== 'ACTIVE') {
      res.status(400).json({ 
        error: 'Card not active',
        message: 'This card is not active. Please contact support.' 
      });
      return;
    }

    if (!card.customer) {
      res.status(400).json({ 
        error: 'Card not assigned',
        message: 'This card is not assigned to a customer. Please visit a store to activate.' 
      });
      return;
    }

    // Validate tenant if provided
    if (tenantSlug && card.tenant.slug !== tenantSlug) {
      res.status(400).json({ 
        error: 'Invalid tenant',
        message: 'Card does not belong to this business' 
      });
      return;
    }

    // Create customer session
    const sessionToken = createSession(card.cardUid, card.customer.id, card.tenant.id);

    res.json({
      success: true,
      sessionToken,
      customer: card.customer,
      card: {
        id: card.id,
        cardUid: card.cardUid,
        balanceCents: card.balanceCents,
        status: card.status
      },
      tenant: card.tenant
    });
  } catch (error) {
    console.error('Manual login error:', error);
    res.status(500).json({ 
      error: 'Login failed',
      message: 'Unable to process login. Please try again.' 
    });
  }
}));

// Logout - invalidate session
router.post('/logout', customerAuth, asyncHandler(async (req: Request & { customer?: any }, res: Response) => {
  const { sessionToken } = req.customer;
  
  if (sessionToken) {
    activeSessions.delete(sessionToken);
  }

  res.json({ success: true, message: 'Logged out successfully' });
}));

// Verify session - check if session is still valid
router.get('/verify', customerAuth, asyncHandler(async (req: Request & { customer?: any }, res: Response) => {
  const { cardUid, customerId, tenantId } = req.customer;

  try {
    // Get fresh data
    const card = await prisma.card.findUnique({
      where: { cardUid },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            tier: true,
            totalSpend: true
          }
        },
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    if (!card || !card.customer) {
      res.status(401).json({ error: 'Session invalid' });
      return;
    }

    res.json({
      valid: true,
      customer: card.customer,
      card: {
        id: card.id,
        cardUid: card.cardUid,
        balanceCents: card.balanceCents,
        status: card.status
      },
      tenant: card.tenant
    });
  } catch (error) {
    console.error('Session verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
}));

export default router;