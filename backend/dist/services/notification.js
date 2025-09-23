"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendNotification = sendNotification;
exports.retryFailedNotifications = retryFailedNotifications;
const client_1 = require("@prisma/client");
const twilio_1 = __importDefault(require("twilio"));
const prisma = new client_1.PrismaClient();
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? (0, twilio_1.default)(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;
const templates = {
    CASHBACK_EARNED: {
        SMS: "Hi {customerName}! You earned ${amount} cashback at {storeName}. New balance: ${balance}. Thank you for your loyalty!",
        WHATSAPP: "🎉 Great news, {customerName}!\n\nYou just earned ${amount} cashback at {storeName}.\n\nYour new balance is ${balance}.\n\nKeep shopping to unlock more rewards! 💳✨"
    },
    CASHBACK_REDEEMED: {
        SMS: "Hi {customerName}! You redeemed ${amount} at {storeName}. Remaining balance: ${balance}. Thanks for choosing us!",
        WHATSAPP: "💸 Transaction successful!\n\nHi {customerName}, you've redeemed ${amount} at {storeName}.\n\nRemaining balance: ${balance}.\n\nThank you for your continued loyalty! 🙏"
    },
    TIER_UPGRADED: {
        SMS: "Congratulations {customerName}! You've been upgraded to {newTier} status. Enjoy higher cashback rates!",
        WHATSAPP: "🎊 Tier Upgrade!\n\nCongratulations {customerName}!\n\nYou've been upgraded to {newTier} status and can now enjoy higher cashback rates on all purchases.\n\nThank you for your continued loyalty! 🌟"
    },
    WELCOME: {
        SMS: "Welcome to our loyalty program, {customerName}! Your card {cardUid} is now active. Start earning cashback today!",
        WHATSAPP: "👋 Welcome to our loyalty program!\n\nHi {customerName}, your card {cardUid} is now active.\n\nStart earning cashback on every purchase and unlock exclusive rewards! 🎁"
    },
    TRIAL_EXPIRING: {
        SMS: "Your free trial expires soon! You have {activationsRemaining} card activations left. Upgrade to $19.99/month to continue.",
        WHATSAPP: "⚠️ Trial Expiring Soon!\n\nYou have {activationsRemaining} card activations remaining in your free trial.\n\nUpgrade to our $19.99/month plan to continue using the system without interruption."
    },
    TRIAL_EXPIRED: {
        SMS: "Your free trial has ended after {activationsUsed} activations. Upgrade to $19.99/month to continue using the system.",
        WHATSAPP: "🚨 Free Trial Ended\n\nYou've used all {activationsUsed} free card activations.\n\nUpgrade to our $19.99/month subscription to:\n• Continue activating cards\n• Access all features\n• Get priority support\n\nUpgrade now to keep your business running smoothly!"
    }
};
async function sendNotification(customerId, templateName, variables, tenantId, preferredChannel = 'SMS') {
    try {
        const customer = await prisma.customer.findUnique({
            where: { id: customerId }
        });
        if (!customer || !customer.phone) {
            if (process.env.NODE_ENV !== 'production') {
                console.log('Customer not found or no phone number available');
            }
            return;
        }
        const template = templates[templateName][preferredChannel];
        if (!template) {
            if (process.env.NODE_ENV !== 'production') {
                console.log(`Template ${templateName} not found for channel ${preferredChannel}`);
            }
            return;
        }
        // Replace template variables
        let message = template;
        Object.keys(variables).forEach(key => {
            message = message.replace(new RegExp(`{${key}}`, 'g'), variables[key] || '');
        });
        // Create notification record
        const notification = await prisma.notification.create({
            data: {
                tenantId,
                customerId,
                channel: preferredChannel,
                template: templateName,
                payload: variables,
                status: 'PENDING',
            }
        });
        // Send via Twilio if configured
        if (twilioClient && process.env.TWILIO_FROM_NUMBER) {
            try {
                let twilioMessage;
                if (preferredChannel === 'WHATSAPP') {
                    twilioMessage = await twilioClient.messages.create({
                        from: `whatsapp:${process.env.TWILIO_FROM_NUMBER}`,
                        to: `whatsapp:${customer.phone}`,
                        body: message,
                    });
                }
                else {
                    twilioMessage = await twilioClient.messages.create({
                        from: process.env.TWILIO_FROM_NUMBER,
                        to: customer.phone,
                        body: message,
                    });
                }
                // Update notification status
                await prisma.notification.update({
                    where: { id: notification.id },
                    data: {
                        status: 'SENT',
                        sentAt: new Date(),
                    }
                });
                if (process.env.NODE_ENV !== 'production') {
                    console.log(`Notification sent successfully`);
                }
            }
            catch (twilioError) {
                console.error('Twilio error:', twilioError);
                // Update notification with error
                await prisma.notification.update({
                    where: { id: notification.id },
                    data: {
                        status: 'FAILED',
                        error: twilioError.message,
                    }
                });
            }
        }
        else {
            // Mock sending for development
            if (process.env.NODE_ENV !== 'production') {
                console.log(`MOCK ${preferredChannel} notification sent`);
            }
            await prisma.notification.update({
                where: { id: notification.id },
                data: {
                    status: 'SENT',
                    sentAt: new Date(),
                }
            });
        }
    }
    catch (error) {
        console.error('Notification service error:', error);
    }
}
async function retryFailedNotifications() {
    try {
        const failedNotifications = await prisma.notification.findMany({
            where: {
                status: 'FAILED',
                createdAt: {
                    gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
                }
            },
            include: { customer: true },
            take: 10 // Limit retries per batch
        });
        for (const notification of failedNotifications) {
            await sendNotification(notification.customerId, notification.template, notification.payload, notification.tenantId, notification.channel);
        }
    }
    catch (error) {
        console.error('Error retrying failed notifications:', error);
    }
}
//# sourceMappingURL=notification.js.map