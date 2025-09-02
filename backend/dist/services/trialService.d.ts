/**
 * Track card activation and check trial limits
 */
export declare function trackCardActivation(tenantId: string, cardId: string): Promise<{
    success: boolean;
    trialExceeded: boolean;
    activationsUsed: number;
    activationsRemaining: number;
    message?: string;
}>;
/**
 * Get trial status for a tenant
 */
export declare function getTrialStatus(tenantId: string): Promise<{
    activationsUsed: number;
    activationsRemaining: number;
    trialLimit: number;
    isTrialActive: boolean;
    subscriptionRequired: boolean;
    subscriptionStatus: string;
}>;
/**
 * Check if tenant can activate cards (within trial or has subscription)
 */
export declare function canActivateCards(tenantId: string): Promise<boolean>;
/**
 * Reset trial for a tenant (admin function)
 */
export declare function resetTrial(tenantId: string): Promise<void>;
//# sourceMappingURL=trialService.d.ts.map