import express, { Request, Response } from 'express';
import { z } from 'zod';
import { PrismaClient, RepairStatus, NotificationType } from '@prisma/client';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { auth } from '../middleware/auth.js';
import { rbac } from '../middleware/rbac.js';
import { sendRepairNotification } from '../services/repairNotificationService.js';

const router = express.Router();
const prisma = new PrismaClient();

// Validation Schemas
const createRepairSchema = z.object({
  customerId: z.string().optional(),
  customerData: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().optional(),
    email: z.string().email().optional(),
  }).optional(),
  phoneModel: z.string().min(1),
  imei: z.string().optional(),
  issueDetails: z.string().min(1),
  accessories: z.array(z.string()).optional(),
  estimatedCost: z.number().optional(),
  sendNotification: z.boolean().default(true),
});

const updateRepairSchema = z.object({
  phoneModel: z.string().optional(),
  imei: z.string().optional(),
  issueDetails: z.string().optional(),
  accessories: z.array(z.string()).optional(),
  estimatedCost: z.number().optional(),
  actualCost: z.number().optional(),
  technicianNotes: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['DROPPED_OFF', 'IN_PROGRESS', 'READY_FOR_PICKUP', 'PICKED_UP', 'CANCELLED']),
  notes: z.string().optional(),
  sendNotification: z.boolean().default(true),
});

const sendCustomNotificationSchema = z.object({
  subject: z.string().optional(),
  message: z.string().min(1),
  sendVia: z.array(z.enum(['SMS', 'EMAIL'])).min(1),
});

// ==================== CREATE REPAIR ====================
router.post(
  '/',
  auth,
  rbac(['admin', 'manager', 'cashier']),
  validate(createRepairSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId, userId } = req.user;
    const data = req.body;

    let customerId = data.customerId;

    // If customer data is provided but no customerId, create new customer
    if (!customerId && data.customerData) {
      const customer = await prisma.customer.create({
        data: {
          tenantId,
          firstName: data.customerData.firstName,
          lastName: data.customerData.lastName,
          phone: data.customerData.phone,
          email: data.customerData.email,
        },
      });
      customerId = customer.id;
    }

    // Verify customer exists and belongs to tenant
    if (customerId) {
      const customer = await prisma.customer.findFirst({
        where: {
          id: customerId,
          tenantId,
        },
      });

      if (!customer) {
        res.status(404).json({ error: 'Customer not found' });
        return;
      }
    }

    // Create repair device
    const repair = await prisma.repairDevice.create({
      data: {
        tenantId,
        customerId,
        phoneModel: data.phoneModel,
        imei: data.imei,
        issueDetails: data.issueDetails,
        accessories: data.accessories ? JSON.stringify(data.accessories) : null,
        estimatedCost: data.estimatedCost ? Math.round(data.estimatedCost * 100) : null, // Convert to cents
        status: RepairStatus.DROPPED_OFF,
      },
      include: {
        customer: true,
      },
    });

    // Create status history
    await prisma.repairStatusHistory.create({
      data: {
        repairId: repair.id,
        newStatus: RepairStatus.DROPPED_OFF,
        changedBy: userId,
        notes: 'Repair device dropped off',
      },
    });

    // Send notification if requested
    if (data.sendNotification && repair.customer) {
      try {
        await sendRepairNotification(repair, RepairStatus.DROPPED_OFF, NotificationType.STATUS_CHANGE);
      } catch (error) {
        console.error('Failed to send repair notification:', error);
        // Don't fail the request if notification fails
      }
    }

    res.status(201).json({ repair });
  })
);

// ==================== GET ALL REPAIRS ====================
router.get(
  '/',
  auth,
  rbac(['admin', 'manager', 'cashier']),
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId } = req.user;
    const {
      status,
      search,
      page = '1',
      limit = '20',
      sortBy = 'droppedOffAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = { tenantId };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { phoneModel: { contains: search as string, mode: 'insensitive' } },
        { imei: { contains: search as string, mode: 'insensitive' } },
        { issueDetails: { contains: search as string, mode: 'insensitive' } },
        {
          customer: {
            OR: [
              { firstName: { contains: search as string, mode: 'insensitive' } },
              { lastName: { contains: search as string, mode: 'insensitive' } },
              { phone: { contains: search as string, mode: 'insensitive' } },
              { email: { contains: search as string, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    // Get repairs with customer data
    const [repairs, total] = await Promise.all([
      prisma.repairDevice.findMany({
        where,
        include: {
          customer: true,
          statusHistory: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
          notifications: {
            orderBy: { sentAt: 'desc' },
            take: 3,
          },
        },
        orderBy: {
          [sortBy as string]: sortOrder,
        },
        skip,
        take: limitNum,
      }),
      prisma.repairDevice.count({ where }),
    ]);

    // Parse accessories JSON
    const repairsWithParsedData = repairs.map((repair) => ({
      ...repair,
      accessories: repair.accessories ? JSON.parse(repair.accessories) : null,
      estimatedCost: repair.estimatedCost ? repair.estimatedCost / 100 : null,
      actualCost: repair.actualCost ? repair.actualCost / 100 : null,
    }));

    res.json({
      repairs: repairsWithParsedData,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  })
);

// ==================== GET SINGLE REPAIR ====================
router.get(
  '/:id',
  auth,
  rbac(['admin', 'manager', 'cashier']),
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId } = req.user;
    const { id } = req.params;

    const repair = await prisma.repairDevice.findFirst({
      where: {
        id: id!,
        tenantId,
      },
      include: {
        customer: true,
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
        notifications: {
          orderBy: { sentAt: 'desc' },
        },
      },
    });

    if (!repair) {
      res.status(404).json({ error: 'Repair not found' });
      return;
    }

    // Parse accessories JSON
    const repairWithParsedData = {
      ...repair,
      accessories: repair.accessories ? JSON.parse(repair.accessories) : null,
      estimatedCost: repair.estimatedCost ? repair.estimatedCost / 100 : null,
      actualCost: repair.actualCost ? repair.actualCost / 100 : null,
    };

    res.json({ repair: repairWithParsedData });
  })
);

// ==================== UPDATE REPAIR ====================
router.patch(
  '/:id',
  auth,
  rbac(['admin', 'manager', 'cashier']),
  validate(updateRepairSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId } = req.user;
    const { id } = req.params;
    const data = req.body;

    // Verify repair exists and belongs to tenant
    const existingRepair = await prisma.repairDevice.findFirst({
      where: {
        id: id!,
        tenantId,
      },
    });

    if (!existingRepair) {
      res.status(404).json({ error: 'Repair not found' });
      return;
    }

    // Prepare update data
    const updateData: any = {};
    if (data.phoneModel !== undefined) updateData.phoneModel = data.phoneModel;
    if (data.imei !== undefined) updateData.imei = data.imei;
    if (data.issueDetails !== undefined) updateData.issueDetails = data.issueDetails;
    if (data.accessories !== undefined) updateData.accessories = JSON.stringify(data.accessories);
    if (data.estimatedCost !== undefined) updateData.estimatedCost = Math.round(data.estimatedCost * 100);
    if (data.actualCost !== undefined) updateData.actualCost = Math.round(data.actualCost * 100);
    if (data.technicianNotes !== undefined) updateData.technicianNotes = data.technicianNotes;

    // Update repair
    const repair = await prisma.repairDevice.update({
      where: { id: id! },
      data: updateData,
      include: {
        customer: true,
      },
    });

    res.json({ repair });
  })
);

// ==================== UPDATE REPAIR STATUS ====================
router.patch(
  '/:id/status',
  auth,
  rbac(['admin', 'manager', 'cashier']),
  validate(updateStatusSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId, userId } = req.user;
    const { id } = req.params;
    const { status, notes, sendNotification } = req.body;

    // Verify repair exists and belongs to tenant
    const existingRepair = await prisma.repairDevice.findFirst({
      where: {
        id: id!,
        tenantId,
      },
      include: {
        customer: true,
      },
    });

    if (!existingRepair) {
      res.status(404).json({ error: 'Repair not found' });
      return;
    }

    // Prepare update data
    const updateData: any = {
      status,
    };

    // Set timestamps based on status
    if (status === RepairStatus.IN_PROGRESS && !existingRepair.startedAt) {
      updateData.startedAt = new Date();
    }
    if (status === RepairStatus.READY_FOR_PICKUP && !existingRepair.completedAt) {
      updateData.completedAt = new Date();
    }
    if (status === RepairStatus.PICKED_UP && !existingRepair.pickedUpAt) {
      updateData.pickedUpAt = new Date();
    }

    // Update repair status
    const repair = await prisma.repairDevice.update({
      where: { id: id! },
      data: updateData,
      include: {
        customer: true,
      },
    });

    // Create status history
    await prisma.repairStatusHistory.create({
      data: {
        repairId: repair.id,
        oldStatus: existingRepair.status,
        newStatus: status as RepairStatus,
        changedBy: userId,
        notes,
      },
    });

    // Send notification if requested
    if (sendNotification && repair.customer) {
      try {
        await sendRepairNotification(repair, status as RepairStatus, NotificationType.STATUS_CHANGE);
      } catch (error) {
        console.error('Failed to send repair notification:', error);
        // Don't fail the request if notification fails
      }
    }

    res.json({ repair });
  })
);

// ==================== SEND CUSTOM NOTIFICATION ====================
router.post(
  '/:id/notify',
  auth,
  rbac(['admin', 'manager', 'cashier']),
  validate(sendCustomNotificationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId } = req.user;
    const { id } = req.params;
    const { subject, message, sendVia } = req.body;

    // Verify repair exists and belongs to tenant
    const repair = await prisma.repairDevice.findFirst({
      where: {
        id: id!,
        tenantId,
      },
      include: {
        customer: true,
      },
    });

    if (!repair) {
      res.status(404).json({ error: 'Repair not found' });
      return;
    }

    if (!repair.customer) {
      res.status(400).json({ error: 'No customer associated with this repair' });
      return;
    }

    // Send custom notification
    try {
      await sendRepairNotification(
        repair,
        repair.status,
        NotificationType.CUSTOM,
        message,
        subject,
        sendVia
      );
      res.json({ success: true, message: 'Notification sent successfully' });
    } catch (error) {
      console.error('Failed to send custom notification:', error);
      res.status(500).json({ error: 'Failed to send notification' });
    }
  })
);

// ==================== DELETE REPAIR ====================
router.delete(
  '/:id',
  auth,
  rbac(['admin', 'manager']),
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId } = req.user;
    const { id } = req.params;

    // Verify repair exists and belongs to tenant
    const repair = await prisma.repairDevice.findFirst({
      where: {
        id: id!,
        tenantId,
      },
    });

    if (!repair) {
      res.status(404).json({ error: 'Repair not found' });
      return;
    }

    // Delete repair (cascades to status history and notifications)
    await prisma.repairDevice.delete({
      where: { id: id! },
    });

    res.json({ success: true, message: 'Repair deleted successfully' });
  })
);

// ==================== GET REPAIR STATISTICS ====================
router.get(
  '/stats/overview',
  auth,
  rbac(['admin', 'manager']),
  asyncHandler(async (req: Request, res: Response) => {
    const { tenantId } = req.user;
    const { startDate, endDate } = req.query;

    const where: any = { tenantId };

    if (startDate || endDate) {
      where.droppedOffAt = {};
      if (startDate) where.droppedOffAt.gte = new Date(startDate as string);
      if (endDate) where.droppedOffAt.lte = new Date(endDate as string);
    }

    const [
      totalRepairs,
      droppedOff,
      inProgress,
      readyForPickup,
      pickedUp,
      cancelled,
      revenueData,
    ] = await Promise.all([
      prisma.repairDevice.count({ where }),
      prisma.repairDevice.count({ where: { ...where, status: RepairStatus.DROPPED_OFF } }),
      prisma.repairDevice.count({ where: { ...where, status: RepairStatus.IN_PROGRESS } }),
      prisma.repairDevice.count({ where: { ...where, status: RepairStatus.READY_FOR_PICKUP } }),
      prisma.repairDevice.count({ where: { ...where, status: RepairStatus.PICKED_UP } }),
      prisma.repairDevice.count({ where: { ...where, status: RepairStatus.CANCELLED } }),
      prisma.repairDevice.aggregate({
        where: {
          ...where,
          status: RepairStatus.PICKED_UP,
          actualCost: { not: null },
        },
        _sum: {
          actualCost: true,
        },
      }),
    ]);

    const stats = {
      total: totalRepairs,
      byStatus: {
        droppedOff,
        inProgress,
        readyForPickup,
        pickedUp,
        cancelled,
      },
      revenue: revenueData._sum.actualCost ? revenueData._sum.actualCost / 100 : 0,
    };

    res.json({ stats });
  })
);

export default router;
