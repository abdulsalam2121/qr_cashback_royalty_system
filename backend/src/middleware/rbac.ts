import { Request, Response, NextFunction } from 'express';

export const rbac = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    // Platform admins can access everything
    if (req.user.role === 'platform_admin') {
      return next();
    }
    
    // Non-platform users must have a tenant
    if (!req.user.tenantId) {
      return res.status(403).json({ error: 'Tenant access required' });
    }

    next();
  };
};