"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const rbac_js_1 = require("../middleware/rbac.js");
const auth_js_1 = require("../middleware/auth.js");
const asyncHandler_js_1 = require("../middleware/asyncHandler.js");
const trialService_js_1 = require("../services/trialService.js");
const router = express_1.default.Router();
// Apply authentication to all routes
router.use(auth_js_1.auth);
/**
 * Get trial status for current tenant
 */
router.get('/status', (0, rbac_js_1.rbac)(['tenant_admin', 'cashier']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { tenantId } = req.user;
    const status = await (0, trialService_js_1.getTrialStatus)(tenantId);
    res.json({
        success: true,
        data: status
    });
}));
/**
 * Check if tenant can activate cards
 */
router.get('/can-activate', (0, rbac_js_1.rbac)(['tenant_admin', 'cashier']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { tenantId } = req.user;
    const canActivate = await (0, trialService_js_1.canActivateCards)(tenantId);
    res.json({
        success: true,
        data: { canActivate }
    });
}));
/**
 * Reset trial (platform admin only)
 */
router.post('/reset/:tenantId', (0, rbac_js_1.rbac)(['platform_admin']), (0, asyncHandler_js_1.asyncHandler)(async (req, res) => {
    const { tenantId } = req.params;
    if (!tenantId) {
        res.status(400).json({ error: 'Tenant ID is required' });
        return;
    }
    await (0, trialService_js_1.resetTrial)(tenantId);
    res.json({
        success: true,
        message: 'Trial reset successfully'
    });
}));
exports.default = router;
//# sourceMappingURL=trial.js.map