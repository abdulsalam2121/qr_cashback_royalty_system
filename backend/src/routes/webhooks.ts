import express from 'express';
import Stripe from 'stripe';
import { PrismaClient, PaymentMethod, PaymentStatus, TxCategory } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { updateCustomerTier } from '../utils/tiers.js';

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
      console.error('❌ STRIPE_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }
    if (!sig) {
      console.error('❌ Missing stripe-signature header');
      return res.status(400).json({ error: 'Missing Stripe signature' });
    }

    let event: Stripe.Event;

    try {
      // req.body is a Buffer because of express.raw
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err: any) {
      console.error('⚠️ Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
      switch (event.type) {
        // ✅ Payment Succeeded
        case 'payment_intent.succeeded': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          console.log(`✅ payment_intent.succeeded: ${paymentIntent.id}`);

          try {
            const md = paymentIntent.metadata ?? {};
            
            // Handle QR code payments (paymentLinkId metadata)
            if (md.paymentLinkId) {
              await handleQRPaymentSuccess(paymentIntent, md.paymentLinkId);
            }
            // Handle POS payments (tenantId, storeId, cashierId metadata)  
            else if (md.tenantId && md.storeId && md.cashierId) {
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
              console.log(`✅ Created POS transaction for payment ${paymentIntent.id}`);
            } 
            // Handle card order payments (orderId metadata)
            else if (md.orderId) {
              await handleCardOrderPayment(paymentIntent, md.orderId);
            }
            else {
              console.log('⚠️ Unknown payment type or missing metadata; skipping transaction creation');
            }
          } catch (e) {
            console.error('💥 DB error (payment_intent.succeeded):', e);
          }
          break;
        }

        // ❌ Payment Failed
        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          console.log(`❌ payment_intent.payment_failed: ${paymentIntent.id}`);

          try {
            const md = paymentIntent.metadata ?? {};
            
            // Handle QR code payment failures
            if (md.paymentLinkId) {
              await handleQRPaymentFailure(paymentIntent, md.paymentLinkId);
            }
            // Handle POS payment failures
            else if (md.tenantId && md.storeId && md.cashierId) {
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
              console.log(`⚠️ Created failed POS transaction for payment ${paymentIntent.id}`);
            } else {
              console.log('⚠️ Unknown payment type or missing metadata; skipping failed transaction creation');
            }
          } catch (e) {
            console.error('💥 DB error (payment_intent.payment_failed):', e);
          }
          break;
        }

        // 💸 Refund
        case 'charge.refunded': {
          const charge = event.data.object as Stripe.Charge;
          console.log(`💸 charge.refunded: ${charge.id}`);

          try {
            const md = charge.metadata ?? {};
            if (md.tenantId && md.storeId && md.cashierId) {
              await prisma.purchaseTransaction.create({
                data: {
                  tenantId: md.tenantId,
                  storeId: md.storeId,
                  cashierId: md.cashierId,
                  amountCents: charge.amount,
                  category: TxCategory.PURCHASE,
                  description: 'Refund issued',
                  paymentMethod: PaymentMethod.CARD,
                  paymentStatus: PaymentStatus.CANCELLED,
                  customerId: md.customerId || null,
                },
              });
            } else {
              console.log('⚠️ Missing required metadata; skipping refund transaction creation');
            }
          } catch (e) {
            console.error('💥 DB error (charge.refunded):', e);
          }
          break;
        }

        // 🧾 Checkout
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          console.log(`🧾 checkout.session.completed: ${session.id}`);
          break;
        }

        // 🆕 Subscription Created
        case 'customer.subscription.created': {
          const subscription = event.data.object as Stripe.Subscription;
          console.log(`🆕 customer.subscription.created: ${subscription.id}`);
          try {
            // Find tenant by customer ID or metadata
            let tenant = null;
            
            if (subscription.metadata?.tenantId) {
              tenant = await prisma.tenant.findUnique({
                where: { id: subscription.metadata.tenantId }
              });
            } else if (subscription.customer) {
              const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
              tenant = await prisma.tenant.findFirst({
                where: { stripeCustomerId: customerId }
              });
            }

            if (tenant) {
              // Find plan by Stripe price ID
              let plan = null;
              // Handle potential undefined safely
              if (subscription.items.data.length > 0 && subscription.items.data[0]?.price?.id) {
                const priceId = subscription.items.data[0].price.id;
                plan = await prisma.plan.findFirst({ where: { stripePriceId: priceId } });
              }

              // Update tenant with subscription details
              await prisma.tenant.update({
                where: { id: tenant.id },
                data: {
                  stripeSubscriptionId: subscription.id,
                  subscriptionStatus: subscription.status === 'active' ? 'ACTIVE' : 
                                    subscription.status === 'trialing' ? 'TRIALING' : 'CANCELED',
                  planId: plan?.id || tenant.planId,
                  subscriptionStartDate: new Date(subscription.start_date * 1000),
                  trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
                }
              });

              // Create subscription event
              if (plan) {
                await prisma.subscriptionEvent.create({
                  data: {
                    tenantId: tenant.id,
                    planId: plan.id,
                    eventType: 'created',
                    stripeSubscriptionId: subscription.id,
                    metadata: JSON.stringify({ 
                      status: subscription.status,
                      trial_end: subscription.trial_end,
                      current_period_end: subscription.current_period_end 
                    })
                  }
                });
              }

              console.log(`✅ Created subscription for tenant ${tenant.id}`);
            } else {
              console.log(`⚠️ No tenant found for subscription ${subscription.id}`);
            }
          } catch (e) {
            console.error('💥 DB error (subscription.created):', e);
          }
          break;
        }

        // 🔁 Subscription Updated
        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
          console.log(`🔁 customer.subscription.updated: ${subscription.id}`);
          try {
            // Find tenant by Stripe subscription ID
            const tenant = await prisma.tenant.findFirst({
              where: { stripeSubscriptionId: subscription.id }
            });

            if (tenant) {
              // Get plan from subscription metadata or price ID
              const planId = subscription.metadata?.planId;
              let plan = null;
              
              if (planId) {
                plan = await prisma.plan.findUnique({ where: { id: planId } });
              } else if (subscription.items.data.length > 0 && subscription.items.data[0]?.price?.id) {
                // Find plan by Stripe price ID
                const priceId = subscription.items.data[0].price.id;
                plan = await prisma.plan.findFirst({ where: { stripePriceId: priceId } });
              }

              // Update tenant subscription details
              await prisma.tenant.update({
                where: { id: tenant.id },
                data: {
                  subscriptionStatus: subscription.status === 'active' ? 'ACTIVE' : 
                                    subscription.status === 'canceled' ? 'CANCELED' :
                                    subscription.status === 'past_due' ? 'PAST_DUE' :
                                    subscription.status === 'trialing' ? 'TRIALING' : 'CANCELED',
                  planId: plan?.id || tenant.planId,
                  subscriptionStartDate: subscription.start_date ? new Date(subscription.start_date * 1000) : tenant.subscriptionStartDate,
                  trialEndsAt: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
                }
              });

              // Create subscription event
              if (plan) {
                await prisma.subscriptionEvent.create({
                  data: {
                    tenantId: tenant.id,
                    planId: plan.id,
                    eventType: 'updated',
                    stripeSubscriptionId: subscription.id,
                    metadata: JSON.stringify({ 
                      status: subscription.status,
                      trial_end: subscription.trial_end,
                      current_period_end: subscription.current_period_end 
                    })
                  }
                });
              }

              console.log(`✅ Updated subscription for tenant ${tenant.id}`);
            } else {
              console.log(`⚠️ No tenant found for subscription ${subscription.id}`);
            }
          } catch (e) {
            console.error('💥 DB error (subscription.updated):', e);
          }
          break;
        }

        // ❌ Subscription Deleted
        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
          console.log(`❌ customer.subscription.deleted: ${subscription.id}`);
          try {
            // Find tenant by Stripe subscription ID
            const tenant = await prisma.tenant.findFirst({
              where: { stripeSubscriptionId: subscription.id }
            });

            if (tenant) {
              // Update tenant to mark subscription as cancelled
              await prisma.tenant.update({
                where: { id: tenant.id },
                data: {
                  subscriptionStatus: 'CANCELED',
                  // Keep planId for record keeping, but mark as cancelled
                }
              });

              // Create subscription event
              if (tenant.planId) {
                await prisma.subscriptionEvent.create({
                  data: {
                    tenantId: tenant.id,
                    planId: tenant.planId,
                    eventType: 'cancelled',
                    stripeSubscriptionId: subscription.id,
                    metadata: JSON.stringify({ 
                      status: 'canceled',
                      canceled_at: subscription.canceled_at,
                      cancellation_details: subscription.cancellation_details 
                    })
                  }
                });
              }

              console.log(`✅ Cancelled subscription for tenant ${tenant.id}`);
            } else {
              console.log(`⚠️ No tenant found for subscription ${subscription.id}`);
            }
          } catch (e) {
            console.error('💥 DB error (subscription.deleted):', e);
          }
          break;
        }

        // 💰 Invoice Payment Succeeded
        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as Stripe.Invoice;
          console.log(`💰 invoice.payment_succeeded: ${invoice.id}`);
          try {
            // Find tenant by subscription ID or customer ID
            let tenant = null;
            
            if (invoice.subscription) {
              const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id;
              tenant = await prisma.tenant.findFirst({
                where: { stripeSubscriptionId: subscriptionId }
              });
            } else if (invoice.customer) {
              const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer.id;
              tenant = await prisma.tenant.findFirst({
                where: { stripeCustomerId: customerId }
              });
            }

            if (tenant) {
              // Create a payment record for successful invoice payment
              if (tenant.planId) {
                await prisma.payment.create({
                  data: {
                    tenantId: tenant.id,
                    planId: tenant.planId,
                    amount: invoice.amount_paid || 0,
                    currency: invoice.currency || 'usd',
                    stripePaymentIntentId: invoice.payment_intent as string || null,
                    stripeInvoiceId: invoice.id,
                    status: 'paid',
                    description: `Invoice payment: ${invoice.id}`,
                  }
                });
              }

              // Update subscription status if needed
              if (invoice.subscription && tenant.subscriptionStatus !== 'ACTIVE') {
                await prisma.tenant.update({
                  where: { id: tenant.id },
                  data: { subscriptionStatus: 'ACTIVE' }
                });
              }

              console.log(`✅ Processed invoice payment for tenant ${tenant.id}`);
            } else {
              console.log(`⚠️ No tenant found for invoice ${invoice.id}`);
            }
          } catch (e) {
            console.error('💥 DB error (invoice.payment_succeeded):', e);
          }
          break;
        }

        // 💳 Invoice Payment Failed
        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          console.log(`💳 invoice.payment_failed: ${invoice.id}`);
          try {
            // Find tenant by subscription ID or customer ID
            let tenant = null;
            
            if (invoice.subscription) {
              const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id;
              tenant = await prisma.tenant.findFirst({
                where: { stripeSubscriptionId: subscriptionId }
              });
            } else if (invoice.customer) {
              const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer.id;
              tenant = await prisma.tenant.findFirst({
                where: { stripeCustomerId: customerId }
              });
            }

            if (tenant) {
              // Create a payment record for failed invoice payment
              if (tenant.planId) {
                await prisma.payment.create({
                  data: {
                    tenantId: tenant.id,
                    planId: tenant.planId,
                    amount: invoice.amount_due || 0,
                    currency: invoice.currency || 'usd',
                    stripePaymentIntentId: invoice.payment_intent as string || null,
                    stripeInvoiceId: invoice.id,
                    status: 'failed',
                    description: `Failed invoice payment: ${invoice.id}`,
                  }
                });
              }

              // Update subscription status to past due if needed
              if (invoice.subscription) {
                await prisma.tenant.update({
                  where: { id: tenant.id },
                  data: { subscriptionStatus: 'PAST_DUE' }
                });
              }

              console.log(`⚠️ Processed failed invoice payment for tenant ${tenant.id}`);
            } else {
              console.log(`⚠️ No tenant found for invoice ${invoice.id}`);
            }
          } catch (e) {
            console.error('💥 DB error (invoice.payment_failed):', e);
          }
          break;
        }

        // ℹ️ Default fallback
        default: {
          console.log(`ℹ️ Unhandled event type: ${event.type}`);
          break;
        }
      }

      return res.status(200).json({ received: true });
    } catch (err) {
      console.error('💥 Unexpected webhook processing error:', err);
      // Return 500 for unexpected errors so Stripe will retry
      return res.status(500).json({ error: 'Webhook processing failed' });
    }
  }
);

