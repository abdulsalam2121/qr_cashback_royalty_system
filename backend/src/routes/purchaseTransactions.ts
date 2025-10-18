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
import { CustomerEmailService } from '../services/customerEmailService.js';
import Stripe from 'stripe';

const router = express.Router();
const prisma = new PrismaClient();

const createPurchaseSchema = z.object({
  cardUid: z.string().optional(),
  customerId: z.string().optional(),
  storeId: z.string().optional(), // Allow tenant admins to specify store
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
  const { cardUid, customerId, amountCents, category, description, paymentMethod, customerInfo, storeId: requestedStoreId } = req.body;
  const { tenantId, userId: cashierId, storeId: userStoreId, role } = req.user;

  console.log('Purchase transaction request:', {
    amountCents,
    category,
    paymentMethod,
    cardUid,
    customerId,
    userRole: role,
    userStoreId,
    requestedStoreId
  });

  // Determine which store to use for the transaction
  let transactionStoreId = userStoreId;

  // If user is tenant_admin and no store is assigned, they can specify a store
  if (role === 'tenant_admin') {
    if (requestedStoreId) {
      // Verify the requested store belongs to the tenant
      const store = await prisma.store.findFirst({
        where: { 
          id: requestedStoreId, 
          tenantId 
        }
      });

      if (!store) {
        res.status(400).json({ error: 'Invalid store specified' });
        return;
      }

      transactionStoreId = requestedStoreId;
    } else if (!userStoreId) {
      // If tenant admin has no store assignment and none specified, use first available store
      const firstStore = await prisma.store.findFirst({
        where: { tenantId, active: true }
      });

      if (!firstStore) {
        res.status(400).json({ error: 'No active stores found for tenant' });
        return;
      }

      transactionStoreId = firstStore.id;
    }
  } else if (role === 'cashier' && !userStoreId) {
    // Cashiers must be assigned to a store
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

      // Enforce store binding for card-based transactions (unless tenant_admin)
      if (card.storeId && card.storeId !== transactionStoreId && role !== 'tenant_admin') {
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
        storeId: transactionStoreId,
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
          storeId: transactionStoreId,
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
      
      // Send cashback earned email notification (async, don't block response)
      if (customer.email) {
        setImmediate(async () => {
          try {
            const tenant = await prisma.tenant.findUnique({
              where: { id: tenantId },
              select: { name: true }
            });
            
            const store = await prisma.store.findUnique({
              where: { id: transactionStoreId },
              select: { name: true }
            });

            await CustomerEmailService.sendCashbackEarnedNotification(
              tenantId,
              customer.id,
              {
                customerName: `${customer.firstName} ${customer.lastName}`,
                cashbackAmount: (cashbackCents / 100).toFixed(2),
                purchaseAmount: (amountCents / 100).toFixed(2),
                newBalance: (newBalance / 100).toFixed(2),
                beforeBalance: (card.balanceCents / 100).toFixed(2),
                storeName: store?.name || 'Store',
                tenantName: tenant?.name || null,
                timestamp: new Date().toLocaleString(),
                transactionId: purchaseTransaction.id,
              }
            );
          } catch (error) {
            console.error('Failed to send cashback earned email:', error);
          }
        });
      }
    } else if (paymentMethod === 'CASH' && card && customer) {
      // Even if no cashback, create a transaction record for tracking
      const newTotalSpend = new Decimal(customer.totalSpend).add(new Decimal(amountCents).div(100));
      await tx.customer.update({
        where: { id: customer.id },
        data: { totalSpend: newTotalSpend }
      });

      await tx.transaction.create({
        data: {
          tenantId,
          storeId: transactionStoreId,
          cardId: card.id,
          customerId: customer.id,
          cashierId,
          type: 'EARN',
          category: category as TxCategory,
          amountCents,
          cashbackCents: 0,
          beforeBalanceCents: card.balanceCents,
          afterBalanceCents: card.balanceCents,
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




const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20', // use latest stable
});

// Create PaymentIntent for a payment link
router.post('/create-payment-intent/:token', asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.params;

  if (!token) {
    res.status(400).json({ error: 'Token parameter is required' });
    return;
  }

  const paymentLink = await prisma.paymentLink.findUnique({
    where: { token },
  });

  if (!paymentLink) {
    res.status(404).json({ error: 'Payment link not found' });
    return;
  }

  if (paymentLink.usedAt || new Date() > paymentLink.expiresAt) {
    res.status(400).json({ error: 'Payment link expired or already used' });
    return;
  }

  // Create a PaymentIntent with Stripe
  const intent = await stripe.paymentIntents.create({
    amount: paymentLink.amountCents,
    currency: 'usd',
    metadata: {
      paymentLinkId: paymentLink.id,
    },
  });

  res.json({ client_secret: intent.client_secret });
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

    // Check if this is a store credit transaction
    const isStoreCredit = updatedTransaction.description?.startsWith('STORE_CREDIT:');
    
    if (isStoreCredit) {
      // For store credit, add the amount directly to card balance
      if (purchaseTransaction.cardUid) {
        const card = await tx.card.findUnique({
          where: { cardUid: purchaseTransaction.cardUid },
          include: { customer: true }
        });

        if (card && card.customer) {
          const beforeBalance = card.balanceCents;
          const newBalance = beforeBalance + updatedTransaction.amountCents;
          
          // Update card balance
          await tx.card.update({
            where: { id: card.id },
            data: { balanceCents: newBalance }
          });

          // Create an ADJUST transaction record
          await tx.transaction.create({
            data: {
              tenantId,
              storeId: purchaseTransaction.storeId,
              cardId: card.id,
              customerId: card.customer.id,
              cashierId,
              type: 'ADJUST',
              category: 'OTHER',
              amountCents: updatedTransaction.amountCents,
              cashbackCents: 0,
              beforeBalanceCents: beforeBalance,
              afterBalanceCents: newBalance,
              note: `Store Credit via ${updatedTransaction.paymentMethod}: ${purchaseTransaction.id}`,
              sourceIp: req.ip || null,
            }
          });
          
          // Send notification
          setImmediate(async () => {
            try {
              await sendNotification(
                card.customer!.id,
                'CASHBACK_EARNED',
                {
                  customerName: `${card.customer!.firstName} ${card.customer!.lastName}`,
                  amount: (updatedTransaction.amountCents / 100).toFixed(2),
                  balance: (newBalance / 100).toFixed(2),
                  storeName: updatedTransaction.store?.name || 'Store',
                },
                tenantId
              );
            } catch (error) {
              console.error('Failed to send store credit notification:', error);
            }
          });
        }
      }
    } else {
      // Regular purchase transaction - process cashback
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
        
        // Send cashback earned email notification (async, don't block response)
        if (card.customer.email) {
          setImmediate(async () => {
            try {
              const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                select: { name: true }
              });
              
              const store = await prisma.store.findUnique({
                where: { id: purchaseTransaction.storeId },
                select: { name: true }
              });

              await CustomerEmailService.sendCashbackEarnedNotification(
                tenantId,
                card.customer!.id,
                {
                  customerName: `${card.customer!.firstName} ${card.customer!.lastName}`,
                  cashbackAmount: (purchaseTransaction.cashbackCents! / 100).toFixed(2),
                  purchaseAmount: (purchaseTransaction.amountCents / 100).toFixed(2),
                  newBalance: (newBalance / 100).toFixed(2),
                  beforeBalance: (card.balanceCents / 100).toFixed(2),
                  storeName: store?.name || 'Store',
                  tenantName: tenant?.name || null,
                  timestamp: new Date().toLocaleString(),
                  transactionId: purchaseTransaction.id,
                }
              );
            } catch (error) {
              console.error('Failed to send cashback earned email:', error);
            }
          });
        }
      }
    }
    } // End of else block for regular purchase transactions

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
router.post('/pay/:token', asyncHandler(async (req: Request, res: Response) => {
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
        
        // Send cashback earned email notification (async, don't block response)
        if (card.customer?.email) {
          setImmediate(async () => {
            try {
              const tenant = await prisma.tenant.findUnique({
                where: { id: purchaseTransaction.tenantId },
                select: { name: true }
              });
              
              const store = await prisma.store.findUnique({
                where: { id: purchaseTransaction.storeId },
                select: { name: true }
              });

              await CustomerEmailService.sendCashbackEarnedNotification(
                purchaseTransaction.tenantId,
                card.customer!.id,
                {
                  customerName: `${card.customer!.firstName} ${card.customer!.lastName}`,
                  cashbackAmount: (purchaseTransaction.cashbackCents! / 100).toFixed(2),
                  purchaseAmount: (purchaseTransaction.amountCents / 100).toFixed(2),
                  newBalance: (newBalance / 100).toFixed(2),
                  beforeBalance: (card.balanceCents / 100).toFixed(2),
                  storeName: store?.name || 'Store',
                  tenantName: tenant?.name || null,
                  timestamp: new Date().toLocaleString(),
                  transactionId: purchaseTransaction.id,
                }
              );
            } catch (error) {
              console.error('Failed to send cashback earned email in payment confirmation:', error);
            }
          });
        }
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

// Add credit to card (Store Credit with payment)
const addCreditSchema = z.object({
  cardUid: z.string(),
  amountCents: z.number().int().positive(),
  storeId: z.string(),
  paymentMethod: z.enum(['QR_PAYMENT', 'CARD']),
  description: z.string().optional(),
});

router.post('/add-credit', auth, rbac(['tenant_admin', 'cashier']), validate(addCreditSchema), asyncHandler(async (req: Request, res: Response) => {
  const { cardUid, amountCents, storeId, paymentMethod, description } = req.body;
  const { tenantId, userId: cashierId } = req.user;

  const result = await prisma.$transaction(async (tx) => {
    // Get card with customer
    const card = await tx.card.findUnique({
      where: { cardUid },
      include: { customer: true, store: true }
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
      throw new Error(`This card can only be used at ${card.store?.name}`);
    }

    // Generate payment link
    const token = generateSecureToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

    const paymentLink = await tx.paymentLink.create({
      data: {
        tenantId,
        token,
        amountCents,
        description: description || 'Store Credit Top-up',
        expiresAt,
      }
    });

    // Create a special purchase transaction for store credit
    // This will be marked as COMPLETED when payment is received
    const purchaseTransaction = await tx.purchaseTransaction.create({
      data: {
        tenantId,
        storeId,
        customerId: card.customerId!,
        cardUid: card.cardUid, // Use cardUid instead of cardId
        cashierId,
        amountCents,
        category: 'OTHER' as TxCategory,
        description: 'STORE_CREDIT: ' + (description || 'Store Credit Top-up'),
        paymentMethod: paymentMethod as PaymentMethod,
        paymentStatus: 'PENDING' as PaymentStatus,
        paymentLinkId: paymentLink.id,
        cashbackCents: 0, // No cashback for store credit top-ups
      },
      include: {
        customer: true,
        store: true,
      }
    });

    return {
      purchaseTransaction,
      paymentLink,
      customer: card.customer,
    };
  });

  const paymentUrl = `${process.env.APP_BASE_URL || 'http://localhost:5173'}/payment/${result.paymentLink.token}`;

  res.json({
    message: 'Store credit payment link created',
    transaction: result.purchaseTransaction,
    paymentUrl,
    paymentLink: {
      id: result.paymentLink.id,
      token: result.paymentLink.token,
      expiresAt: result.paymentLink.expiresAt,
    }
  });
}));

export default router;