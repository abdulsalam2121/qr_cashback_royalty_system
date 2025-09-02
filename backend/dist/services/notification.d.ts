import { NotifChannel } from '@prisma/client';
declare const templates: {
    CASHBACK_EARNED: {
        SMS: string;
        WHATSAPP: string;
    };
    CASHBACK_REDEEMED: {
        SMS: string;
        WHATSAPP: string;
    };
    TIER_UPGRADED: {
        SMS: string;
        WHATSAPP: string;
    };
    WELCOME: {
        SMS: string;
        WHATSAPP: string;
    };
    TRIAL_EXPIRING: {
        SMS: string;
        WHATSAPP: string;
    };
    TRIAL_EXPIRED: {
        SMS: string;
        WHATSAPP: string;
    };
};
export declare function sendNotification(customerId: string, templateName: keyof typeof templates, variables: Record<string, string>, tenantId: string, preferredChannel?: NotifChannel): Promise<void>;
export declare function retryFailedNotifications(): Promise<void>;
export {};
//# sourceMappingURL=notification.d.ts.map