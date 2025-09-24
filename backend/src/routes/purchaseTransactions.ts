import express from 'express';
import { z } from 'zod';
import { PrismaClient, PaymentMethod, PaymentStatus, TxCategory } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { auth } from '../middleware/auth.js';
import { rbac } from '../middleware/rbac.js';
import { calculateCashback } from '../utils/cashback.js';
import { updateCustomerTier } from '../utils/tiers.js';
import { sendNotification } from '../services/notification.js';
import { generateSecureToken } from '../utils/crypto.js';

const router = express.Router();
const prisma = new PrismaClient();

const createPurchaseSchema = z.object({
  cardUid: z.string().optional(),
  customerId: z.string().optional(),
  amountCents: z.number().int().positive(),
  category: z.enum(['PURCHASE', 'REPAIR', 'OTHER']),
  description: z.string().optional(),
  paymentMethod: z.enum(['QR_PAYMENT', 'CASH', 'CARD']),
  customerInfo: z.object({
    firstName: z.string(),
    lastName: z.string(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  }).optional(),
});

const confirmPaymentSchema = z.object({
  purchaseTransactionId: z.string(),
});

const paymentLinkSchema = z.object({
  token: z.string(),
});

// Create purchase transaction (with or without card)
router.post('/create', auth, rbac(['tenant_admin', 'cashier']), validate(createPurchaseSchema), asyncHandler(async (req: Request, res: Response) => {
  const { cardUid, customerId, amountCents, category, description, paymentMethod, customerInfo } = req.body;
  const { tenantId, userId: cashierId, storeId } = req.user;

  console.log('🔍 Purchase Transaction Data:', {
    amountCents,
    category,
    paymentMethod,
    cardUid,
    customerId
  });

  if (!storeId) {
    res.status(400).json({ error: 'Cashier must be assigned to a store' });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    let customer = null;
    let card = null;
    let cashbackCents = 0;

    // If card is provided, validate and get customer info
    if (cardUid) {
      card = await tx.card.findUnique({
        where: { cardUid },
        include: { customer: true, store: true }
      });

      if (!card) {
        throw new Error('Card not found');
      }

      if (card.tenantId !== tenantId) {
        throw new Error('Unauthorized - card belongs to different tenant');
      }

      if (card.status !== 'ACTIVE') {
        throw new Error('Card is not active');
      }

      if (!card.customer) {
        throw new Error('Card is not linked to a customer');
      }

      // Enforce store binding
      if (card.storeId !== storeId) {
        throw new Error(`This card can only be used at ${card.store?.name}`);
      }

      customer = card.customer;

      // Calculate cashback for card-based purchases
      cashbackCents = await calculateCashback(
        amountCents,
        category as TxCategory,
        customer.tier,
        tenantId,
        tx
      );
    } else if (customerId) {
      // Use existing customer without card
      customer = await tx.customer.findFirst({
        where: { id: customerId, tenantId }
      });

      if (!customer) {
        throw new Error('Customer not found');
      }
    } else if (customerInfo && paymentMethod !== 'QR_PAYMENT') {
      // Create new customer for CASH/CARD transactions
      // First check if customer with email exists
      if (customerInfo.email) {
        customer = await tx.customer.findUnique({
          where: { email: customerInfo.email }
        });
      }

      if (!customer) {
        customer = await tx.customer.create({
          data: {
            ...customerInfo,
            tenantId,
            tier: 'SILVER',
            totalSpend: 0,
          }
        });
      }
    }

    // Generate payment link for QR payments
    let paymentLinkId = null;
    let paymentLinkExpiry = null;
    
    if (paymentMethod === 'QR_PAYMENT') {
      const token = generateSecureToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

      const paymentLink = await tx.paymentLink.create({
        data: {
          tenantId,
          token,
          amountCents,
          description: description || 'Purchase Payment',
          expiresAt,
        }
      });

      paymentLinkId = paymentLink.id;
      paymentLinkExpiry = expiresAt;
    }

    // Create purchase transaction
    const purchaseTransaction = await tx.purchaseTransaction.create({
      data: {
        tenantId,
        storeId,
        customerId: customer?.id || null,
        cashierId,
        cardUid,
        paymentMethod: paymentMethod as PaymentMethod,
        paymentStatus: paymentMethod === 'CASH' ? 'COMPLETED' as PaymentStatus : 'PENDING' as PaymentStatus,
        amountCents,
        cashbackCents,
        category: category as TxCategory,
        description,
        paymentLinkId,
        paymentLinkExpiry,
        paidAt: paymentMethod === 'CASH' ? new Date() : null,
      },
      include: {
        store: { select: { name: true } },
        customer: { select: { firstName: true, lastName: true, email: true } },
        cashier: { select: { firstName: true, lastName: true } },
        paymentLink: true,
      }
    });

    // If CASH payment, process cashback immediately
    if (paymentMethod === 'CASH' && card && customer && cashbackCents > 0) {
      // Update card balance
      const newBalance = card.balanceCents + cashbackCents;
      await tx.card.update({
        where: { id: card.id },
        data: { balanceCents: newBalance }
      });

      // Update customer total spend
      const newTotalSpend = new Decimal(customer.totalSpend).add(new Decimal(amountCents).div(100));
      await tx.customer.update({
        where: { id: customer.id },
        data: { totalSpend: newTotalSpend }
      });

      // Create traditional cashback transaction record
      await tx.transaction.create({
        data: {
          tenantId,
          storeId,
          cardId: card.id,
          customerId: customer.id,
          cashierId,
          type: 'EARN',
          category: category as TxCategory,
          amountCents,
          cashbackCents,
          beforeBalanceCents: card.balanceCents,
          afterBalanceCents: newBalance,
          note: `Purchase transaction: ${purchaseTransaction.id}`,
          sourceIp: req.ip || null,
        }
      });

      // Check for tier upgrade
      await updateCustomerTier(customer.id, tenantId, tx);
    }

    return purchaseTransaction;
  });

  // Generate payment link URL for QR payments
  let paymentUrl = null;
  if (paymentMethod === 'QR_PAYMENT' && result.paymentLink) {
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    paymentUrl = `${baseUrl}/payment/${result.paymentLink.token}`;
  }

  res.json({
    success: true,
    message: 'Purchase transaction created successfully',
    transaction: result,
    paymentUrl,
  });
}));

