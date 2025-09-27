import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();
const prisma = new PrismaClient();

// GET /api/cards/:cardUid - Public route to get card details for redemption
router.get('/:cardUid', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { cardUid } = req.params;

  if (!cardUid) {
    res.status(400).json({
      error: 'Card UID required',
      message: 'Card UID parameter is required.'
    });
    return;
  }

  const card = await prisma.card.findUnique({
    where: { cardUid },
    include: {
      customer: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          tier: true,
        }
      },
      store: {
        select: {
          id: true,
          name: true,
          address: true,
        }
      },
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
        }
      }
    }
  });

  if (!card) {
    res.status(404).json({
      error: 'Card not found',
      message: 'The requested card could not be found.'
    });
    return;
  }

  // Return card data with necessary information for redemption
  res.json({
    cardUid: card.cardUid,
    balanceCents: card.balanceCents,
    tier: card.customer?.tier || 'BRONZE',
    customer: card.customer,
    store: card.store,
    tenantSlug: card.tenant.slug,
    storeId: card.storeId,
  });
}));

export default router;