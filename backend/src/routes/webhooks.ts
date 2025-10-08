import express from 'express';
import Stripe from 'stripe';
import { PrismaClient, PaymentMethod, PaymentStatus, TxCategory } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

// Webhook endpoint
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'] as string;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err: any) {
      console.error('❌ Webhook signature verification failed.', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          console.log(`✅ PaymentIntent succeeded: ${paymentIntent.id}`);

          await prisma.purchaseTransaction.create({
            data: {
              amountCents: paymentIntent.amount,
              category: TxCategory.PURCHASE,
              description: paymentIntent.description || 'Payment',
              paymentMethod: PaymentMethod.CARD,
              status: PaymentStatus.COMPLETED, // ✅ fixed
              customerId: paymentIntent.metadata?.customerId || null,
            },
          });

          break;
        }

        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          console.log(`❌ PaymentIntent failed: ${paymentIntent.id}`);

          await prisma.purchaseTransaction.create({
            data: {
              amountCents: paymentIntent.amount,
              category: TxCategory.PURCHASE,
              description: paymentIntent.description || 'Payment failed',
              paymentMethod: PaymentMethod.CARD,
              status: PaymentStatus.FAILED, // ✅ fixed
              customerId: paymentIntent.metadata?.customerId || null,
            },
          });

          break;
        }

        case 'charge.refunded': {
          const charge = event.data.object as Stripe.Charge;
          console.log(`💸 Charge refunded: ${charge.id}`);

          await prisma.purchaseTransaction.create({
            data: {
              amountCents: charge.amount,
              category: TxCategory.PURCHASE,
              description: 'Refund issued',
              paymentMethod: PaymentMethod.CARD,
              status: PaymentStatus.CANCELLED, // ✅ best match for refund
              customerId: charge.metadata?.customerId || null,
            },
          });

          break;
        }

        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          console.log(`🎉 Checkout session completed: ${session.id}`);
          // Optional: record as COMPLETED
          break;
        }

        default:
          console.log(`⚠️ Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (dbError) {
      console.error('❌ Failed to save/update payment:', dbError);
      res.status(500).json({ error: 'Failed to save transaction' });
    }
  }
);

export default router;
