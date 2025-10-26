// Debug script to check CardPrintOrder table
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkPrintOrders() {
  try {
    console.log('Checking CardPrintOrder table...');
    
    const orders = await prisma.cardPrintOrder.findMany({
      include: {
        tenant: true,
        cards: true
      }
    });
    
    console.log(`Found ${orders.length} print orders:`);
    orders.forEach((order, index) => {
      console.log(`${index + 1}. Order ID: ${order.id}`);
      console.log(`   Tenant: ${order.tenant?.name || 'Unknown'}`);
      console.log(`   Quantity: ${order.quantity}`);
      console.log(`   Status: ${order.status}`);
      console.log(`   Store: ${order.storeName}`);
      console.log(`   Created: ${order.createdAt}`);
      console.log(`   Cards: ${order.cards?.length || 0}`);
      console.log('---');
    });
    
    if (orders.length === 0) {
      console.log('No print orders found. Let\'s check if cards exist...');
      
      const cards = await prisma.card.findMany({
        include: {
          tenant: true
        },
        take: 5
      });
      
      console.log(`Found ${cards.length} cards (showing first 5):`);
      cards.forEach((card, index) => {
        console.log(`${index + 1}. Card UID: ${card.cardUid}`);
        console.log(`   Tenant: ${card.tenant?.name || 'Unknown'}`);
        console.log(`   Print Order ID: ${card.printOrderId || 'None'}`);
        console.log(`   Created: ${card.createdAt}`);
        console.log('---');
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPrintOrders();