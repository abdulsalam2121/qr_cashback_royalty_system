import express from 'express';
import Stripe from 'stripe';
import { PrismaClient, PaymentMethod, PaymentStatus, TxCategory } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

// IMPORTANT: mount this route BEFORE any global express.json() middleware
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'] as string | undefined;
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret) {
      console.error('? STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }
    if (!sig) {
      console.error('? Missing stripe-signature header');
      return res.status(400).json({ error: 'Missing Stripe signature' });
    }

    let event: Stripe.Event;

    try {
      // req.body is a Buffer because of express.raw
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err: any) {
      console.error('? Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Process safely; never let one failing branch 500 the whole webhook
    try {
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          console.log(`? payment_intent.succeeded: ${paymentIntent.id}`);

          try {
            const md = paymentIntent.metadata ?? {};
            if (md.tenantId && md.storeId && md.cashierId) {
              await prisma.purchaseTransaction.create({
                data: {
                  tenantId: md.tenantId,
                  storeId: md.storeId,
                  cashierId: md.cashierId,
                  amountCents: paymentIntent.amount,
                  category: TxCategory.PURCHASE,
                  description: paymentIntent.description || 'Payment',
                  paymentMethod: PaymentMethod.CARD,
                  paymentStatus: PaymentStatus.COMPLETED,
                  customerId: md.customerId || null,
                  paidAt: new Date(),
                },
              });
            } else {
              console.log('?? Missing required metadata; skipping transaction creation');
            }
          } catch (e) {
            console.error('?? DB error (payment_intent.succeeded):', e);
          }
          break;
        }

        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          console.log(`? payment_intent.payment_failed: ${paymentIntent.id}`);

          try {
            const md = paymentIntent.metadata ?? {};
            if (md.tenantId && md.storeId && md.cashierId) {
              await prisma.purchaseTransaction.create({
                data: {
                  tenantId: md.tenantId,
                  storeId: md.storeId,
                  cashierId: md.cashierId,
                  amountCents: paymentIntent.amount,
                  category: TxCategory.PURCHASE,
                  description: paymentIntent.description || 'Payment failed',
                  paymentMethod: PaymentMethod.CARD,
                  paymentStatus: PaymentStatus.FAILED,
                  customerId: md.customerId || null,
                },
              });
            } else {
              console.log('?? Missing required metadata; skipping failed-transaction creation');
            }
          } catch (e) {
            console.error('?? DB error (payment_intent.payment_failed):', e);
          }
          break;
        }

        case 'charge.refunded': {
          const charge = event.data.object as Stripe.Charge;
          console.log(`?? charge.refunded: ${charge.id}`);

          try {
            const md = charge.metadata ?? {};
            if (md.tenantId && md.storeId && md.cashierId) {
              await prisma.purchaseTransaction.create({
                data: {
                  tenantId: md.tenantId,
                  storeId: md.storeId,
                  cashierId: md.cashierId,
                  amountCents: charge.amount, // consider negating if your ledger expects negatives
                  category: TxCategory.PURCHASE,
                  description: 'Refund issued',
                  paymentMethod: PaymentMethod.CARD,
                  paymentStatus: PaymentStatus.CANCELLED, // verify your Prisma enum spelling
                  customerId: md.customerId || null,
                },
              });
            } else {
              console.log('?? Missing required metadata; skipping refund transaction creation');
            }
          } catch (e) {
            console.error('?? DB error (charge.refunded):', e);
          }
          break;
        }

        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          console.log(`?? checkout.session.completed: ${session.id}`);
          // Optional: mark order/checkout as complete
          break;
        }

        case 'customer.subscription.created': {
          const subscription = event.data.object as Stripe.Subscription;
          console.log(`?? customer.subscription.created: ${subscription.id}`);
          // TODO: upsert subscription in your DB
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
          console.log(`?? customer.subscription.updated: ${subscription.id}`);
          try {
            // TODO: update subscription details in your DB
          } catch (e) {
            console.error('?? DB error (subscription.updated):', e);
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          console.log(`? customer.subscription.deleted: ${subscription.id}`);
          try {
            // TODO: mark subscription canceled in your DB
          } catch (e) {
            console.error('?? DB error (subscription.deleted):', e);
          }
          break;
        }

        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as Stripe.Invoice;
          console.log(`?? invoice.payment_succeeded: ${invoice.id}`);

          try {
            const md = invoice.metadata ?? {};
            if (md.tenantId && md.storeId && md.cashierId) {
              await prisma.purchaseTransaction.create({
                data: {
                  tenantId: md.tenantId,
                  storeId: md.storeId,
                  cashierId: md.cashierId,
                  amountCents: invoice.amount_paid || 0,
                  category: TxCategory.OTHER,
                  description: `Invoice payment: ${invoice.id}`,
                  paymentMethod: PaymentMethod.CARD,
                  paymentStatus: PaymentStatus.COMPLETED,
                  customerId: md.customerId || null,
                  paidAt: new Date(),
                },
              });
            } else {
              console.log('?? No metadata on invoice; skipping transaction creation');
            }
          } catch (e) {
            console.error('?? DB error (invoice.payment_succeeded):', e);
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          console.log(`?? invoice.payment_failed: ${invoice.id}`);
          try {
            // TODO: flag unpaid invoice / notify user / dunning flow
          } catch (e) {
            console.error('?? DB error (invoice.payment_failed):', e);
          }
          break;
        }

        default: {
          console.log(`?? Unhandled event type: ${event.type}`);
          break;
        }
      }

      // Always 200 once received & processed (Stripe expects this)
      return res.status(200).json({ received: true });
    } catch (err) {
      // Catch-all (shouldn’t hit because of per-case try/catch)
      console.error('?? Unexpected webhook processing error:', err);
      return res.status(200).json({ received: true }); // still 200 to avoid Stripe retries storm
    }
  }
);

export default router;
