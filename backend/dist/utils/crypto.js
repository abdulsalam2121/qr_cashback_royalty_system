"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signToken = signToken;
exports.verifyToken = verifyToken;
exports.generateHMAC = generateHMAC;
exports.verifyHMAC = verifyHMAC;
exports.generateSecureToken = generateSecureToken;
exports.generateHash = generateHash;
exports.generateNumericCode = generateNumericCode;
exports.generateAlphanumericToken = generateAlphanumericToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
function signToken(payload, expiresIn = '5m') {
    return jsonwebtoken_1.default.sign(payload, process.env.JWT_SECRET, { expiresIn: expiresIn });
}
function verifyToken(token) {
    return jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
}
function generateHMAC(data, secret) {
    return crypto_1.default.createHmac('sha256', secret).update(data).digest('hex');
}
function verifyHMAC(data, signature, secret) {
    const expectedSignature = generateHMAC(data, secret);
    return crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}
/**
 * Generate a secure random token for payment links
 * @param length Token length in bytes (default 32)
 * @returns Base64 URL-safe token
 */
function generateSecureToken(length = 32) {
    return crypto_1.default.randomBytes(length)
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
function generateHash(value) {
    return crypto_1.default.createHash('sha256').update(value).digest('hex');
}
/**
 * Generate a short numeric code for verification
 * @param length Number of digits (default 6)
 * @returns Numeric string
 */
function generateNumericCode(length = 6) {
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
function generateAlphanumericToken(length = 12) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}
//# sourceMappingURL=crypto.js.map