// Helper function to handle QR payment success
async function handleQRPaymentSuccess(paymentIntent: Stripe.PaymentIntent, paymentLinkId: string) {
  try {
    await prisma.$transaction(async (tx) => {
      // Find the purchase transaction linked to this payment link
      const purchaseTransaction = await tx.purchaseTransaction.findFirst({
        where: { 
          paymentLinkId: paymentLinkId,
          paymentStatus: 'PENDING'
        },
        include: {
          customer: true
        }
      });

      if (!purchaseTransaction) {
        console.error(`No pending purchase transaction found for payment link ${paymentLinkId}`);
        return;
      }

      // Update purchase transaction status
      await tx.purchaseTransaction.update({
        where: { id: purchaseTransaction.id },
        data: {
          paymentStatus: 'COMPLETED',
          paidAt: new Date(),
        }
      });

      // Mark payment link as used
      await tx.paymentLink.update({
        where: { id: paymentLinkId },
        data: { usedAt: new Date() }
      });

      // Check if this is a store credit transaction
      const isStoreCredit = purchaseTransaction.description?.startsWith('STORE_CREDIT:');
      
      if (purchaseTransaction.cardUid) {
        const card = await tx.card.findUnique({
          where: { cardUid: purchaseTransaction.cardUid },
          include: { customer: true }
        });

        if (card) {
          if (isStoreCredit) {
            // Handle store credit - add the full amount to card balance
            const beforeBalance = card.balanceCents;
            const newBalance = beforeBalance + purchaseTransaction.amountCents;

            // Update card balance
            await tx.card.update({
              where: { id: card.id },
              data: { balanceCents: newBalance }
            });

            // Create ADJUST transaction record for store credit
            await tx.transaction.create({
              data: {
                tenantId: purchaseTransaction.tenantId,
                storeId: purchaseTransaction.storeId,
                cardId: card.id,
                customerId: card.customerId!,
                cashierId: purchaseTransaction.cashierId,
                type: 'ADJUST',
                category: purchaseTransaction.category,
                amountCents: purchaseTransaction.amountCents,
                cashbackCents: 0,
                beforeBalanceCents: beforeBalance,
                afterBalanceCents: newBalance,
                note: `Store Credit via ${purchaseTransaction.paymentMethod}: ${purchaseTransaction.id} (Webhook)`,
              }
            });

            console.log(`✅ Store credit added: $${purchaseTransaction.amountCents / 100} to card ${card.cardUid}`);
          } else if (purchaseTransaction.cashbackCents && purchaseTransaction.cashbackCents > 0 && card.customer) {
            // Handle regular purchase with cashback
            const beforeBalance = card.balanceCents;
            const newBalance = beforeBalance + purchaseTransaction.cashbackCents;

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
                beforeBalanceCents: beforeBalance,
                afterBalanceCents: newBalance,
                note: `Purchase transaction: ${purchaseTransaction.id} (Stripe Payment)`,
              }
            });

            // Check for tier upgrade
            if (typeof updateCustomerTier === 'function') {
              await updateCustomerTier(card.customer.id, purchaseTransaction.tenantId, tx);
            }
          }
        }
      }

      console.log(`✅ Processed QR payment for transaction ${purchaseTransaction.id}`);
    });
  } catch (error) {
    console.error(`Failed to process QR payment for payment link ${paymentLinkId}:`, error);
  }
}

