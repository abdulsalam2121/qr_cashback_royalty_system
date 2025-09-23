"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)();
const errorHandler = (error, req, res, next) => {
    logger.error({
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
    }, 'API Error');
    // Prisma errors
    if (error.code === 'P2002') {
        return res.status(400).json({ error: 'A record with this value already exists' });
    }
    if (error.code === 'P2025') {
        return res.status(404).json({ error: 'Record not found' });
    }
    // Custom application errors
    if (error.message) {
        return res.status(400).json({ error: error.message });
    }
    // Default error
    res.status(500).json({ error: 'Internal server error' });
    return;
};
exports.errorHandler = errorHandler;
//# sourceMappingURL=errorHandler.js.map