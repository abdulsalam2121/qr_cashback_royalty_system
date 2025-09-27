// src/middleware/authUnified.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { verifyFirebaseToken, FirebaseUserRequest } from './verifyFirebaseToken.js';
import { PrismaClient } from '@prisma/client';

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
        await verifyFirebaseToken(req as FirebaseUserRequest, res, () => {
          // Firebase token verified successfully
          next();
        });
        return;
      } catch (firebaseError) {
        // Firebase token failed, try JWT
      }
    }

    // Try JWT token from cookie
    if (cookieToken) {
      try {
        const decoded = jwt.verify(cookieToken, process.env.JWT_SECRET!) as any;
        req.user = {
          userId: decoded.userId,
          email: decoded.email,
          role: decoded.role,
          tenantId: decoded.tenantId,
          storeId: decoded.storeId,
        };
        next();
        return;
      } catch (jwtError) {
        // JWT token failed
      }
    }

    // No valid token found
    res.status(401).json({ error: 'Authentication required' });
    return;
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
    return;
  }
};

