import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';

export interface TokenData {
  token: string;
  expiresAt: Date;
}

export class TokenService {
  /**
   * Generate a secure random token for email verification or password reset
   */
  static generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate an email verification token with expiry (24 hours)
   */
  static generateEmailVerificationToken(): TokenData {
    const token = this.generateSecureToken();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    return { token, expiresAt };
  }

  /**
   * Generate a password reset token with expiry (1 hour)
   */
  static generatePasswordResetToken(): TokenData {
    const token = this.generateSecureToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
    return { token, expiresAt };
  }

  /**
   * Generate a 6-digit OTP for email verification
   */
  static generateOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Generate a JWT token for temporary access (e.g., after email verification)
   */
  static generateTemporaryJWT(payload: object, expiresIn: string = '15m'): string {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is not defined');
    }
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: expiresIn as any });
  }

  /**
   * Verify and decode a JWT token
   */
  static verifyJWT(token: string): any {
    try {
      return jwt.verify(token, process.env.JWT_SECRET!);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Check if a token has expired
   */
  static isTokenExpired(expiresAt: Date): boolean {
    return new Date() > expiresAt;
  }

  /**
   * Hash a token for secure storage (one-way hash)
   */
  static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Compare a plain token with a hashed token
   */
  static compareToken(plainToken: string, hashedToken: string): boolean {
    const hashedPlainToken = this.hashToken(plainToken);
    return hashedPlainToken === hashedToken;
  }
}