const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTransaction() {
  try {
    console.log('Checking transaction...');
    
    const transaction = await prisma.purchaseTransaction.findMany({
      where: { 
        id: 'DsZRLWQIrMtP0kiAxx3Inrelx_0BE6uKRhl8-YmKeqo' 
      },
      include: { 
        store: { select: { name: true } }, 
        customer: { select: { firstName: true, lastName: true } }
      }
    });
    
    console.log('Transaction found:', JSON.stringify(transaction, null, 2));
    
    // Check recent transactions
    const recent = await prisma.purchaseTransaction.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { 
        store: { select: { name: true } }, 
        customer: { select: { firstName: true, lastName: true } }
      }
    });
    
    console.log('\nRecent 5 transactions:');
    recent.forEach((t, i) => {
      console.log(`${i + 1}. ID: ${t.id}, Status: ${t.paymentStatus}, Amount: ${t.amountCents}, Method: ${t.paymentMethod}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTransaction();