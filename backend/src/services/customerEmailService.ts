// Email notification service for customer actions
import { PrismaClient } from '@prisma/client';
import { emailService } from './emailService.js';

const prisma = new PrismaClient();

export interface EmailData {
  customerName: string;
  amountAdded?: string;
  newBalance?: string;
  tenantName: string | null;
  timestamp: string;
}

export interface CashbackEmailData {
  customerName: string;
  cashbackAmount: string;
  purchaseAmount: string;
  newBalance: string;
  beforeBalance: string;
  storeName: string;
  tenantName: string | null;
  timestamp: string;
  transactionId?: string;
  // Partial payment fields
  balanceUsed?: string;
  remainingPaid?: string;
  paymentMethod?: string;
}

export class CustomerEmailService {
  static async sendFundsAddedNotification(
    tenantId: string,
    customerId: string,
    data: EmailData
  ) {
    try {
      // Get customer email
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { email: true, firstName: true, lastName: true }
      });

      if (!customer?.email) {
        console.log('Customer has no email address, skipping funds added email notification');
        return;
      }

      const subject = `Funds Added to Your ${data.tenantName} Loyalty Card`;
      const htmlBody = `
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
              `;

      const textBody = `
        Funds Added Successfully!
        
        Hi ${data.customerName},
        
        Funds have been successfully added to your ${data.tenantName} loyalty card.
        
        Transaction Details:
        - Amount Added: ${data.amountAdded}
        - New Balance: ${data.newBalance}
        - Date & Time: ${data.timestamp}
        
        Your funds are now available for purchases and earning cashback rewards!
        
        This is an automated message from ${data.tenantName}.
      `;

      // Actually send the email using EmailService
      await emailService.sendCustomEmail(
        customer.email,
        subject,
        htmlBody,
        textBody,
        data.tenantName || 'LoyaltyPro'
      );
      
      console.log(`Funds added email sent successfully to ${customer.email}`);

