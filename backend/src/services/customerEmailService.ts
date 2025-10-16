// Email notification service for customer actions
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface EmailData {
  customerName: string;
  amountAdded?: string;
  newBalance?: string;
  tenantName: string | null;
  timestamp: string;
}

export class CustomerEmailService {
  static async sendFundsAddedNotification(
    tenantId: string,
    customerId: string,
    data: EmailData
  ) {
    try {
      await prisma.notification.create({
        data: {
          tenantId,
          customerId,
          channel: 'SMS', // Using SMS enum value for email too
          template: 'FUNDS_ADDED',
          payload: {
            subject: `Funds Added to Your ${data.tenantName} Loyalty Card`,
            body: `
              <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2563eb;">Funds Added Successfully!</h2>
                    
                    <p>Hi ${data.customerName},</p>
                    
                    <p>We're excited to let you know that funds have been successfully added to your ${data.tenantName} loyalty card!</p>
                    
                    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                      <h3 style="margin-top: 0; color: #1f2937;">Transaction Details:</h3>
                      <p><strong>Amount Added:</strong> ${data.amountAdded}</p>
                      <p><strong>New Balance:</strong> ${data.newBalance}</p>
                      <p><strong>Date & Time:</strong> ${data.timestamp}</p>
                    </div>
                    
                    <p>Your funds are now available to use for purchases and can earn you cashback rewards!</p>
                    
                    <p>You can view your updated balance and transaction history by scanning your QR card or entering your Card ID at our customer portal.</p>
                    
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                    
                    <p style="font-size: 14px; color: #6b7280;">
                      This is an automated message from ${data.tenantName}. 
                      If you didn't make this transaction, please contact us immediately.
                    </p>
                  </div>
                </body>
              </html>
            `,
            ...data
          },
          status: 'PENDING'
        }
      });

      console.log(`Funds added email notification queued for customer ${customerId}`);
    } catch (error) {
      console.error('Failed to queue funds added email:', error);
      throw error;
    }
  }

  static async sendBalanceUpdateNotification(
    tenantId: string,
    customerId: string,
    data: EmailData & { transactionType: 'EARN' | 'REDEEM' | 'ADJUST' }
  ) {
    try {
      const subject = 
        data.transactionType === 'EARN' ? `Cashback Earned - ${data.tenantName}` :
        data.transactionType === 'REDEEM' ? `Rewards Redeemed - ${data.tenantName}` :
        `Balance Updated - ${data.tenantName}`;

      await prisma.notification.create({
        data: {
          tenantId,
          customerId,
          channel: 'SMS',
          template: 'BALANCE_UPDATE',
          payload: {
            subject,
            ...data
          },
          status: 'PENDING'
        }
      });

      console.log(`Balance update email notification queued for customer ${customerId}`);
    } catch (error) {
      console.error('Failed to queue balance update email:', error);
      throw error;
    }
  }

  static async sendWelcomeNotification(
    tenantId: string,
    customerId: string,
    data: { customerName: string; tenantName: string; cardUid: string }
  ) {
    try {
      await prisma.notification.create({
        data: {
          tenantId,
          customerId,
          channel: 'SMS',
          template: 'WELCOME',
          payload: {
            subject: `Welcome to ${data.tenantName} Loyalty Program!`,
            body: `
              <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #2563eb;">Welcome to our Loyalty Program!</h2>
                    
                    <p>Hi ${data.customerName},</p>
                    
                    <p>Welcome to the ${data.tenantName} loyalty program! Your card has been activated and you're ready to start earning rewards.</p>
                    
                    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                      <h3 style="margin-top: 0; color: #1f2937;">Your Card Details:</h3>
                      <p><strong>Card ID:</strong> ${data.cardUid}</p>
                      <p><strong>Status:</strong> Active</p>
                    </div>
                    
                    <h3>How to Use Your Loyalty Card:</h3>
                    <ul>
                      <li>Present your QR card or Card ID when making purchases</li>
                      <li>Earn cashback rewards on every transaction</li>
                      <li>Add funds to your card for faster checkout</li>
                      <li>Access your dashboard anytime by scanning your QR code</li>
                    </ul>
                    
                    <p>Start earning rewards today!</p>
                    
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                    
                    <p style="font-size: 14px; color: #6b7280;">
                      Thank you for joining ${data.tenantName}!
                    </p>
                  </div>
                </body>
              </html>
            `,
            ...data
          },
          status: 'PENDING'
        }
      });

      console.log(`Welcome email notification queued for customer ${customerId}`);
    } catch (error) {
      console.error('Failed to queue welcome email:', error);
      throw error;
    }
  }
}