import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

declare global {
  namespace Express {
    interface Request {
      tenant?: any;
    }
  }
}

export const resolveTenant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantSlug = req.params.tenantSlug;

    if (!tenantSlug) {
      return res.status(400).json({ error: 'Tenant slug required' });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      include: {
        stores: true,
      }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    req.tenant = tenant;
    next();
    return;
  } catch (error) {
    console.error('Tenant resolution error:', error);
    return res.status(500).json({ error: 'Failed to resolve tenant' });
  }
};

export const requireActiveSubscription = (req: Request, res: Response, next: NextFunction) => {
  const tenant = req.tenant;
  
  if (!tenant) {
    return res.status(400).json({ error: 'Tenant required' });
  }

  const isActive = tenant.subscriptionStatus === 'ACTIVE' || 
    tenant.subscriptionStatus === 'TRIALING' ||
    (tenant.subscriptionStatus === 'PAST_DUE' && 
     tenant.graceEndsAt && 
     new Date(tenant.graceEndsAt) > new Date());

  if (!isActive) {
    return res.status(402).json({ 
      error: 'Active subscription required',
      subscriptionStatus: tenant.subscriptionStatus 
    });
  }

  next();
  return;
};
