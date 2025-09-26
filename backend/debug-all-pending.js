const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function processPendingTransactions() {
  try {
    console.log('Finding all pending QR_PAYMENT transactions...');
    
    const pendingTransactions = await prisma.purchaseTransaction.findMany({
      where: { 
        paymentStatus: 'PENDING',
        paymentMethod: 'QR_PAYMENT',
        paymentLinkId: { not: null }
      },
      include: {
        paymentLink: true,
        customer: { select: { firstName: true, lastName: true } },
        store: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`Found ${pendingTransactions.length} pending transactions`);
    
    if (pendingTransactions.length === 0) {
      console.log('No pending transactions to process');
      return;
    }
    
    pendingTransactions.forEach((transaction, index) => {
      console.log(`\n${index + 1}. Transaction ID: ${transaction.id}`);
      console.log(`   Customer: ${transaction.customer?.firstName} ${transaction.customer?.lastName}`);
      console.log(`   Amount: $${transaction.amountCents / 100}`);
      console.log(`   Store: ${transaction.store?.name}`);
      console.log(`   Created: ${transaction.createdAt}`);
      console.log(`   Payment Link Used: ${transaction.paymentLink?.usedAt ? 'YES' : 'NO'}`);
    });
    
    console.log('\n--- Would you like to process these? ---');
    console.log('Note: Only process transactions that you know were actually paid in Stripe');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

processPendingTransactions();