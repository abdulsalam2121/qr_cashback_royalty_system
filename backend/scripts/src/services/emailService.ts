import nodemailer from 'nodemailer';
import { createReadStream } from 'fs';
import { join } from 'path';

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER || 'covercellinsure@gmail.com',
        pass: process.env.SMTP_PASS, // App password for Gmail
      },
    });
  }

  private async createEmailVerificationTemplate(
    firstName: string,
    verificationToken: string
  ): Promise<EmailTemplate> {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email - LoyaltyPro</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); border-radius: 16px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
              <span style="color: white; font-size: 24px;">💳</span>
            </div>
            <h1 style="color: #1f2937; margin: 0;">Welcome to LoyaltyPro!</h1>
          </div>
          
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 30px; margin-bottom: 30px;">
            <h2 style="color: #1f2937; margin-top: 0;">Hi ${firstName},</h2>
            <p style="margin-bottom: 20px;">
              Thank you for signing up for LoyaltyPro! To complete your registration and start your free trial with 40 card activations, please verify your email address.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" 
                 style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                Verify Email Address
              </a>
            </div>
            
            <p style="margin-bottom: 0; font-size: 14px; color: #6b7280;">
              This verification link will expire in 24 hours. If you didn't create an account with LoyaltyPro, please ignore this email.
            </p>
          </div>
          
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
            <h3 style="color: #1e40af; margin-top: 0; font-size: 16px;">🎉 What's included in your free trial:</h3>
            <ul style="margin-bottom: 0; color: #1e40af;">
              <li>40 free customer card activations</li>
              <li>Complete loyalty program management</li>
              <li>Cashback rewards system</li>
              <li>QR code generation</li>
              <li>Real-time analytics</li>
            </ul>
          </div>
          
          <div style="text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 20px;">
            <p>If the button above doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #3b82f6;">${verificationUrl}</p>
            <p style="margin-top: 20px;">© 2025 LoyaltyPro. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    const text = `
      Welcome to LoyaltyPro!
      
      Hi ${firstName},
      
      Thank you for signing up for LoyaltyPro! To complete your registration and start your free trial with 40 card activations, please verify your email address.
      
      Click here to verify your email: ${verificationUrl}
      
      This verification link will expire in 24 hours. If you didn't create an account with LoyaltyPro, please ignore this email.
      
      What's included in your free trial:
      • 40 free customer card activations
      • Complete loyalty program management
      • Cashback rewards system
      • QR code generation
      • Real-time analytics
      
      If you have any questions, please contact our support team.
      
      © 2025 LoyaltyPro. All rights reserved.
    `;

    return {
      subject: 'Verify your email address - LoyaltyPro',
      html,
      text
    };
  }

  private async createPasswordResetTemplate(
    firstName: string,
    resetToken: string
  ): Promise<EmailTemplate> {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password - LoyaltyPro</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); border-radius: 16px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
              <span style="color: white; font-size: 24px;">💳</span>
            </div>
            <h1 style="color: #1f2937; margin: 0;">Password Reset Request</h1>
          </div>
          
          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 30px; margin-bottom: 30px;">
            <h2 style="color: #1f2937; margin-top: 0;">Hi ${firstName},</h2>
            <p style="margin-bottom: 20px;">
              We received a request to reset your password for your LoyaltyPro account. Click the button below to create a new password.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" 
                 style="background: linear-gradient(135deg, #dc2626, #ea580c); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                Reset Password
              </a>
            </div>
            
            <p style="margin-bottom: 0; font-size: 14px; color: #6b7280;">
              This password reset link will expire in 1 hour. If you didn't request a password reset, please ignore this email and your password will remain unchanged.
            </p>
          </div>
          
          <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
            <h3 style="color: #92400e; margin-top: 0; font-size: 16px;">🔒 Security Tips:</h3>
            <ul style="margin-bottom: 0; color: #92400e; font-size: 14px;">
              <li>Never share your password with anyone</li>
              <li>Use a strong, unique password</li>
              <li>Consider using a password manager</li>
              <li>Enable two-factor authentication when available</li>
            </ul>
          </div>
          
          <div style="text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 20px;">
            <p>If the button above doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #3b82f6;">${resetUrl}</p>
            <p style="margin-top: 20px;">© 2025 LoyaltyPro. All rights reserved.</p>
          </div>
        </body>
      </html>
    `;

    const text = `
      Password Reset Request - LoyaltyPro
      
      Hi ${firstName},
      
      We received a request to reset your password for your LoyaltyPro account. Click the link below to create a new password.
      
      Reset your password: ${resetUrl}
      
      This password reset link will expire in 1 hour. If you didn't request a password reset, please ignore this email and your password will remain unchanged.
      
      Security Tips:
      • Never share your password with anyone
      • Use a strong, unique password
      • Consider using a password manager
      • Enable two-factor authentication when available
      
      If you have any questions, please contact our support team.
      
      © 2025 LoyaltyPro. All rights reserved.
    `;

    return {
      subject: 'Reset your password - LoyaltyPro',
      html,
      text
    };
  }

  async sendEmailVerification(
    email: string,
    firstName: string,
    verificationToken: string
  ): Promise<void> {
    try {
      const template = await this.createEmailVerificationTemplate(firstName, verificationToken);
      
      const mailOptions = {
        from: `"LoyaltyPro" <${process.env.SMTP_USER || 'covercellinsure@gmail.com'}>`,
        to: email,
        subject: template.subject,
        text: template.text,
        html: template.html,
      };

      await this.transporter.sendMail(mailOptions);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Email verification sent successfully`);
      }
    } catch (error) {
      console.error('Error sending email verification:', error);
      throw new Error('Failed to send verification email');
    }
  }

  async sendPasswordReset(
    email: string,
    firstName: string,
    resetToken: string
  ): Promise<void> {
    try {
      const template = await this.createPasswordResetTemplate(firstName, resetToken);
      
      const mailOptions = {
        from: `"LoyaltyPro" <${process.env.SMTP_USER || 'covercellinsure@gmail.com'}>`,
        to: email,
        subject: template.subject,
        text: template.text,
        html: template.html,
      };

      await this.transporter.sendMail(mailOptions);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Password reset email sent successfully`);
      }
    } catch (error) {
      console.error('Error sending password reset email:', error);
      throw new Error('Failed to send password reset email');
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      if (process.env.NODE_ENV !== 'production') {
        console.log('Email service connection verified');
      }
      return true;
    } catch (error) {
      console.error('Email service connection failed:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();
