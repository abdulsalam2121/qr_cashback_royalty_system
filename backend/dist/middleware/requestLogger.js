import pino from 'pino';
const logger = pino();
export const requestLogger = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info({
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
        }, 'HTTP Request');
    });
    next();
};
//# sourceMappingURL=requestLogger.js.map