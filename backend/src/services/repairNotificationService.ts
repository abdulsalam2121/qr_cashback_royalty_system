import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { PrismaClient, RepairStatus, NotificationType } from '@prisma/client';

const prisma = new PrismaClient();

// Twilio Configuration (if available)
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// Email Configuration
const emailTransporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER || 'covercellinsure@gmail.com',
    pass: process.env.SMTP_PASS,
  },
});

interface RepairWithCustomer {
  id: string;
  phoneModel: string;
  imei: string | null;
  issueDetails: string;
  status: RepairStatus;
  estimatedCost: number | null;
  actualCost: number | null;
  droppedOffAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string | null;
  } | null;
}

/**
 * Generate notification message based on repair status
 */
function generateNotificationContent(
  repair: RepairWithCustomer,
  status: RepairStatus,
  customMessage?: string,
  customSubject?: string
) {
  const customerName = repair.customer
    ? `${repair.customer.firstName} ${repair.customer.lastName}`
    : 'Customer';

  if (customMessage) {
    return {
      subject: customSubject || 'Update on Your Device Repair',
      message: customMessage,
      smsMessage: customMessage,
    };
  }

  let subject = '';
  let message = '';
  let smsMessage = '';

  const formattedDate = new Date(repair.droppedOffAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  switch (status) {
    case RepairStatus.DROPPED_OFF:
      subject = '✅ Device Received - Repair Confirmation';
      message = `
        <h2>Device Successfully Received</h2>
        <p>Dear ${customerName},</p>
        <p>We have received your <strong>${repair.phoneModel}</strong> for repair on ${formattedDate}.</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Repair Details:</h3>
          <p><strong>Device:</strong> ${repair.phoneModel}</p>
          ${repair.imei ? `<p><strong>IMEI:</strong> ${repair.imei}</p>` : ''}
          <p><strong>Issue:</strong> ${repair.issueDetails}</p>
          ${repair.estimatedCost ? `<p><strong>Estimated Cost:</strong> $${(repair.estimatedCost / 100).toFixed(2)}</p>` : ''}
        </div>
        <p>We'll notify you as soon as we begin working on your device and when it's ready for pickup.</p>
        <p>Thank you for choosing our repair service!</p>
      `;
      smsMessage = `Device Received! Your ${repair.phoneModel} was successfully dropped off on ${formattedDate}. We'll update you as we progress with the repair.`;
      break;

    case RepairStatus.IN_PROGRESS:
      subject = '🔧 Repair In Progress';
      message = `
        <h2>Repair Work Has Started</h2>
        <p>Dear ${customerName},</p>
        <p>Good news! Our technicians have started working on your <strong>${repair.phoneModel}</strong>.</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Device:</strong> ${repair.phoneModel}</p>
          <p><strong>Issue:</strong> ${repair.issueDetails}</p>
        </div>
        <p>We'll notify you as soon as your device is ready for pickup.</p>
      `;
      smsMessage = `Repair Started! We're now working on your ${repair.phoneModel}. You'll be notified when it's ready for pickup.`;
      break;

    case RepairStatus.READY_FOR_PICKUP:
      subject = '✨ Device Ready for Pickup!';
      message = `
        <h2>Your Device is Ready!</h2>
        <p>Dear ${customerName},</p>
        <p>Great news! Your <strong>${repair.phoneModel}</strong> has been repaired and is ready for pickup!</p>
        <div style="background: #dcfce7; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #166534;">Pickup Information:</h3>
          <p><strong>Device:</strong> ${repair.phoneModel}</p>
          ${repair.actualCost ? `<p><strong>Repair Cost:</strong> $${(repair.actualCost / 100).toFixed(2)}</p>` : ''}
          <p><strong>Please collect your device at your earliest convenience.</strong></p>
        </div>
        <p>Thank you for your patience!</p>
      `;
      smsMessage = `Ready for Pickup! Your ${repair.phoneModel} repair is complete. ${repair.actualCost ? `Cost: $${(repair.actualCost / 100).toFixed(2)}. ` : ''}Please come collect it at your convenience.`;
      break;

    case RepairStatus.PICKED_UP:
      subject = '🎉 Thank You - Device Collected';
      message = `
        <h2>Thank You!</h2>
        <p>Dear ${customerName},</p>
        <p>Thank you for collecting your <strong>${repair.phoneModel}</strong>. We hope you're satisfied with our service!</p>
        <p>If you experience any issues, please don't hesitate to contact us.</p>
        <p>We look forward to serving you again!</p>
      `;
      smsMessage = `Thank you for collecting your ${repair.phoneModel}! We hope you're satisfied with our service. Contact us if you need any assistance.`;
      break;

    case RepairStatus.CANCELLED:
      subject = '❌ Repair Cancelled';
      message = `
        <h2>Repair Cancelled</h2>
        <p>Dear ${customerName},</p>
        <p>The repair for your <strong>${repair.phoneModel}</strong> has been cancelled.</p>
        <p>Please contact us if you have any questions or would like to proceed with the repair.</p>
      `;
      smsMessage = `Repair Cancelled: The repair for your ${repair.phoneModel} has been cancelled. Contact us for more information.`;
      break;

    default:
      subject = 'Update on Your Device Repair';
      message = `
        <p>Dear ${customerName},</p>
        <p>There's an update on your <strong>${repair.phoneModel}</strong> repair.</p>
        <p>Please contact us for more information.</p>
      `;
      smsMessage = `Update on your ${repair.phoneModel} repair. Please contact us for details.`;
  }

  return { subject, message, smsMessage };
}

/**
 * Send email notification
 */
async function sendEmailNotification(
  repair: RepairWithCustomer,
  email: string,
  subject: string,
  htmlMessage: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const info = await emailTransporter.sendMail({
      from: `"Phone Repair Service" <${process.env.SMTP_USER || 'covercellinsure@gmail.com'}>`,
      to: email,
      subject,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${subject}</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); border-radius: 16px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                <span style="color: white; font-size: 24px;">📱</span>
              </div>
            </div>
            
            <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 30px; margin-bottom: 30px;">
              ${htmlMessage}
            </div>
            
            <div style="text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 20px;">
              <p>This is an automated notification from our repair tracking system.</p>
              <p style="margin-top: 20px;">© 2025 Phone Repair Service. All rights reserved.</p>
            </div>
          </body>
        </html>
      `,
      text: htmlMessage.replace(/<[^>]*>/g, ''), // Strip HTML tags for plain text
    });

    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('Email sending failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send SMS notification
 */
async function sendSMSNotification(
  phone: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!twilioClient || !twilioPhoneNumber) {
    console.warn('Twilio not configured - SMS notification skipped');
    return { success: false, error: 'Twilio not configured' };
  }

  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: twilioPhoneNumber,
      to: phone,
    });

    return { success: true, messageId: result.sid };
  } catch (error: any) {
    console.error('SMS sending failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Main function to send repair notifications
 */
export async function sendRepairNotification(
  repair: RepairWithCustomer,
  status: RepairStatus,
  type: NotificationType,
  customMessage?: string,
  customSubject?: string,
  sendVia: string[] = ['SMS', 'EMAIL']
): Promise<void> {
  if (!repair.customer) {
    throw new Error('No customer associated with repair');
  }

  const { firstName, lastName, phone, email } = repair.customer;
  const { subject, message, smsMessage } = generateNotificationContent(
    repair,
    status,
    customMessage,
    customSubject
  );

  let smsSent = false;
  let emailSent = false;
  let smsDelivered = false;
  let emailDelivered = false;
  let smsError: string | undefined;
  let emailError: string | undefined;
  let smsMessageId: string | undefined;
  let emailMessageId: string | undefined;

  // Send SMS if phone number exists and SMS is requested
  if (sendVia.includes('SMS') && phone) {
    const smsResult = await sendSMSNotification(phone, customMessage || smsMessage);
    smsSent = smsResult.success;
    smsDelivered = smsResult.success;
    smsError = smsResult.error;
    smsMessageId = smsResult.messageId;
  }

  // Send Email if email exists and EMAIL is requested
  if (sendVia.includes('EMAIL') && email) {
    const emailResult = await sendEmailNotification(repair, email, subject, message);
    emailSent = emailResult.success;
    emailDelivered = emailResult.success;
    emailError = emailResult.error;
    emailMessageId = emailResult.messageId;
  }

  // Save notification record
  await prisma.repairNotification.create({
    data: {
      repairId: repair.id,
      type,
      status,
      sentVia: sendVia,
      recipientName: `${firstName} ${lastName}`,
      recipientPhone: phone,
      recipientEmail: email,
      subject,
      message: customMessage || message,
      smsSent,
      emailSent,
      smsDelivered,
      emailDelivered,
      smsError,
      emailError,
      smsMessageId,
      emailMessageId,
    },
  });
}

export default {
  sendRepairNotification,
};
