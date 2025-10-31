import nodemailer from 'nodemailer';
import twilio from 'twilio';
import { PrismaClient, RepairStatus, NotificationType } from '@prisma/client';

const prisma = new PrismaClient();

// Twilio Configuration (if available)
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const twilioPhoneNumber = process.env.TWILIO_FROM_NUMBER;

// Email Configuration
const emailTransporter = nodemailer.createTransport({
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
  tenant: {
    id: string;
    name: string | null;
  };
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
      subject = '✓ Repair Request Received';
      message = `
        <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px;">Repair Request Confirmed</h2>
        <p style="margin: 0 0 15px 0; font-size: 16px; color: #374151;">Dear ${customerName},</p>
        <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151;">
          Thank you for choosing our repair service. We have received your device and it is now in our queue.
        </p>
        <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 20px; border-radius: 8px; margin: 25px 0;">
          <h3 style="margin: 0 0 15px 0; color: #1e40af; font-size: 18px;">Device Details</h3>
          <p style="margin: 5px 0; color: #1e3a8a;"><strong>Device:</strong> ${repair.phoneModel}</p>
          ${repair.imei ? `<p style="margin: 5px 0; color: #1e3a8a;"><strong>IMEI:</strong> ${repair.imei}</p>` : ''}
          <p style="margin: 5px 0; color: #1e3a8a;"><strong>Issue:</strong> ${repair.issueDetails}</p>
          ${repair.estimatedCost ? `<p style="margin: 5px 0; color: #1e3a8a;"><strong>Estimated Cost:</strong> $${(repair.estimatedCost / 100).toFixed(2)}</p>` : ''}
        </div>
        <p style="margin: 20px 0 0 0; font-size: 16px; color: #374151;">
          We'll notify you as soon as our technicians begin working on your device.
        </p>
      `;
      smsMessage = `Repair Confirmed! We received your ${repair.phoneModel}. ${repair.estimatedCost ? `Estimated cost: $${(repair.estimatedCost / 100).toFixed(2)}. ` : ''}We'll update you when work begins.`;
      break;

    case RepairStatus.IN_PROGRESS:
      subject = '🔧 Repair Work In Progress';
      message = `
        <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px;">Repair Work Has Started</h2>
        <p style="margin: 0 0 15px 0; font-size: 16px; color: #374151;">Dear ${customerName},</p>
        <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151;">
          Good news! Our technicians have started working on your <strong>${repair.phoneModel}</strong>.
        </p>
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; border-radius: 8px; margin: 25px 0;">
          <h3 style="margin: 0 0 15px 0; color: #92400e; font-size: 18px;">Repair Details</h3>
          <p style="margin: 5px 0; color: #78350f;"><strong>Device:</strong> ${repair.phoneModel}</p>
          <p style="margin: 5px 0; color: #78350f;"><strong>Issue:</strong> ${repair.issueDetails}</p>
        </div>
        <p style="margin: 20px 0 0 0; font-size: 16px; color: #374151;">
          We'll notify you as soon as your device is ready for pickup.
        </p>
      `;
      smsMessage = `Repair Started! We're now working on your ${repair.phoneModel}. You'll be notified when it's ready for pickup.`;
      break;

    case RepairStatus.READY_FOR_PICKUP:
      subject = '✨ Device Ready for Pickup';
      message = `
        <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px;">Your Device is Ready!</h2>
        <p style="margin: 0 0 15px 0; font-size: 16px; color: #374151;">Dear ${customerName},</p>
        <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151;">
          Great news! Your <strong>${repair.phoneModel}</strong> has been successfully repaired and is ready for pickup.
        </p>
        <div style="background: #d1fae5; border-left: 4px solid #10b981; padding: 20px; border-radius: 8px; margin: 25px 0;">
          <h3 style="margin: 0 0 15px 0; color: #065f46; font-size: 18px;">Pickup Information</h3>
          <p style="margin: 5px 0; color: #064e3b;"><strong>Device:</strong> ${repair.phoneModel}</p>
          ${repair.actualCost ? `<p style="margin: 5px 0; color: #064e3b;"><strong>Repair Cost:</strong> $${(repair.actualCost / 100).toFixed(2)}</p>` : ''}
          <p style="margin: 15px 0 0 0; color: #064e3b; font-size: 15px;">
            Please collect your device at your earliest convenience during our business hours.
          </p>
        </div>
        <p style="margin: 20px 0 0 0; font-size: 16px; color: #374151;">
          Thank you for your patience!
        </p>
      `;
      smsMessage = `Ready for Pickup! Your ${repair.phoneModel} repair is complete. ${repair.actualCost ? `Cost: $${(repair.actualCost / 100).toFixed(2)}. ` : ''}Please come collect it at your convenience.`;
      break;

    case RepairStatus.PICKED_UP:
      subject = '🎉 Thank You for Your Business';
      message = `
        <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px;">Thank You!</h2>
        <p style="margin: 0 0 15px 0; font-size: 16px; color: #374151;">Dear ${customerName},</p>
        <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151;">
          Thank you for collecting your <strong>${repair.phoneModel}</strong>. We hope you're satisfied with our service!
        </p>
        <div style="background: #f3e8ff; border-left: 4px solid #8b5cf6; padding: 20px; border-radius: 8px; margin: 25px 0;">
          <p style="margin: 0; color: #5b21b6; font-size: 15px;">
            If you experience any issues with the repair, please don't hesitate to contact us within the warranty period.
          </p>
        </div>
        <p style="margin: 20px 0 0 0; font-size: 16px; color: #374151;">
          We look forward to serving you again!
        </p>
      `;
      smsMessage = `Thank you for collecting your ${repair.phoneModel}! We hope you're satisfied with our service. Contact us if you need any assistance.`;
      break;

    case RepairStatus.CANCELLED:
      subject = 'Repair Cancelled';
      message = `
        <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 24px;">Repair Cancelled</h2>
        <p style="margin: 0 0 15px 0; font-size: 16px; color: #374151;">Dear ${customerName},</p>
        <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151;">
          The repair for your <strong>${repair.phoneModel}</strong> has been cancelled as requested.
        </p>
        <div style="background: #fee2e2; border-left: 4px solid #ef4444; padding: 20px; border-radius: 8px; margin: 25px 0;">
          <p style="margin: 0; color: #991b1b; font-size: 15px;">
            If you have any questions or would like to proceed with the repair, please contact us.
          </p>
        </div>
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
  console.log('📧 Attempting to send email notification...');
  console.log('   To:', email);
  console.log('   Subject:', subject);
  console.log('   SMTP User:', process.env.SMTP_USER);
  console.log('   SMTP Pass configured:', !!process.env.SMTP_PASS);
  
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
          <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f3f4f6; margin: 0; padding: 0;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    
                    <!-- Header with Logo -->
                    <tr>
                      <td style="background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 40px 30px; text-align: center;">
                        <img src="https://i.ibb.co/9ZQZ3Qy/logo.png" alt="LoyaltyPro" style="width: 180px; height: auto; margin-bottom: 15px;">
                        <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Phone Repair Service</h1>
                      </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                      <td style="padding: 40px 30px;">
                        ${htmlMessage}
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                        <p style="margin: 0 0 10px 0; font-size: 14px; color: #6b7280;">
                          This is an automated notification from our repair tracking system.
                        </p>
                        <p style="margin: 10px 0; font-size: 12px; color: #9ca3af;">
                          If you have any questions, please contact our support team.
                        </p>
                        <p style="margin: 15px 0 0 0; font-size: 12px; color: #9ca3af;">
                          © 2025 LoyaltyPro. All rights reserved.
                        </p>
                      </td>
                    </tr>
                    
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
      text: htmlMessage.replace(/<[^>]*>/g, ''), // Strip HTML tags for plain text
    });

    console.log('✅ Email sent successfully! Message ID:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('❌ Email sending failed:', error);
    console.error('   Error message:', error.message);
    console.error('   Error code:', error.code);
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
  console.log('🔔 Starting repair notification process...');
  console.log('   Repair ID:', repair.id);
  console.log('   Status:', status);
  console.log('   Type:', type);
  console.log('   Send Via:', sendVia);
  console.log('   Has Customer:', !!repair.customer);
  
  if (!repair.customer) {
    console.error('❌ No customer associated with repair');
    throw new Error('No customer associated with repair');
  }

  const { firstName, lastName, phone, email } = repair.customer;
  console.log('   Customer:', `${firstName} ${lastName}`);
  console.log('   Email:', email);
  console.log('   Phone:', phone);
  
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
    console.log('📱 Sending SMS...');
    const smsResult = await sendSMSNotification(phone, customMessage || smsMessage);
    smsSent = smsResult.success;
    smsDelivered = smsResult.success;
    smsError = smsResult.error;
    smsMessageId = smsResult.messageId;
    console.log('   SMS Result:', smsResult.success ? '✅ Success' : '❌ Failed');
  }

  // Send Email if email exists and EMAIL is requested
  if (sendVia.includes('EMAIL') && email) {
    console.log('📧 Sending Email...');
    const emailResult = await sendEmailNotification(repair, email, subject, message);
    emailSent = emailResult.success;
    emailDelivered = emailResult.success;
    emailError = emailResult.error;
    emailMessageId = emailResult.messageId;
    console.log('   Email Result:', emailResult.success ? '✅ Success' : '❌ Failed');
  }

  // Save notification record
  console.log('💾 Saving notification record...');
  await prisma.repairNotification.create({
    data: {
      repairId: repair.id,
      type,
      status,
      sentVia: sendVia,
      recipientName: `${firstName} ${lastName}`,
      recipientPhone: phone || null,
      recipientEmail: email || null,
      subject: subject || null,
      message: customMessage || message,
      smsSent,
      emailSent,
      smsDelivered,
      emailDelivered,
      smsError: smsError || null,
      emailError: emailError || null,
      smsMessageId: smsMessageId || null,
      emailMessageId: emailMessageId || null,
    },
  });
  console.log('✅ Notification process completed!');
}

export default {
  sendRepairNotification,
};
