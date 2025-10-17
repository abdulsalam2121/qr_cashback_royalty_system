import jwt from 'jsonwebtoken';
import crypto from 'crypto';
export function signToken(payload, expiresIn = '5m') {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: expiresIn });
}
export function verifyToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
}
export function generateHMAC(data, secret) {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
}
export function verifyHMAC(data, signature, secret) {
    const expectedSignature = generateHMAC(data, secret);
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}
/**
 * Generate a secure random token for payment links
 * @param length Token length in bytes (default 32)
 * @returns Base64 URL-safe token
 */
export function generateSecureToken(length = 32) {
    return crypto.randomBytes(length)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}
/**
 * Generate a hash of a value for verification purposes
 * @param value Value to hash
 * @returns SHA-256 hash in hex format
 */
export function generateHash(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}
/**
 * Generate a short numeric code for verification
 * @param length Number of digits (default 6)
 * @returns Numeric string
 */
export function generateNumericCode(length = 6) {
    const digits = '0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += digits[Math.floor(Math.random() * digits.length)];
    }
    return result;
}
/**
 * Generate a QR code friendly alphanumeric token
 * @param length Number of characters (default 12)
 * @returns Alphanumeric string
 */
export function generateAlphanumericToken(length = 12) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}
//# sourceMappingURL=crypto.js.map