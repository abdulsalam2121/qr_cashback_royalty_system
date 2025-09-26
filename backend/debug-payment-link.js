const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPaymentLink() {
  try {
    console.log('Checking payment link...');
    
    // Check the payment link associated with the recent transaction
    const paymentLink = await prisma.paymentLink.findFirst({
      where: { 
        id: 'cmg11v2hf0007qhhsk4mhqmu3' 
      }
    });
    
    console.log('Payment link found:', JSON.stringify(paymentLink, null, 2));
    
    // Also check by token
    const paymentLinkByToken = await prisma.paymentLink.findFirst({
      where: { 
        token: 'DsZRLWQIrMtP0kiAxx3Inrelx_0BE6uKRhl8-YmKeqo' 
      }
    });
    
    console.log('Payment link by token:', JSON.stringify(paymentLinkByToken, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPaymentLink();