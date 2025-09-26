const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRecentTransaction() {
  try {
    console.log('Checking most recent $19.00 transaction...');
    
    const transaction = await prisma.purchaseTransaction.findFirst({
      where: { 
        amountCents: 1900,
        paymentMethod: 'QR_PAYMENT'
      },
      orderBy: { createdAt: 'desc' },
      include: { 
        store: { select: { name: true } }, 
        customer: { select: { firstName: true, lastName: true, email: true } }
      }
    });
    
    console.log('Transaction found:', JSON.stringify(transaction, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkRecentTransaction();