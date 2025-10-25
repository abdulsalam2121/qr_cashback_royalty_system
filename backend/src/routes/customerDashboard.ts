import express, { Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { customerAuth } from './customerAuth.js';
import { CustomerEmailService } from '../services/customerEmailService.js';

const router = express.Router();
const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });

// Validation schemas
const addFundsSchema = z.object({
  amountCents: z.number().int().min(100).max(50000), // Min $1, Max $500
  paymentMethodId: z.string().optional(), // For saved payment methods
  savePaymentMethod: z.boolean().default(false)
});

const transferFundsSchema = z.object({
  targetCardUid: z.string().min(1),
  amountCents: z.number().int().min(100) // Min $1
});

// Get customer dashboard data
router.get('/dashboard', customerAuth, asyncHandler(async (req: Request & { customer?: any }, res: Response) => {
  const { customerId, cardUid, tenantId } = req.customer;

  try {
    // Get customer and card data
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        cards: {
          where: { tenantId },
          include: {
            store: {
              select: {
                id: true,
                name: true,
                address: true
              }
            }
          }
        }
      }
    });

    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }

    // Get recent transactions
    const recentTransactions = await prisma.transaction.findMany({
      where: {
        customerId,
        tenantId
      },
      include: {
        store: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 20
    });

    // Calculate statistics
    const totalEarned = await prisma.transaction.aggregate({
      where: {
        customerId,
        tenantId,
        type: 'EARN'
      },
      _sum: {
        cashbackCents: true
      }
    });

    const totalRedeemed = await prisma.transaction.aggregate({
      where: {
        customerId,
        tenantId,
        type: 'REDEEM'
      },
      _sum: {
        amountCents: true
      }
    });

    const totalAdded = await prisma.transaction.aggregate({
      where: {
        customerId,
        tenantId,
        type: 'ADJUST',
        amountCents: { gt: 0 }
      },
      _sum: {
        amountCents: true
      }
    });

    res.json({
      customer: {
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone,
        tier: customer.tier,
        totalSpend: customer.totalSpend
      },
      cards: customer.cards.map(card => ({
        id: card.id,
        cardUid: card.cardUid,
        balanceCents: card.balanceCents,
        status: card.status,
        store: card.store,
        activatedAt: card.activatedAt
      })),
      transactions: recentTransactions.map(tx => ({
        id: tx.id,
        type: tx.type,
        category: tx.category,
        amountCents: tx.amountCents,
        cashbackCents: tx.cashbackCents,
        beforeBalanceCents: tx.beforeBalanceCents,
        afterBalanceCents: tx.afterBalanceCents,
        note: tx.note,
        store: tx.store,
        createdAt: tx.createdAt
      })),
      stats: {
        totalEarnedCents: totalEarned._sum.cashbackCents || 0,
        totalRedeemedCents: totalRedeemed._sum.amountCents || 0,
        totalAddedCents: totalAdded._sum.amountCents || 0,
        currentBalanceCents: customer.cards.find(c => c.cardUid === cardUid)?.balanceCents || 0
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
}));

// Get transaction history with pagination
router.get('/transactions', customerAuth, asyncHandler(async (req: Request & { customer?: any }, res: Response) => {
  const { customerId, tenantId } = req.customer;
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = (page - 1) * limit;

  try {
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          customerId,
          tenantId
        },
        include: {
          store: {
            select: {
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: offset,
        take: limit
      }),
      prisma.transaction.count({
        where: {
          customerId,
          tenantId
        }
      })
    ]);

    res.json({
      transactions: transactions.map(tx => ({
        id: tx.id,
        type: tx.type,
        category: tx.category,
        amountCents: tx.amountCents,
        cashbackCents: tx.cashbackCents,
        beforeBalanceCents: tx.beforeBalanceCents,
        afterBalanceCents: tx.afterBalanceCents,
        note: tx.note,
        store: tx.store,
        createdAt: tx.createdAt
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Transaction history error:', error);
    res.status(500).json({ error: 'Failed to load transactions' });
  }
}));

// Create payment intent for adding funds (using payment link approach like POS Terminal)
router.post('/add-funds/create-payment-intent', customerAuth, validate(addFundsSchema), 
asyncHandler(async (req: Request & { customer?: any }, res: Response) => {
  const { customerId, cardUid, tenantId } = req.customer;
  const { amountCents, savePaymentMethod } = req.body;

  try {
    // Get customer and tenant info
    const [customer, tenant] = await Promise.all([
      prisma.customer.findUnique({
        where: { id: customerId }
      }),
      prisma.tenant.findUnique({
        where: { id: tenantId }
      })
    ]);

    if (!customer || !tenant) {
      res.status(404).json({ error: 'Customer or tenant not found' });
      return;
    }

    // Create a payment link first (similar to POS Terminal approach)
    const result = await prisma.$transaction(async (tx) => {
      // Generate payment link token and ID
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      const paymentLinkId = `pl_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const purchaseTransactionId = `pt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

      const paymentLink = await tx.payment_links.create({
        data: {
          id: paymentLinkId,
          tenantId,
          token,
          amountCents,
          description: `Add $${(amountCents / 100).toFixed(2)} to ${tenant.name} loyalty card`,
          expiresAt,
        }
      });

      // Create a temporary purchase transaction for this fund addition
      const purchaseTransaction = await tx.purchase_transactions.create({
        data: {
          id: purchaseTransactionId,
          tenantId,
          storeId: tenantId, // Use tenant ID as default store
          customerId,
          cashierId: customerId, // Customer is adding their own funds
          cardUid,
          paymentMethod: 'QR_PAYMENT', // This will be processed as card payment via webhook
          paymentStatus: 'PENDING',
          amountCents,
          cashbackCents: 0, // No cashback for fund additions
          category: 'OTHER',
          description: `STORE_CREDIT: Customer fund addition - $${(amountCents / 100).toFixed(2)}`,
          paymentLinkId: paymentLink.id,
          paymentLinkExpiry: expiresAt,
          updatedAt: new Date(),
        }
      });

      return { paymentLink, purchaseTransaction };
    });

    // Create payment intent using the payment link (same as POS Terminal)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      metadata: {
        paymentLinkId: result.paymentLink.id, // This will be recognized by the webhook
      },
      description: `Add $${(amountCents / 100).toFixed(2)} to ${tenant.name} loyalty card`
    });

    console.log('Payment intent created:', {
      id: paymentIntent.id,
      amount: paymentIntent.amount,
      metadata: paymentIntent.metadata,
      status: paymentIntent.status,
      paymentLinkId: result.paymentLink.id
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      paymentLinkId: result.paymentLink.id
    });
  } catch (error) {
    console.error('Create payment intent error:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
}));

// Confirm fund addition after successful payment (verification only - webhook handles processing)
router.post('/add-funds/confirm', customerAuth, asyncHandler(async (req: Request & { customer?: any }, res: Response) => {
  const { customerId, cardUid, tenantId } = req.customer;
  const { paymentIntentId } = req.body;

  if (!paymentIntentId) {
    res.status(400).json({ error: 'Payment intent ID required' });
    return;
  }

  try {
    // Verify payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      res.status(400).json({ error: 'Payment not completed' });
      return;
    }

    // Wait a moment for webhook processing (if needed)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get updated card balance
    const card = await prisma.card.findUnique({
      where: { cardUid },
      select: { id: true, balanceCents: true }
    });

    if (!card) {
      res.status(404).json({ error: 'Card not found' });
      return;
    }

    // Find the most recent transaction for this payment
    const transaction = await prisma.transaction.findFirst({
      where: {
        customerId,
        cardId: card.id,
        type: 'ADJUST',
        category: 'OTHER',
        note: {
          contains: paymentIntent.metadata.paymentLinkId || paymentIntentId
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!transaction) {
      res.status(404).json({ error: 'Transaction not found. Payment may still be processing.' });
      return;
    }

    res.json({
      success: true,
      newBalanceCents: card.balanceCents,
      transaction: {
        id: transaction.id,
        amountCents: transaction.amountCents,
        createdAt: transaction.createdAt
      }
    });
  } catch (error) {
    console.error('Confirm fund addition error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
}));

// Helper function to find or create Stripe customer
async function findOrCreateStripeCustomer(email: string, firstName: string, lastName: string): Promise<string> {
  try {
    // Search for existing customer
    const existingCustomers = await stripe.customers.list({ email });
    
    if (existingCustomers.data && existingCustomers.data.length > 0 && existingCustomers.data[0]) {
      return existingCustomers.data[0].id;
    }

    // Create new customer
    const customer = await stripe.customers.create({
      email,
      name: `${firstName} ${lastName}`,
      metadata: {
        source: 'customer_dashboard'
      }
    });

    return customer.id;
  } catch (error) {
    console.error('Stripe customer creation error:', error);
    throw error;
  }
}

export default router;
