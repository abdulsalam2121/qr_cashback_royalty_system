// Test the print order count API
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testPrintOrderCount() {
  try {
    console.log('Testing print order count...');
    
    // Get pending count (same logic as API)
    const pendingCount = await prisma.cardPrintOrder.count({
      where: {
        status: {
          in: ['CREATED', 'PRINTING_ACCEPTED', 'PRINTING_IN_PROGRESS']
        }
      }
    });

    console.log(`Pending print orders count: ${pendingCount}`);
    
    // Show all orders with their statuses
    const allOrders = await prisma.cardPrintOrder.findMany({
      select: {
        id: true,
        status: true,
        quantity: true,
        tenant: {
          select: {
            name: true
          }
        }
      }
    });
    
    console.log('\nAll print orders:');
    allOrders.forEach((order, index) => {
      const isPending = ['CREATED', 'PRINTING_ACCEPTED', 'PRINTING_IN_PROGRESS'].includes(order.status);
      console.log(`${index + 1}. ${order.tenant.name} - ${order.quantity} cards - ${order.status} ${isPending ? '(PENDING)' : ''}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPrintOrderCount();