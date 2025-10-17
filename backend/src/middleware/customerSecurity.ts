import { rateLimit } from 'express-rate-limit';

// Customer-specific rate limiters
export const customerAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 login attempts per 15 minutes
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const customerAPILimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 requests per minute
  message: { error: 'Too many requests, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const customerPaymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 payment attempts per minute
  message: { error: 'Too many payment attempts, please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Session cleanup middleware
export const sessionCleanup = (req: any, res: any, next: any) => {
  // Clean up expired sessions periodically
  // This should be moved to a background job in production
  const now = new Date();
  
  // Access the sessions from the customerAuth module
  // This is a simple implementation - use Redis in production
  if (Math.random() < 0.01) { // 1% chance to run cleanup
    setTimeout(() => {
      // Cleanup logic would go here
    }, 0);
  }
  
  next();
};