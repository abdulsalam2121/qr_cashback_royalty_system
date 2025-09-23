"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signToken = signToken;
exports.verifyToken = verifyToken;
exports.generateHMAC = generateHMAC;
exports.verifyHMAC = verifyHMAC;
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
//# sourceMappingURL=crypto.js.map