import express from 'express';
import { Request, Response } from 'express';
import { emailService } from '../services/emailService.js';
import { CustomerEmailService } from '../services/customerEmailService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();

// Test email endpoint - remove this in production
router.post('/test-email', asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  
  if (!email) {
    res.status(400).json({ error: 'Email address required' });
    return;
  }

  try {
    // Test basic email service
    await emailService.sendCustomEmail(
      email,
      'Test Email - Cashback System',
      `
        <html>
          <body style="font-family: Arial, sans-serif;">
            <h2>Email System Test</h2>
            <p>If you receive this email, the cashback email system is working correctly!</p>
            <p>Timestamp: ${new Date().toLocaleString()}</p>
          </body>
        </html>
      `,
      `
        Email System Test
        
        If you receive this email, the cashback email system is working correctly!
        
        Timestamp: ${new Date().toLocaleString()}
      `,
      'LoyaltyPro Test'
    );

    res.json({ 
      success: true, 
      message: 'Test email sent successfully',
      timestamp: new Date().toISOString()
    });
    return;

  } catch (error) {
    console.error('Test email failed:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    return;
  }
}));

// Test SMTP connection
router.get('/test-smtp', asyncHandler(async (req: Request, res: Response) => {
  try {
    const isConnected = await emailService.testConnection();
    
    res.json({
      success: isConnected,
      message: isConnected ? 'SMTP connection successful' : 'SMTP connection failed',
      config: {
        smtpUser: process.env.SMTP_USER || 'Not configured',
        smtpConfigured: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
      },
      timestamp: new Date().toISOString()
    });
    return;
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
    return;
  }
}));

export default router;