// Confirm payment (for completing QR payments)
router.post('/confirm-payment', auth, rbac(['tenant_admin', 'cashier']), validate(confirmPaymentSchema), asyncHandler(async (req: Request, res: Response) => {
  const { purchaseTransactionId } = req.body;
  const { tenantId, userId: cashierId } = req.user;

  const result = await prisma.$transaction(async (tx) => {
    const purchaseTransaction = await tx.purchaseTransaction.findUnique({
      where: { id: purchaseTransactionId },
      include: {
        customer: true,
        paymentLink: true,
      }
    });

    if (!purchaseTransaction) {
      throw new Error('Purchase transaction not found');
    }

    if (purchaseTransaction.tenantId !== tenantId) {
      throw new Error('Unauthorized');
    }

    if (purchaseTransaction.paymentStatus !== 'PENDING') {
      throw new Error('Transaction is not pending');
    }

    // Update payment status
    const updatedTransaction = await tx.purchaseTransaction.update({
      where: { id: purchaseTransactionId },
      data: {
        paymentStatus: 'COMPLETED',
        paidAt: new Date(),
      },
      include: {
        store: { select: { name: true } },
        customer: { select: { firstName: true, lastName: true, email: true } },
        cashier: { select: { firstName: true, lastName: true } },
      }
    });

    // If there's a card and cashback, process it
    if (purchaseTransaction.cardUid && purchaseTransaction.cashbackCents && purchaseTransaction.cashbackCents > 0) {
      const card = await tx.card.findUnique({
        where: { cardUid: purchaseTransaction.cardUid },
        include: { customer: true }
      });

      if (card && card.customer) {
        const newBalance = card.balanceCents + purchaseTransaction.cashbackCents;
        
        // Update card balance
        await tx.card.update({
          where: { id: card.id },
          data: { balanceCents: newBalance }
        });

        // Update customer total spend
        const newTotalSpend = new Decimal(card.customer.totalSpend).add(new Decimal(purchaseTransaction.amountCents).div(100));
        await tx.customer.update({
          where: { id: card.customer.id },
          data: { totalSpend: newTotalSpend }
        });

        // Create traditional cashback transaction record
        await tx.transaction.create({
          data: {
            tenantId,
            storeId: purchaseTransaction.storeId,
            cardId: card.id,
            customerId: card.customer.id,
            cashierId,
            type: 'EARN',
            category: purchaseTransaction.category,
            amountCents: purchaseTransaction.amountCents,
            cashbackCents: purchaseTransaction.cashbackCents,
            beforeBalanceCents: card.balanceCents,
            afterBalanceCents: newBalance,
            note: `Purchase transaction: ${purchaseTransaction.id}`,
            sourceIp: req.ip || null,
          }
        });

        // Check for tier upgrade
        await updateCustomerTier(card.customer.id, tenantId, tx);
      }
    }

    // Mark payment link as used if exists
    if (purchaseTransaction.paymentLinkId) {
      await tx.paymentLink.update({
        where: { id: purchaseTransaction.paymentLinkId },
        data: { usedAt: new Date() }
      });
    }

    return updatedTransaction;
  });

  res.json({
    success: true,
    message: 'Payment confirmed successfully',
    transaction: result,
  });
}));

