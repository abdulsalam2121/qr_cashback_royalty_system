// src/middleware/authUnified.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { verifyFirebaseToken, FirebaseUserRequest } from './verifyFirebaseToken.js';
import { PrismaClient } from '@prisma/client';
import { admin } from '../auth/firebaseAdmin.js';

const prisma = new PrismaClient();

export interface UnifiedAuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: string;
    tenantId?: string;
    storeId?: string;
  };
  firebaseUser?: {
    uid: string;
    email?: string;
    admin?: boolean;
    [key: string]: any;
  };
}

// Middleware that handles both Firebase tokens and JWT tokens
export const authUnified = async (
  req: UnifiedAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const cookieToken = req.cookies?.token;

    // Try Firebase token first
    if (token) {
      try {
        const decoded = await admin.auth().verifyIdToken(token);
        
        if (!decoded.email) {
          console.error('[authUnified] Firebase token has no email');
          res.status(401).json({ error: 'Invalid token: no email' });
          return;
        }
        
        // Find user in database using email
        const user = await prisma.user.findUnique({
          where: { email: decoded.email },
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
          console.error('[authUnified] User not found or inactive:', decoded.email);
          res.status(401).json({ error: 'User not found or inactive' });
          return;
        }

        // Populate req.user with database user info
        req.user = {
          userId: user.id,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
          ...(user.storeId && { storeId: user.storeId }),
        };

        // Also set firebaseUser for compatibility
        (req as any).firebaseUser = {
          uid: decoded.uid,
          email: decoded.email,
          admin: decoded.admin === true,
        };

        console.log('[authUnified] Firebase auth successful for user:', user.email, 'tenantId:', user.tenantId);
        next();
        return;
      } catch (firebaseError) {
        console.error('[authUnified] Firebase token verification failed:', firebaseError);
        // Don't return yet, try JWT as fallback
      }
    }

    // Try JWT token from cookie
    if (cookieToken) {
      try {
        const decoded = jwt.verify(cookieToken, process.env.JWT_SECRET!) as any;
        
        // Verify user still exists
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
          console.error('[authUnified] JWT user not found or inactive:', decoded.userId);
          res.status(401).json({ error: 'Invalid or expired token' });
          return;
        }

        req.user = {
          userId: user.id,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
          ...(user.storeId && { storeId: user.storeId }),
        };
        console.log('[authUnified] JWT auth successful for user:', user.email);
        next();
        return;
      } catch (jwtError) {
        console.error('[authUnified] JWT verification failed:', jwtError);
        // JWT token failed
      }
    }

    // No valid token found
    console.error('[authUnified] No valid token found');
    res.status(401).json({ error: 'Authentication required' });
    return;
  } catch (error) {
    console.error('[authUnified] Unexpected error:', error);
    res.status(500).json({ error: 'Authentication error' });
    return;
  }
};

