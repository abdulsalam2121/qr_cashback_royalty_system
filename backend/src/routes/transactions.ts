import express from 'express';
import { z } from 'zod';
import { PrismaClient, TxType, TxCategory } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { auth } from '../middleware/auth.js';
import { rbac } from '../middleware/rbac.js';
import { calculateCashback } from '../utils/cashback.js';
import { sendNotification } from '../services/notification.js';
import { updateCustomerTier } from '../utils/tiers.js';

const router = express.Router();
const prisma = new PrismaClient();

const earnSchema = z.object({
  cardUid: z.string(),
  amountCents: z.number().int().positive(),
  category: z.enum(['PURCHASE', 'REPAIR', 'OTHER']),
  storeId: z.string(),
  note: z.string().optional(),
});

const redeemSchema = z.object({
  cardUid: z.string(),
  amountCents: z.number().int().positive(),
  storeId: z.string(),
  note: z.string().optional(),
});

// Earn cashback
router.post('/earn', auth, rbac(['tenant_admin', 'cashier']), validate(earnSchema), asyncHandler(async (req: Request, res: Response) => {
  const { cardUid, amountCents, category, storeId, note } = req.body;
  const { tenantId, userId: cashierId } = req.user;

  const result = await prisma.$transaction(async (tx) => {
    // Get card with customer and current balance
    const card = await tx.card.findUnique({
      where: { cardUid },
      include: { 
        customer: true,
        store: true 
      },
    });

    if (!card) {
      throw new Error('Card not found');
    }

    if (card.tenantId !== tenantId) {
      throw new Error('Unauthorized');
    }

    if (card.status !== 'ACTIVE') {
      throw new Error('Card is not active');
    }

    if (!card.customer) {
      throw new Error('Card is not linked to a customer');
    }

    // Enforce store binding
    if (card.storeId !== storeId) {
      throw new Error(`This card can only be used at ${card.store?.name}. Current store binding prevents cross-store transactions.`);
    }

    // Verify store exists
    const store = await tx.store.findFirst({
      where: { id: storeId, tenantId }
    });

    if (!store) {
      throw new Error('Store not found');
    }

    // Calculate cashback
    const cashbackCents = await calculateCashback(
      amountCents,
      category as TxCategory,
      card.customer.tier,
      tenantId,
      tx
    );

    const beforeBalanceCents = card.balanceCents;
    const afterBalanceCents = beforeBalanceCents + cashbackCents;

    // Create transaction record
    const transaction = await tx.transaction.create({
      data: {
        tenantId,
        storeId,
        cardId: card.id,
        customerId: card.customerId!,
        cashierId,
        type: 'EARN' as TxType,
        category: category as TxCategory,
        amountCents,
        cashbackCents,
        beforeBalanceCents,
        afterBalanceCents,
        note,
        sourceIp: req.ip || null,
      },
      include: {
        customer: true,
        store: true,
        cashier: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    // Update card balance
    await tx.card.update({
      where: { id: card.id },
      data: { balanceCents: afterBalanceCents }
    });

    // Update customer total spend
    const newTotalSpend = new Decimal(card.customer.totalSpend).add(new Decimal(amountCents).div(100));
    await tx.customer.update({
      where: { id: card.customerId! },
      data: { totalSpend: newTotalSpend }
    });

    // Check for tier upgrade
    const updatedCustomer = await updateCustomerTier(card.customerId!, tenantId, tx);

    return { transaction, customer: updatedCustomer, storeName: card.store?.name };
  });

  // Send notification (async, don't block response)
  setImmediate(async () => {
    try {
      await sendNotification(
        result.transaction.customerId,
        'CASHBACK_EARNED',
        {
          customerName: `${result.customer.firstName} ${result.customer.lastName}`,
          amount: (result.transaction.cashbackCents / 100).toFixed(2),
          balance: (result.transaction.afterBalanceCents / 100).toFixed(2),
          storeName: result.storeName || 'Unknown Store',
          transactionAmount: (result.transaction.amountCents / 100).toFixed(2),
        },
        tenantId
      );
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  });

  res.json({
    message: 'Cashback earned successfully',
    transaction: result.transaction,
    cashbackEarned: result.transaction.cashbackCents,
    newBalance: result.transaction.afterBalanceCents,
  });
}));

// Redeem cashback
router.post('/redeem', auth, rbac(['tenant_admin', 'cashier']), validate(redeemSchema), asyncHandler(async (req: Request, res: Response) => {
  const { cardUid, amountCents, storeId, note } = req.body;
  const { tenantId, userId: cashierId } = req.user;

  const result = await prisma.$transaction(async (tx) => {
    // Get card with customer and current balance
    const card = await tx.card.findUnique({
      where: { cardUid },
      include: { 
        customer: true,
        store: true 
      },
    });

    if (!card) {
      throw new Error('Card not found');
    }

    if (card.tenantId !== tenantId) {
      throw new Error('Unauthorized');
    }

    if (card.status !== 'ACTIVE') {
      throw new Error('Card is not active');
    }

    if (!card.customer) {
      throw new Error('Card is not linked to a customer');
    }

    // Enforce store binding
    if (card.storeId !== storeId) {
      throw new Error(`This card can only be used at ${card.store?.name}. Current store binding prevents cross-store transactions.`);
    }

    // Check sufficient balance
    if (card.balanceCents < amountCents) {
      throw new Error('Insufficient balance for redemption');
    }

    // Verify store exists
    const store = await tx.store.findFirst({
      where: { id: storeId, tenantId }
    });

    if (!store) {
      throw new Error('Store not found');
    }

    const beforeBalanceCents = card.balanceCents;
    const afterBalanceCents = beforeBalanceCents - amountCents;

    // Create transaction record
    const transaction = await tx.transaction.create({
      data: {
        tenantId,
        storeId,
        cardId: card.id,
        customerId: card.customerId!,
        cashierId,
        type: 'REDEEM' as TxType,
        category: 'OTHER' as TxCategory,
        amountCents,
        cashbackCents: 0,
        beforeBalanceCents,
        afterBalanceCents,
        note,
        sourceIp: req.ip || null,
      },
      include: {
        customer: true,
        store: true,
        cashier: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    // Update card balance
    await tx.card.update({
      where: { id: card.id },
      data: { balanceCents: afterBalanceCents }
    });

    return { 
      ...transaction, 
      customer: card.customer, 
      store: card.store 
    };
  });

  // Send notification (async, don't block response)
  setImmediate(async () => {
    try {
      await sendNotification(
        result.customerId,
        'CASHBACK_REDEEMED',
        {
          customerName: `${result.customer.firstName} ${result.customer.lastName}`,
          amount: (result.amountCents / 100).toFixed(2),
          balance: (result.afterBalanceCents / 100).toFixed(2),
          storeName: result.store?.name || 'Unknown Store',
        },
        tenantId
      );
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  });

  res.json({
    message: 'Cashback redeemed successfully',
    transaction: result,
    amountRedeemed: result.amountCents,
    newBalance: result.afterBalanceCents,
  });
}));

// Get transactions
router.get('/', auth, rbac(['tenant_admin', 'cashier']), asyncHandler(async (req, res) => {
  const { tenantId, storeId, role } = req.user;
  const { 
    type, 
    category, 
    customerId, 
    cardUid,
    storeFilter,
    from, 
    to,
    page = 1, 
    limit = 50 
  } = req.query;

  const where: any = { tenantId };

  // Cashiers can only see transactions from their store
  if (role === 'cashier' && storeId) {
    where.storeId = storeId;
  }

  if (type) {
    where.type = type;
  }

  if (category) {
    where.category = category;
  }

  if (customerId) {
    where.customerId = customerId;
  }

  if (cardUid) {
    where.card = { cardUid };
  }

  if (storeFilter && role === 'admin') {
    where.storeId = storeFilter;
  }

  if (from || to) {
    where.createdAt = {};
    if (from) {
      where.createdAt.gte = new Date(from as string);
    }
    if (to) {
      where.createdAt.lte = new Date(to as string);
    }
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        customer: {
          select: { firstName: true, lastName: true, tier: true }
        },
        card: {
          select: { cardUid: true }
        },
        store: {
          select: { name: true }
        },
        cashier: {
          select: { firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
    }),
    prisma.transaction.count({ where }),
  ]);

  // Flatten the nested structure for the frontend
  const flattenedTransactions = transactions.map(transaction => ({
    ...transaction,
    customerName: transaction.customer ? 
      `${transaction.customer.firstName} ${transaction.customer.lastName}` : '',
    cardUid: transaction.card?.cardUid || '',
    storeName: transaction.store?.name || '',
    cashierName: transaction.cashier ? 
      `${transaction.cashier.firstName} ${transaction.cashier.lastName}` : '',
    // Remove the nested objects to avoid confusion
    customer: undefined,
    card: undefined,
    store: undefined,
    cashier: undefined,
  }));

  res.json({
    transactions: flattenedTransactions,
    total,
    page: Number(page),
    limit: Number(limit),
    pages: Math.ceil(total / Number(limit)),
  });
}));

// Get transaction by ID
router.get('/:id', auth, rbac(['tenant_admin', 'cashier']), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { tenantId, storeId, role } = req.user;

  const where: any = { id, tenantId };

  // Cashiers can only see transactions from their store
  if (role === 'cashier' && storeId) {
    where.storeId = storeId;
  }

  const transaction = await prisma.transaction.findFirst({
    where,
    include: {
      customer: true,
      card: {
        select: { cardUid: true, qrUrl: true }
      },
      store: true,
      cashier: {
        select: { firstName: true, lastName: true, email: true }
      }
    },
  });

  if (!transaction) {
    res.status(404).json({ error: 'Transaction not found' });
    return;
  }

  res.json(transaction);
  return;
}));

// Add funds to card (Store Credit redemption)
const addFundsSchema = z.object({
  cardUid: z.string(),
  amountCents: z.number().int().positive(),
  storeId: z.string(),
  paymentMethod: z.enum(['CASH', 'CARD', 'QR_PAYMENT']),
  note: z.string().optional(),
});

router.post('/add-funds', auth, rbac(['tenant_admin', 'cashier']), validate(addFundsSchema), asyncHandler(async (req: Request, res: Response) => {
  const { cardUid, amountCents, storeId, paymentMethod, note } = req.body;
  const { tenantId, userId: cashierId } = req.user;

  const result = await prisma.$transaction(async (tx) => {
    // Get card with customer and current balance
    const card = await tx.card.findUnique({
      where: { cardUid },
      include: { 
        customer: true,
        store: true 
      },
    });

    if (!card) {
      throw new Error('Card not found');
    }

    if (card.tenantId !== tenantId) {
      throw new Error('Unauthorized');
    }

    if (card.status !== 'ACTIVE') {
      throw new Error('Card is not active');
    }

    if (!card.customer) {
      throw new Error('Card is not linked to a customer');
    }

    // Enforce store binding
    if (card.storeId !== storeId) {
      throw new Error(`This card can only be used at ${card.store?.name}. Current store binding prevents cross-store transactions.`);
    }

    // Verify store exists
    const store = await tx.store.findFirst({
      where: { id: storeId, tenantId }
    });

    if (!store) {
      throw new Error('Store not found');
    }

    const beforeBalanceCents = card.balanceCents;
    const afterBalanceCents = beforeBalanceCents + amountCents;

    // Create transaction record with type 'OTHER' to track the fund addition
    const transaction = await tx.transaction.create({
      data: {
        tenantId,
        storeId,
        cardId: card.id,
        customerId: card.customerId!,
        cashierId,
        type: 'OTHER' as TxType, // Using OTHER type to distinguish from EARN/REDEEM
        category: 'OTHER' as TxCategory,
        amountCents,
        cashbackCents: 0,
        beforeBalanceCents,
        afterBalanceCents,
        note: note ? `Store Credit (${paymentMethod}): ${note}` : `Store Credit added via ${paymentMethod}`,
        sourceIp: req.ip || null,
      },
      include: {
        customer: true,
        store: true,
        cashier: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    // Update card balance
    await tx.card.update({
      where: { id: card.id },
      data: { balanceCents: afterBalanceCents }
    });

    return { 
      ...transaction, 
      customer: card.customer, 
      store: card.store 
    };
  });

  // Send notification (async, don't block response)
  setImmediate(async () => {
    try {
      await sendNotification(
        result.customerId,
        'CASHBACK_EARNED', // Reusing this notification type as funds were added
        {
          customerName: `${result.customer.firstName} ${result.customer.lastName}`,
          amount: (result.amountCents / 100).toFixed(2),
          balance: (result.afterBalanceCents / 100).toFixed(2),
          storeName: result.store?.name || 'Unknown Store',
        },
        tenantId
      );
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  });

  res.json({
    message: 'Funds added successfully',
    transaction: result,
    amountAdded: result.amountCents,
    newBalance: result.afterBalanceCents,
  });
}));

export default router;

