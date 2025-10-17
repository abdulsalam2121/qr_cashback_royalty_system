import express, { Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { auth } from '../middleware/auth.js';
import { rbac } from '../middleware/rbac.js';

const router = express.Router();
const prisma = new PrismaClient();

const createCustomerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

const updateCustomerSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

// Get customer's own profile (for customer role)
router.get('/me', auth, rbac(['customer']), asyncHandler(async (req: Request, res: Response) => {
  const { userId, tenantId } = req.user;

  // For customers, find their customer record by linking through user email
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const customer = await prisma.customer.findFirst({
    where: { 
      tenantId,
      email: user.email 
    },
    include: {
      cards: {
        include: {
          store: true
        }
      }
    }
  });

  if (!customer) {
    res.status(404).json({ error: 'Customer profile not found' });
    return;
  }

  res.json({ customer });
  return;
}));

// Get customer's own cards (for customer role)
router.get('/me/cards', auth, rbac(['customer']), asyncHandler(async (req: Request, res: Response) => {
  const { userId, tenantId } = req.user;

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const customer = await prisma.customer.findFirst({
    where: { 
      tenantId,
      email: user.email 
    }
  });

  if (!customer) {
    res.status(404).json({ error: 'Customer profile not found' });
    return;
  }

  const cards = await prisma.card.findMany({
    where: { customerId: customer.id },
    include: {
      store: true
    }
  });

  res.json({ cards });
  return;
}));

// Get customer's own transactions (for customer role)
router.get('/me/transactions', auth, rbac(['customer']), asyncHandler(async (req: Request, res: Response) => {
  const { userId, tenantId } = req.user;

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const customer = await prisma.customer.findFirst({
    where: { 
      tenantId,
      email: user.email 
    }
  });

  if (!customer) {
    res.status(404).json({ error: 'Customer profile not found' });
    return;
  }

  const transactions = await prisma.transaction.findMany({
    where: { customerId: customer.id },
    include: {
      store: true,
      card: true
    },
    orderBy: { createdAt: 'desc' }
  });

  res.json({ transactions });
  return;
}));

// Get all customers
router.get('/', auth, rbac(['tenant_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = req.user;
  const { search, page = 1, limit = 50 } = req.query;

  const where: any = { tenantId };

  if (search) {
    where.OR = [
      { firstName: { contains: search as string, mode: 'insensitive' } },
      { lastName: { contains: search as string, mode: 'insensitive' } },
      { email: { contains: search as string, mode: 'insensitive' } },
      { phone: { contains: search as string } },
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        cards: {
          select: { id: true, cardUid: true, status: true, balanceCents: true }
        },
        _count: {
          select: { transactions: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
    }),
    prisma.customer.count({ where }),
  ]);

  res.json({
    customers,
    total,
    page: Number(page),
    limit: Number(limit),
    pages: Math.ceil(total / Number(limit)),
  });
}));

// Get available customers (those without active cards or with blocked cards only)
router.get('/available', auth, asyncHandler(async (req: Request, res: Response) => {
  const { tenantId } = req.user;
  const { search } = req.query;

  const where: any = { tenantId };

  if (search) {
    where.OR = [
      { firstName: { contains: search as string, mode: 'insensitive' } },
      { lastName: { contains: search as string, mode: 'insensitive' } },
      { email: { contains: search as string, mode: 'insensitive' } },
      { phone: { contains: search as string } },
    ];
  }

  // Get all customers with their cards
  const customers = await prisma.customer.findMany({
    where,
    include: {
      cards: {
        select: { id: true, cardUid: true, status: true }
      }
    },
    orderBy: [
      { firstName: 'asc' },
      { lastName: 'asc' }
    ]
  });

  // Filter customers who have NO cards at all (completely new customers only)
  const availableCustomers = customers.filter(customer => {
    if (process.env.NODE_ENV !== 'production') {
    }
    
    // Only available if customer has absolutely no cards
    if (customer.cards.length === 0) {
      if (process.env.NODE_ENV !== 'production') {
      }
      return true;
    } else {
      return false;
    }

  res.json({
    customers: availableCustomers.map(customer => ({
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      cardCount: customer.cards.length,
      hasActiveCard: customer.cards.some(card => card.status === 'ACTIVE'),
      hasBlockedCards: customer.cards.some(card => card.status === 'BLOCKED')
    }))
  });
}));

// Get customer by ID
router.get('/:id', auth, rbac(['tenant_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { tenantId } = req.user;

  const customer = await prisma.customer.findFirst({
    where: { id, tenantId },
    include: {
      cards: {
        include: { store: true }
      },
      transactions: {
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          store: true,
          cashier: {
            select: { firstName: true, lastName: true }
          }
        }
      }
    },
  });

  if (!customer) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }

  res.json(customer);
  return;
}));

// Create customer
router.post('/', auth, rbac(['tenant_admin']), validate(createCustomerSchema), asyncHandler(async (req: Request, res: Response) => {
  const { firstName, lastName, email, phone } = req.body;
  const { tenantId } = req.user;

  // Check if customer with email already exists
  if (email) {
    const existingCustomer = await prisma.customer.findUnique({
      where: { email }
    });

    if (existingCustomer) {
      res.status(400).json({ error: 'Customer with this email already exists' });
      return;
    }
  }

  const customer = await prisma.customer.create({
    data: {
      tenantId,
      firstName,
      lastName,
      email,
      phone,
      tier: 'SILVER',
      totalSpend: 0,
    },
    include: {
      cards: true
    }
  });

  res.status(201).json({ customer });
  return;
}));

// Update customer
router.put('/:id', auth, rbac(['tenant_admin']), validate(updateCustomerSchema), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { tenantId } = req.user;
  const updateData = req.body;

  // Check if customer exists
  const existingCustomer = await prisma.customer.findFirst({
    where: { id, tenantId }
  });

  if (!existingCustomer) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }

  // Check if email is being changed and if it conflicts
  if (updateData.email && updateData.email !== existingCustomer.email) {
    const emailConflict = await prisma.customer.findUnique({
      where: { email: updateData.email }
    });

    if (emailConflict) {
      res.status(400).json({ error: 'Customer with this email already exists' });
      return;
    }
  }

  const customer = await prisma.customer.update({
    where: { id },
    data: updateData,
    include: {
      cards: true
    }
  });

  res.json({ customer });
  return;
}));

