import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCard() {
  try {
    const cardUid = 'W5KAJBO-FKBC';
    console.log(`Looking for card with UID: ${cardUid}`);
    
    // Check exact match
    const exactCard = await prisma.card.findUnique({
      where: { cardUid },
      include: {
        customer: true,
        tenant: true
      }
    });
    
    console.log('Exact match result:', exactCard ? 'Found' : 'Not found');
    if (exactCard) {
      console.log('Card details:', {
        id: exactCard.id,
        cardUid: exactCard.cardUid,
        status: exactCard.status,
        customerId: exactCard.customerId,
        tenantId: exactCard.tenantId
      });
    }
    
    // Check uppercase match
    const upperCard = await prisma.card.findUnique({
      where: { cardUid: cardUid.toUpperCase() },
      include: {
        customer: true,
        tenant: true
      }
    });
    
    console.log('Uppercase match result:', upperCard ? 'Found' : 'Not found');
    if (upperCard) {
      console.log('Uppercase card details:', {
        id: upperCard.id,
        cardUid: upperCard.cardUid,
        status: upperCard.status,
        customerId: upperCard.customerId,
        tenantId: upperCard.tenantId
      });
    }
    
    // Search for similar cards
    const similarCards = await prisma.card.findMany({
      where: {
        cardUid: {
          contains: 'W5KAJBO'
        }
      },
      take: 5
    });
    
    console.log(`Found ${similarCards.length} similar cards:`);
    similarCards.forEach(card => {
      console.log(`- ${card.cardUid} (status: ${card.status})`);
    });
    
    // List some cards for reference
    const sampleCards = await prisma.card.findMany({
      take: 5,
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      }
    });
    
    console.log('\nSample cards in system:');
    sampleCards.forEach(card => {
      console.log(`- ${card.cardUid} (status: ${card.status}, customer: ${card.customer?.firstName || 'None'})`);
    });
    
  } catch (error) {
    console.error('Error checking card:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCard();