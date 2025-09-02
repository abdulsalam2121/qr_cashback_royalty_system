import express from 'express';
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
// Get all customers
router.get('/', auth, rbac(['tenant_admin']), asyncHandler(async (req, res) => {
    const { tenantId } = req.user;
    const { search, page = 1, limit = 50 } = req.query;
    const where = { tenantId };
    if (search) {
        where.OR = [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
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
// Get customer by ID
router.get('/:id', auth, rbac(['tenant_admin']), asyncHandler(async (req, res) => {
    const { id } = req.params;
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
router.post('/', auth, rbac(['tenant_admin']), validate(createCustomerSchema), asyncHandler(async (req, res) => {
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
router.put('/:id', auth, rbac(['tenant_admin']), validate(updateCustomerSchema), asyncHandler(async (req, res) => {
    const { id } = req.params;
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
router.delete('/:id', auth, rbac(['tenant_admin']), asyncHandler(async (req, res) => {
    const { id } = req.params;
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
router.get('/:id/transactions', auth, rbac(['tenant_admin']), asyncHandler(async (req, res) => {
    const { id } = req.params;
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
//# sourceMappingURL=customers.js.map