// Delete customer
router.delete('/:id', auth, rbac(['tenant_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { tenantId } = req.user;

  // Check if customer exists and belongs to tenant
  const existingCustomer = await prisma.customer.findFirst({
    where: { id, tenantId },
    include: {
      cards: true,
      transactions: true
    }
  });

  if (!existingCustomer) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }

  // Check if customer has active cards or transactions
  if (existingCustomer.cards.length > 0) {
    res.status(400).json({ 
      error: 'Cannot delete customer with active cards. Please deactivate or reassign cards first.',
      details: `Customer has ${existingCustomer.cards.length} active card(s)`
    });
    return;
  }

  if (existingCustomer.transactions.length > 0) {
    res.status(400).json({ 
      error: 'Cannot delete customer with transaction history. This action cannot be undone.',
      details: `Customer has ${existingCustomer.transactions.length} transaction(s)`
    });
    return;
  }

  // Delete customer
  await prisma.customer.delete({
    where: { id }
  });

  res.json({ 
    message: 'Customer deleted successfully',
    deletedCustomer: {
      id: existingCustomer.id,
      name: `${existingCustomer.firstName} ${existingCustomer.lastName}`
    }
  });
  return;
}));

// Get customer transactions
router.get('/:id/transactions', auth, rbac(['tenant_admin']), asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { tenantId } = req.user;
  const { page = 1, limit = 50 } = req.query;

  // Verify customer exists and belongs to tenant
  const customer = await prisma.customer.findFirst({
    where: { id, tenantId }
  });

  if (!customer) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where: { customerId: id },
      include: {
        store: true,
        card: {
          select: { cardUid: true }
        },
        cashier: {
          select: { firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
    }),
    prisma.transaction.count({ where: { customerId: id } }),
  ]);

  res.json({
    transactions,
    total,
    page: Number(page),
    limit: Number(limit),
    pages: Math.ceil(total / Number(limit)),
  });
  return;
}));

export default router;