// Process payment via link (customer-facing)
router.post('/pay/:token', validate(paymentLinkSchema), asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;

  if (!token) {
    res.status(400).json({ error: 'Payment token is required' });
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const paymentLink = await tx.paymentLink.findUnique({
      where: { token: token },
      include: {
        purchaseTransactions: {
          where: { paymentStatus: 'PENDING' },
          include: {
            store: { select: { name: true } },
            customer: { select: { firstName: true, lastName: true } },
          }
        },
        tenant: true
      }
    });

    if (!paymentLink) {
      throw new Error('Payment link not found or expired');
    }

    if (paymentLink.usedAt) {
      throw new Error('Payment link has already been used');
    }

    if (new Date() > paymentLink.expiresAt) {
      throw new Error('Payment link has expired');
    }

    const purchaseTransaction = paymentLink.purchaseTransactions[0];
    if (!purchaseTransaction) {
      throw new Error('No pending transaction found for this payment link');
    }

    // Update payment status
    const updatedTransaction = await tx.purchaseTransaction.update({
      where: { id: purchaseTransaction.id },
      data: {
        paymentStatus: 'COMPLETED',
        paidAt: new Date(),
      },
      include: {
        store: { select: { name: true } },
        customer: { select: { firstName: true, lastName: true, email: true } },
      }
    });

    // Mark payment link as used
    await tx.paymentLink.update({
      where: { id: paymentLink.id },
      data: { usedAt: new Date() }
    });

    // Process cashback if applicable
    if (purchaseTransaction.cardUid && purchaseTransaction.cashbackCents && purchaseTransaction.cashbackCents > 0) {
      const card = await tx.card.findUnique({
        where: { cardUid: purchaseTransaction.cardUid },
        include: { customer: true }
      });

      if (card && card.customer) {
        const newBalance = card.balanceCents + purchaseTransaction.cashbackCents;

        // Update card balance
        await tx.card.update({
          where: { id: card.id },
          data: { balanceCents: newBalance }
        });

        // Update customer total spend
        const newTotalSpend = new Decimal(card.customer.totalSpend).add(new Decimal(purchaseTransaction.amountCents).div(100));
        await tx.customer.update({
          where: { id: card.customer.id },
          data: { totalSpend: newTotalSpend }
        });

        // Create traditional cashback transaction record
        await tx.transaction.create({
          data: {
            tenantId: purchaseTransaction.tenantId,
            storeId: purchaseTransaction.storeId,
            cardId: card.id,
            customerId: card.customer.id,
            cashierId: purchaseTransaction.cashierId,
            type: 'EARN',
            category: purchaseTransaction.category,
            amountCents: purchaseTransaction.amountCents,
            cashbackCents: purchaseTransaction.cashbackCents,
            beforeBalanceCents: card.balanceCents,
            afterBalanceCents: newBalance,
            note: `Purchase transaction: ${purchaseTransaction.id}`,
          }
        });

        // Check for tier upgrade
        await updateCustomerTier(card.customer.id, purchaseTransaction.tenantId, tx);
      }
    }

    return updatedTransaction;
  });

  res.json({
    success: true,
    message: 'Payment processed successfully',
    transaction: result,
  });
}));

