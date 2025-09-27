import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export function signToken(payload: any, expiresIn: string = '5m'): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: expiresIn } as any);
}

export function verifyToken(token: string): any {
  return jwt.verify(token, process.env.JWT_SECRET!);
}

export function generateHMAC(data: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

export function verifyHMAC(data: string, signature: string, secret: string): boolean {
  const expectedSignature = generateHMAC(data, secret);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}