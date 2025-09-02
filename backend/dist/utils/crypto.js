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
//# sourceMappingURL=crypto.js.map