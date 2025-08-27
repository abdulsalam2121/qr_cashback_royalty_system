import { Request, Response, NextFunction } from 'express';
import pino from 'pino';

const logger = pino();

export const errorHandler = (error: any, req: Request, res: Response, next: NextFunction) => {
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