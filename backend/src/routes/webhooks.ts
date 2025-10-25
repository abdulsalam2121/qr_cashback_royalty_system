import express from 'express';
import Stripe from 'stripe';
import { PrismaClient, PaymentMethod, PaymentStatus, TxCategory } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { updateCustomerTier } from '../utils/tiers.js';
import { CustomerEmailService } from '../services/customerEmailService.js';

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

          try {
            const md = paymentIntent.metadata ?? {};
            
            // Handle QR code payments (paymentLinkId metadata)
            if (md.paymentLinkId) {
              await handleQRPaymentSuccess(paymentIntent, md.paymentLinkId);
            }
            // Handle purchase transactions with card balance (purchaseTransactionId metadata)
            else if (md.purchaseTransactionId) {
              await handlePurchaseTransactionCardPaymentSuccess(paymentIntent, md.purchaseTransactionId);
            }
            // Handle POS payments (tenantId, storeId, cashierId metadata)  
            else if (md.tenantId && md.storeId && md.cashierId) {
              await prisma.purchase_transactions.create({
                data: {
                  id: `pt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
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
                  updatedAt: new Date(),
                },
              });
            } 
            // Handle card order payments (orderId metadata)
            else if (md.orderId) {
              await handleCardOrderPayment(paymentIntent, md.orderId);
            }
            else {
            }
          } catch (e) {
            console.error('💥 DB error (payment_intent.succeeded):', e);
          }
          break;
        }

        // ❌ Payment Failed
        case 'payment_intent.payment_failed': {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;

          try {
            const md = paymentIntent.metadata ?? {};
            
            // Handle QR code payment failures
            if (md.paymentLinkId) {
              await handleQRPaymentFailure(paymentIntent, md.paymentLinkId);
            }
            // Handle POS payment failures
            else if (md.tenantId && md.storeId && md.cashierId) {
              await prisma.purchase_transactions.create({
                data: {
                  id: `pt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
                  tenantId: md.tenantId,
                  storeId: md.storeId,
                  cashierId: md.cashierId,
                  amountCents: paymentIntent.amount,
                  category: TxCategory.PURCHASE,
                  description: paymentIntent.description || 'Payment failed',
                  paymentMethod: PaymentMethod.CARD,
                  paymentStatus: PaymentStatus.FAILED,
                  customerId: md.customerId || null,
                  updatedAt: new Date(),
                },
              });
            } else {
            }
          } catch (e) {
            console.error('💥 DB error (payment_intent.payment_failed):', e);
          }
          break;
        }

        // 💸 Refund
        case 'charge.refunded': {
          const charge = event.data.object as Stripe.Charge;

          try {
            const md = charge.metadata ?? {};
            if (md.tenantId && md.storeId && md.cashierId) {
              await prisma.purchase_transactions.create({
                data: {
                  id: `pt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
                  tenantId: md.tenantId,
                  storeId: md.storeId,
                  cashierId: md.cashierId,
                  amountCents: charge.amount,
                  category: TxCategory.PURCHASE,
                  description: 'Refund issued',
                  paymentMethod: PaymentMethod.CARD,
                  paymentStatus: PaymentStatus.CANCELLED,
                  customerId: md.customerId || null,
                  updatedAt: new Date(),
                },
              });
            } else {
            }
          } catch (e) {
            console.error('💥 DB error (charge.refunded):', e);
          }
          break;
        }

        // 🧾 Checkout
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          break;
        }

        // 🆕 Subscription Created
        case 'customer.subscription.created': {
          const subscription = event.data.object as Stripe.Subscription;
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

            } else {
            }
          } catch (e) {
            console.error('💥 DB error (subscription.created):', e);
          }
          break;
        }

        // 🔁 Subscription Updated
        case 'customer.subscription.updated': {
          const subscription = event.data.object as Stripe.Subscription;
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

            } else {
            }
          } catch (e) {
            console.error('💥 DB error (subscription.updated):', e);
          }
          break;
        }

        // ❌ Subscription Deleted
        case 'customer.subscription.deleted': {
          const subscription = event.data.object as Stripe.Subscription;
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

            } else {
            }
          } catch (e) {
            console.error('💥 DB error (subscription.deleted):', e);
          }
          break;
        }

        // 💰 Invoice Payment Succeeded
        case 'invoice.payment_succeeded': {
          const invoice = event.data.object as Stripe.Invoice;
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

            } else {
            }
          } catch (e) {
            console.error('💥 DB error (invoice.payment_succeeded):', e);
          }
          break;
        }

        // 💳 Invoice Payment Failed
        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
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

            } else {
            }
          } catch (e) {
            console.error('💥 DB error (invoice.payment_failed):', e);
          }
          break;
        }

        // ℹ️ Default fallback
        default: {
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
      const purchaseTransaction = await tx.purchase_transactions.findFirst({
        where: { 
          paymentLinkId: paymentLinkId,
          paymentStatus: 'PENDING'
        },
        include: {
          customers: true
        }
      });

      if (!purchaseTransaction) {
        console.error(`No pending purchase transaction found for payment link ${paymentLinkId}`);
        return;
      }

      // Update purchase transaction status
      await tx.purchase_transactions.update({
        where: { id: purchaseTransaction.id },
        data: {
          paymentStatus: 'COMPLETED',
          paidAt: new Date(),
        }
      });

      // Mark payment link as used
      await tx.payment_links.update({
        where: { id: paymentLinkId },
        data: { usedAt: new Date() }
      });

      // Check if this is a store credit transaction
      const isStoreCredit = purchaseTransaction.description?.startsWith('STORE_CREDIT:');
      
      // Extract balance usage info from payment metadata or payment link description
      let balanceUsedCents = 0;
      if (paymentIntent.metadata?.balanceUsedCents) {
        balanceUsedCents = parseInt(paymentIntent.metadata.balanceUsedCents, 10) || 0;
      } else {
        // Try to extract from payment link description
        const paymentLink = await tx.payment_links.findUnique({
          where: { id: paymentLinkId }
        });
        
        if (paymentLink?.description) {
          const balanceMatch = paymentLink.description.match(/Balance used: (\d+\.?\d*)/);
          if (balanceMatch && balanceMatch[1]) {
            balanceUsedCents = Math.round(parseFloat(balanceMatch[1]) * 100);
          }
        }
      }
      
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

          } else {
            // Handle regular purchase with potential balance usage and cashback
            let newBalance = card.balanceCents;
            
            // Deduct balance used if applicable
            if (balanceUsedCents > 0) {
              if (balanceUsedCents > card.balanceCents) {
                console.error(`Insufficient balance for deduction: ${balanceUsedCents} > ${card.balanceCents}`);
                return;
              }
              newBalance -= balanceUsedCents;
            }

            // Calculate cashback on the amount actually paid (excluding balance used)
            const paidAmountCents = paymentIntent.amount; // This is the amount paid by external payment method
            let cashbackCents = 0;
            
            if (paidAmountCents > 0 && card.customer) {
              const { calculateCashback } = await import('../utils/cashback.js');
              cashbackCents = await calculateCashback(
                paidAmountCents,
                purchaseTransaction.category as any,
                card.customer.tier,
                purchaseTransaction.tenantId,
                tx
              );
              
              // Add cashback to balance
              newBalance += cashbackCents;
            }

            // Update card balance
            await tx.card.update({
              where: { id: card.id },
              data: { balanceCents: newBalance }
            });

            // Update customer total spend with full purchase amount
            if (card.customer) {
              const newTotalSpend = new Decimal(card.customer.totalSpend).add(
                new Decimal(purchaseTransaction.amountCents).div(100)
              );
              await tx.customer.update({
                where: { id: card.customer.id },
                data: { totalSpend: newTotalSpend }
              });
            }

            // Create transaction record for balance usage (if applicable)
            if (balanceUsedCents > 0) {
              await tx.transaction.create({
                data: {
                  tenantId: purchaseTransaction.tenantId,
                  storeId: purchaseTransaction.storeId,
                  cardId: card.id,
                  customerId: card.customerId!,
                  cashierId: purchaseTransaction.cashierId,
                  type: 'REDEEM',
                  category: purchaseTransaction.category,
                  amountCents: balanceUsedCents,
                  cashbackCents: 0,
                  beforeBalanceCents: card.balanceCents,
                  afterBalanceCents: card.balanceCents - balanceUsedCents,
                  note: `Balance used for purchase: ${purchaseTransaction.id} (QR Payment)`,
                }
              });
            }

            // Create transaction record for cashback earned (if applicable)
            if (cashbackCents > 0 && card.customer) {
              await tx.transaction.create({
                data: {
                  tenantId: purchaseTransaction.tenantId,
                  storeId: purchaseTransaction.storeId,
                  cardId: card.id,
                  customerId: card.customer.id,
                  cashierId: purchaseTransaction.cashierId,
                  type: 'EARN',
                  category: purchaseTransaction.category,
                  amountCents: paidAmountCents, // Amount cashback was calculated on
                  cashbackCents: cashbackCents,
                  beforeBalanceCents: balanceUsedCents > 0 ? card.balanceCents - balanceUsedCents : card.balanceCents,
                  afterBalanceCents: newBalance,
                  note: `Purchase via QR payment: ${purchaseTransaction.id} (cashback on paid amount: ${(paidAmountCents / 100).toFixed(2)})`,
                }
              });
            }

            // Check for tier upgrade
            if (card.customer && typeof updateCustomerTier === 'function') {
              await updateCustomerTier(card.customer.id, purchaseTransaction.tenantId, tx);
            }
            
            // Send cashback earned email notification (async, don't block response)
            if (card.customer?.email && cashbackCents > 0) {
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
                      cashbackAmount: (cashbackCents / 100).toFixed(2),
                      purchaseAmount: (purchaseTransaction.amountCents / 100).toFixed(2),
                      newBalance: (newBalance / 100).toFixed(2),
                      beforeBalance: (card.balanceCents / 100).toFixed(2),
                      storeName: store?.name || 'Store',
                      tenantName: tenant?.name || null,
                      timestamp: new Date().toLocaleString(),
                      transactionId: purchaseTransaction.id,
                      balanceUsed: balanceUsedCents > 0 ? (balanceUsedCents / 100).toFixed(2) : '0.00',
                      remainingPaid: (paidAmountCents / 100).toFixed(2),
                      paymentMethod: 'QR_PAYMENT',
                    }
                  );
                } catch (error) {
                  console.error('Failed to send cashback earned email in webhook:', error);
                }
              });
            }
          }
        }
      }

    });
  } catch (error) {
    console.error(`Failed to process QR payment for payment link ${paymentLinkId}:`, error);
  }
}

// Helper function to handle QR payment failure
async function handleQRPaymentFailure(paymentIntent: Stripe.PaymentIntent, paymentLinkId: string) {
  try {
    // Find the purchase transaction linked to this payment link
    const purchaseTransaction = await prisma.purchase_transactions.findFirst({
      where: { 
        paymentLinkId: paymentLinkId,
        paymentStatus: 'PENDING'
      }
    });

    if (purchaseTransaction) {
      // Update purchase transaction status to failed
      await prisma.purchase_transactions.update({
        where: { id: purchaseTransaction.id },
        data: {
          paymentStatus: 'FAILED',
        }
      });

    } else {
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

  } catch (error) {
    console.error(`Failed to update card order ${orderId}:`, error);
  }
}

// Helper function to handle purchase transaction card payment success
async function handlePurchaseTransactionCardPaymentSuccess(paymentIntent: Stripe.PaymentIntent, purchaseTransactionId: string) {
  try {
    await prisma.$transaction(async (tx) => {
      // Get the purchase transaction with all related data
      const purchaseTransaction = await tx.purchase_transactions.findUnique({
        where: { id: purchaseTransactionId },
        include: {
          customers: true,
          payment_links: true,
        }
      });

      if (!purchaseTransaction) {
        console.error(`Purchase transaction ${purchaseTransactionId} not found`);
        return;
      }

      // Check if this transaction used card balance
      const useCardBalance = purchaseTransaction.amountCents > paymentIntent.amount;
      const balanceUsedCents = useCardBalance ? purchaseTransaction.amountCents - paymentIntent.amount : 0;

      // Update the purchase transaction to completed
      await tx.purchase_transactions.update({
        where: { id: purchaseTransactionId },
        data: {
          paymentStatus: 'COMPLETED',
          paidAt: new Date(),
          paymentMethod: 'CARD',
        }
      });

      // Mark payment link as used
      if (purchaseTransaction.paymentLinkId) {
        await tx.payment_links.update({
          where: { id: purchaseTransaction.paymentLinkId },
          data: { usedAt: new Date() }
        });
      }

      // If using card balance, now process the balance deduction and cashback
      if (useCardBalance && purchaseTransaction.cardUid && purchaseTransaction.customers) {
        const card = await tx.card.findUnique({
          where: { cardUid: purchaseTransaction.cardUid },
        });

        if (card) {
          let newBalance = card.balanceCents;
          
          // Deduct balance used for payment
          if (balanceUsedCents > 0) {
            newBalance -= balanceUsedCents;
          }
          
          // Add cashback earned (should be calculated on remaining amount only)
          if (purchaseTransaction.cashbackCents && purchaseTransaction.cashbackCents > 0) {
            newBalance += purchaseTransaction.cashbackCents;
          }
          
          // Update card balance
          await tx.card.update({
            where: { id: card.id },
            data: { balanceCents: newBalance }
          });

          // Update customer total spend
          const newTotalSpend = new Decimal(purchaseTransaction.customers.totalSpend).add(new Decimal(purchaseTransaction.amountCents).div(100));
          await tx.customer.update({
            where: { id: purchaseTransaction.customers.id },
            data: { totalSpend: newTotalSpend }
          });

          // Create transaction record for balance usage
          if (balanceUsedCents > 0) {
            await tx.transaction.create({
              data: {
                tenantId: purchaseTransaction.tenantId,
                storeId: purchaseTransaction.storeId,
                cardId: card.id,
                customerId: purchaseTransaction.customers.id,
                cashierId: purchaseTransaction.cashierId,
                type: 'REDEEM',
                category: purchaseTransaction.category,
                amountCents: balanceUsedCents,
                cashbackCents: 0,
                beforeBalanceCents: card.balanceCents,
                afterBalanceCents: card.balanceCents - balanceUsedCents,
                note: `Balance used for purchase: ${purchaseTransaction.id}`,
                sourceIp: null,
              }
            });
          }

          // Create cashback transaction record
          if (purchaseTransaction.cashbackCents && purchaseTransaction.cashbackCents > 0) {
            await tx.transaction.create({
              data: {
                tenantId: purchaseTransaction.tenantId,
                storeId: purchaseTransaction.storeId,
                cardId: card.id,
                customerId: purchaseTransaction.customers.id,
                cashierId: purchaseTransaction.cashierId,
                type: 'EARN',
                category: purchaseTransaction.category,
                amountCents: paymentIntent.amount, // Amount cashback was calculated on
                cashbackCents: purchaseTransaction.cashbackCents,
                beforeBalanceCents: balanceUsedCents > 0 ? card.balanceCents - balanceUsedCents : card.balanceCents,
                afterBalanceCents: newBalance,
                note: `Purchase transaction: ${purchaseTransaction.id} (cashback on card payment: ${(paymentIntent.amount / 100).toFixed(2)})`,
                sourceIp: null,
              }
            });
          }

          // Check for tier upgrade
          const { updateCustomerTier } = await import('../utils/tiers.js');
          await updateCustomerTier(purchaseTransaction.customers.id, purchaseTransaction.tenantId, tx);
        }
      }
    });

    console.log(`✅ Purchase transaction ${purchaseTransactionId} card payment completed successfully`);
  } catch (error) {
    console.error(`Failed to process purchase transaction card payment success for ${purchaseTransactionId}:`, error);
  }
}

export default router;