// Helper function to handle QR payment failure
async function handleQRPaymentFailure(paymentIntent: Stripe.PaymentIntent, paymentLinkId: string) {
  try {
    // Find the purchase transaction linked to this payment link
    const purchaseTransaction = await prisma.purchaseTransaction.findFirst({
      where: { 
        paymentLinkId: paymentLinkId,
        paymentStatus: 'PENDING'
      }
    });

    if (purchaseTransaction) {
      // Update purchase transaction status to failed
      await prisma.purchaseTransaction.update({
        where: { id: purchaseTransaction.id },
        data: {
          paymentStatus: 'FAILED',
        }
      });

      console.log(`⚠️ Marked QR payment as failed for transaction ${purchaseTransaction.id}`);
    } else {
      console.log(`⚠️ No pending transaction found for failed payment link ${paymentLinkId}`);
    }
  } catch (error) {
    console.error(`Failed to process QR payment failure for payment link ${paymentLinkId}:`, error);
  }
}

// Helper function to handle card order payment success
async function handleCardOrderPayment(paymentIntent: Stripe.PaymentIntent, orderId: string) {
  try {
    await prisma.cardOrder.update({
      where: { id: orderId },
      data: {
        status: 'PENDING',
        stripePaymentId: paymentIntent.id,
        paidAt: new Date(),
      }
    });

    console.log(`✅ Updated card order ${orderId} payment status`);
  } catch (error) {
    console.error(`Failed to update card order ${orderId}:`, error);
  }
}

export default router;
