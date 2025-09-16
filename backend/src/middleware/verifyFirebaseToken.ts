// src/middleware/verifyFirebaseToken.ts
import { Request, Response, NextFunction } from 'express';
import { admin } from '../auth/firebaseAdmin.js';

export interface FirebaseUserRequest extends Request {
  firebaseUser?: {
    uid: string;
    email?: string;
    admin?: boolean;
    [key: string]: any;
  };
}

export const verifyFirebaseToken = async (
  req: FirebaseUserRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      console.error('[verifyFirebaseToken] Missing Firebase ID token in Authorization header:', req.headers.authorization);
      res.status(401).json({ error: 'Missing Firebase ID token' });
      return;
    }

    // Check if Firebase Admin is initialized
    if (!admin.apps.length) {
      console.error('[verifyFirebaseToken] Firebase Admin not initialized');
      res.status(500).json({ error: 'Firebase Admin not initialized' });
      return;
    }

    try {
      const decoded = await admin.auth().verifyIdToken(token);
      req.firebaseUser = {
        uid: decoded.uid,
        email: decoded.email || undefined,
        admin: decoded.admin === true,
        // Add other custom claims
        ...Object.keys(decoded).reduce((acc, key) => {
          if (!['uid', 'email', 'admin'].includes(key)) {
            acc[key] = decoded[key];
          }
          return acc;
        }, {} as any)
      };
      next();
    } catch (verifyError) {
      console.error('[verifyFirebaseToken] Token verification failed:', {
        error: verifyError,
        token: token,
        headers: req.headers,
        url: req.originalUrl,
      });
  res.status(401).json({ error: 'Invalid or expired Firebase ID token', details: String(verifyError) });
      return;
    }
  } catch (error) {
    console.error('[verifyFirebaseToken] Unexpected error:', error);
  res.status(500).json({ error: 'Unexpected error in token verification', details: String(error) });
    return;
  }
};
