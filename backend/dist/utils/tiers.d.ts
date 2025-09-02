export declare function updateCustomerTier(customerId: string, tenantId: string, tx: any): Promise<any>;
export declare function calculateTierProgress(customer: any, tenantId: string, tx: any): Promise<{
    currentTier: any;
    currentSpend: number;
    currentTierMin: any;
    nextTier: any;
    nextTierMin: any;
    progressToNext: number;
    remainingToNext: number;
}>;
//# sourceMappingURL=tiers.d.ts.map