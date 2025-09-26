const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function simulateWebhookProcessing() {
  try {
    console.log('Simulating webhook processing for payment link...');
    
    const paymentLinkId = 'cmg11v2hf0007qhhsk4mhqmu3';
    
    await prisma.$transaction(async (tx) => {
      // Find the payment link and associated purchase transaction
      const paymentLink = await tx.paymentLink.findUnique({
        where: { id: paymentLinkId },
        include: {
          purchaseTransactions: {
            where: { paymentStatus: 'PENDING' },
            include: {
              store: { select: { name: true } },
              customer: { select: { firstName: true, lastName: true, email: true } },
            }
          }
        }
      });

      if (!paymentLink) {
        throw new Error('Payment link not found');
      }

      console.log('Payment link:', JSON.stringify(paymentLink, null, 2));

      if (paymentLink.usedAt) {
        console.log('Payment link already used, skipping processing');
        return;
      }

      const purchaseTransaction = paymentLink.purchaseTransactions[0];
      if (!purchaseTransaction) {
        throw new Error('No pending transaction found for this payment link');
      }

      console.log('Found purchase transaction:', purchaseTransaction.id);

      // Mark payment link as used
      await tx.paymentLink.update({
        where: { id: paymentLink.id },
        data: { usedAt: new Date() }
      });

      console.log('Marked payment link as used');

      // Process the transaction completion
      await completeTransaction(purchaseTransaction.id, 'QR Payment via Stripe (Manual Test)', tx);
      
      console.log('Transaction completed successfully!');
    });
    
  } catch (error) {
    console.error('Error simulating webhook processing:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function completeTransaction(purchaseTransactionId, source, tx) {
  console.log(`Completing transaction ${purchaseTransactionId}...`);
  
  // Update payment status
  const updatedTransaction = await tx.purchaseTransaction.update({
    where: { id: purchaseTransactionId },
    data: {
      paymentStatus: 'COMPLETED',
      paidAt: new Date(),
    },
  });

  console.log('Updated transaction status to COMPLETED');

  // Process cashback and create transaction record
  if (updatedTransaction.cardUid) {
    const card = await tx.card.findUnique({
      where: { cardUid: updatedTransaction.cardUid },
      include: { customer: true }
    });

    if (card && card.customer) {
      let newBalance = card.balanceCents;
      
      // Update card balance if there's cashback
      if (updatedTransaction.cashbackCents && updatedTransaction.cashbackCents > 0) {
        newBalance = card.balanceCents + updatedTransaction.cashbackCents;

        await tx.card.update({
          where: { id: card.id },
          data: { balanceCents: newBalance }
        });
        
        console.log(`Updated card balance: ${card.balanceCents} -> ${newBalance} (added ${updatedTransaction.cashbackCents} cashback)`);
      }

      // Update customer total spend
      const { Decimal } = require('decimal.js');
      const newTotalSpend = new Decimal(card.customer.totalSpend).add(new Decimal(updatedTransaction.amountCents).div(100));
      await tx.customer.update({
        where: { id: card.customer.id },
        data: { totalSpend: newTotalSpend.toNumber() }
      });

      console.log(`Updated customer total spend: ${card.customer.totalSpend} -> ${newTotalSpend.toNumber()}`);

      // Always create transaction record for card-based transactions
      const transactionRecord = await tx.transaction.create({
        data: {
          tenantId: updatedTransaction.tenantId,
          storeId: updatedTransaction.storeId,
          cardId: card.id,
          customerId: card.customer.id,
          cashierId: updatedTransaction.cashierId,
          type: 'EARN',
          category: updatedTransaction.category,
          amountCents: updatedTransaction.amountCents,
          cashbackCents: updatedTransaction.cashbackCents || 0,
          beforeBalanceCents: card.balanceCents,
          afterBalanceCents: newBalance,
          note: `Purchase transaction: ${updatedTransaction.id} (${source})`,
        }
      });

      console.log('Created transaction record:', transactionRecord.id);
    }
  }
}

simulateWebhookProcessing();