// Get purchase transactions
router.get('/', auth, rbac(['tenant_admin', 'cashier']), asyncHandler(async (req: Request, res: Response) => {
  const { tenantId, role, storeId } = req.user;
  const { page = '1', limit = '20', status, paymentMethod } = req.query;
  
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const offset = (pageNum - 1) * limitNum;

  const where: any = { tenantId };

  // Cashiers can only see transactions from their store
  if (role === 'cashier' && storeId) {
    where.storeId = storeId;
  }

  if (status) {
    where.paymentStatus = status;
  }

  if (paymentMethod) {
    where.paymentMethod = paymentMethod;
  }

  const [transactions, total] = await Promise.all([
    prisma.purchaseTransaction.findMany({
      where,
      include: {
        store: { select: { name: true } },
        customer: { select: { firstName: true, lastName: true, email: true } },
        cashier: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limitNum,
    }),
    prisma.purchaseTransaction.count({ where }),
  ]);

  const pages = Math.ceil(total / limitNum);

  res.json({
    transactions,
    total,
    page: pageNum,
    pages,
  });
}));

// Get payment link details (customer-facing)
router.get('/payment-link/:token', asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;

  if (!token) {
    res.status(400).json({ error: 'Payment token is required' });
    return;
  }

  const paymentLink = await prisma.paymentLink.findUnique({
    where: { token: token },
    include: {
      purchaseTransactions: {
        where: { paymentStatus: 'PENDING' },
        include: {
          store: { select: { name: true } },
          customer: { select: { firstName: true, lastName: true } },
        }
      },
      tenant: true
    }
  });

  if (!paymentLink) {
    res.status(404).json({ error: 'Payment link not found' });
    return;
  }

  if (paymentLink.usedAt) {
    res.status(410).json({ error: 'Payment link has already been used' });
    return;
  }

  if (new Date() > paymentLink.expiresAt) {
    res.status(410).json({ error: 'Payment link has expired' });
    return;
  }

  const purchaseTransaction = paymentLink.purchaseTransactions[0];
  if (!purchaseTransaction) {
    res.status(404).json({ error: 'No pending transaction found' });
    return;
  }

  res.json({
    paymentLink: {
      id: paymentLink.id,
      token: paymentLink.token,
      amountCents: paymentLink.amountCents,
      description: paymentLink.description,
      expiresAt: paymentLink.expiresAt,
      tenantName: paymentLink.tenant.name,
    },
    transaction: {
      id: purchaseTransaction.id,
      amountCents: purchaseTransaction.amountCents,
      category: purchaseTransaction.category,
      description: purchaseTransaction.description,
      storeName: purchaseTransaction.store?.name,
      customerName: purchaseTransaction.customer ? 
        `${purchaseTransaction.customer.firstName} ${purchaseTransaction.customer.lastName}` : null,
    }
  });
}));

export default router;