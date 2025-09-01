import express from 'express';
import { rbac } from '../middleware/rbac.js';
import { auth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { 
  getTrialStatus, 
  canActivateCards, 
  resetTrial 
} from '../services/trialService.js';

const router = express.Router();

// Apply authentication to all routes
router.use(auth);

/**
 * Get trial status for current tenant
 */
router.get('/status', 
  rbac(['tenant_admin', 'cashier']),
  asyncHandler(async (req, res) => {
    const { tenantId } = req.user!;
    
    const status = await getTrialStatus(tenantId);
    
    res.json({
      success: true,
      data: status
    });
  })
);

/**
 * Check if tenant can activate cards
 */
router.get('/can-activate', 
  rbac(['tenant_admin', 'cashier']),
  asyncHandler(async (req, res) => {
    const { tenantId } = req.user!;
    
    const canActivate = await canActivateCards(tenantId);
    
    res.json({
      success: true,
      data: { canActivate }
    });
  })
);

/**
 * Reset trial (platform admin only)
 */
router.post('/reset/:tenantId',
  rbac(['platform_admin']),
  asyncHandler(async (req, res) => {
    const { tenantId } = req.params;
    
    if (!tenantId) {
      res.status(400).json({ error: 'Tenant ID is required' });
      return;
    }
    
    await resetTrial(tenantId);
    
    res.json({
      success: true,
      message: 'Trial reset successfully'
    });
  })
);

export default router;