      // Also create a notification record for tracking
      await prisma.notification.create({
        data: {
          tenantId,
          customerId,
          channel: 'SMS',
          template: 'FUNDS_ADDED',
          payload: {
            subject,
            customerEmail: customer.email,
            amountAdded: data.amountAdded
          },
          status: 'SENT'
        }
      });

    } catch (error) {
      console.error('Failed to send funds added email:', error);
      
      // Create failed notification record
      try {
        await prisma.notification.create({
          data: {
            tenantId,
            customerId,
            channel: 'SMS',
            template: 'FUNDS_ADDED',
            payload: {
              error: error instanceof Error ? error.message : 'Unknown error',
              amountAdded: data.amountAdded
            },
            status: 'FAILED'
          }
        });
      } catch (dbError) {
        console.error('Failed to create failed notification record:', dbError);
      }
    }
  }

  static async sendCashbackEarnedNotification(
    tenantId: string,
    customerId: string,
    data: CashbackEmailData
  ) {
    try {
      // Get customer email
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { email: true, firstName: true, lastName: true }
      });

      if (!customer?.email) {
        console.log('Customer has no email address, skipping email notification');
        return;
      }

      const subject = `Cashback Earned! $${data.cashbackAmount} - ${data.tenantName}`;
      const htmlBody = `
              <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                      <h2 style="color: #16a34a; margin-bottom: 10px;">🎉 Cashback Earned!</h2>
                      <div style="background-color: #dcfce7; border: 2px solid #16a34a; border-radius: 8px; padding: 20px; display: inline-block;">
                        <h3 style="color: #16a34a; margin: 0; font-size: 24px;">+$${data.cashbackAmount}</h3>
                        <p style="color: #15803d; margin: 5px 0 0 0; font-weight: bold;">Cashback Earned!</p>
                      </div>
                    </div>
                    
                    <p style="font-size: 16px;">Hi ${data.customerName},</p>
                    
                    <p>Great news! You've just earned cashback on your recent purchase at ${data.storeName}. Here are the details:</p>
                    
                    <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0;">
                      <h3 style="margin-top: 0; color: #1e40af;">💳 Transaction Details</h3>
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr style="border-bottom: 1px solid #e5e7eb;">
                          <td style="padding: 8px 0; font-weight: bold; color: #374151;">Store:</td>
                          <td style="padding: 8px 0; color: #6b7280;">${data.storeName}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #e5e7eb;">
                          <td style="padding: 8px 0; font-weight: bold; color: #374151;">Total Purchase:</td>
                          <td style="padding: 8px 0; color: #6b7280;">$${data.purchaseAmount}</td>
                        </tr>
                        ${data.balanceUsed && parseFloat(data.balanceUsed) > 0 ? `
                        <tr style="border-bottom: 1px solid #e5e7eb;">
                          <td style="padding: 8px 0; font-weight: bold; color: #374151;">Paid with Balance:</td>
                          <td style="padding: 8px 0; color: #f59e0b; font-weight: bold;">-$${data.balanceUsed}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #e5e7eb;">
                          <td style="padding: 8px 0; font-weight: bold; color: #374151;">Paid with ${data.paymentMethod}:</td>
                          <td style="padding: 8px 0; color: #6b7280;">$${data.remainingPaid}</td>
                        </tr>
                        ` : ''}
                        <tr style="border-bottom: 1px solid #e5e7eb;">
                          <td style="padding: 8px 0; font-weight: bold; color: #374151;">Cashback Earned:</td>
                          <td style="padding: 8px 0; color: #16a34a; font-weight: bold;">+$${data.cashbackAmount}</td>
                        </tr>
                        <tr style="border-bottom: 1px solid #e5e7eb;">
                          <td style="padding: 8px 0; font-weight: bold; color: #374151;">Previous Balance:</td>
                          <td style="padding: 8px 0; color: #6b7280;">$${data.beforeBalance}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 0; font-weight: bold; color: #374151;">New Balance:</td>
                          <td style="padding: 8px 0; color: #1e40af; font-weight: bold; font-size: 18px;">$${data.newBalance}</td>
                        </tr>
                      </table>
                    </div>
                    
                    <div style="background-color: #eff6ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 15px; margin: 20px 0;">
                      <h4 style="margin-top: 0; color: #1e40af;">💡 What You Can Do Next:</h4>
                      <ul style="margin-bottom: 0; color: #374151;">
                        <li>Keep shopping to earn more cashback rewards</li>
                        <li>Redeem your balance for store credit or rewards</li>
                        <li>Check your transaction history anytime</li>
                        <li>Share your experience with friends and family</li>
                      </ul>
                    </div>
                    
                    <p>Your cashback balance is now available to use on future purchases or can be redeemed according to store policy.</p>
                    
                    <div style="text-align: center; margin: 30px 0;">
                      <p style="color: #6b7280; font-size: 14px;">Transaction processed on ${data.timestamp}</p>
                      ${data.transactionId ? `<p style="color: #9ca3af; font-size: 12px;">Transaction ID: ${data.transactionId}</p>` : ''}
                    </div>
                    
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
                    
                    <p style="font-size: 14px; color: #6b7280;">
                      This is an automated message from ${data.tenantName}. 
                      If you have any questions about this transaction, please contact us.
                    </p>
                    
                    <p style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 20px;">
                      Thank you for your loyalty! 🙏
                    </p>
                  </div>
                </body>
              </html>
              `;

      const textBody = `
        Cashback Earned! $${data.cashbackAmount}
        
        Hi ${data.customerName},
        
        Great news! You've just earned $${data.cashbackAmount} cashback on your recent purchase at ${data.storeName}.
        
        Transaction Details:
        - Store: ${data.storeName}
        - Purchase Amount: $${data.purchaseAmount}
        - Cashback Earned: +$${data.cashbackAmount}
        - Previous Balance: $${data.beforeBalance}
        - New Balance: $${data.newBalance}
        
        Your cashback balance is now available to use on future purchases.
        
        Transaction processed on ${data.timestamp}
        ${data.transactionId ? `Transaction ID: ${data.transactionId}` : ''}
        
        This is an automated message from ${data.tenantName}.
        Thank you for your loyalty!
      `;

      // Actually send the email using EmailService
      await emailService.sendCustomEmail(
        customer.email,
        subject,
        htmlBody,
        textBody,
        data.tenantName || 'LoyaltyPro'
      );
      
      console.log(`Cashback email sent successfully to ${customer.email}`);

      // Also create a notification record for tracking
      await prisma.notification.create({
        data: {
          tenantId,
          customerId,
          channel: 'SMS', // Using SMS enum value for email tracking
          template: 'CASHBACK_EARNED',
          payload: {
            subject,
            customerEmail: customer.email,
            cashbackAmount: data.cashbackAmount,
            purchaseAmount: data.purchaseAmount
          },
          status: 'SENT'
        }
      });

    } catch (error) {
      console.error('Failed to send cashback earned email:', error);
      
      // Create failed notification record
      try {
        await prisma.notification.create({
          data: {
            tenantId,
            customerId,
            channel: 'SMS',
            template: 'CASHBACK_EARNED',
            payload: {
              error: error instanceof Error ? error.message : 'Unknown error',
              cashbackAmount: data.cashbackAmount
            },
            status: 'FAILED'
          }
        });
      } catch (dbError) {
        console.error('Failed to create failed notification record:', dbError);
      }
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

    } catch (error) {
      console.error('Failed to queue welcome email:', error);
      throw error;
    }
  }
}