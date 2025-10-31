// Script to fix existing repair prices (convert dollars to cents)
// Run this ONCE on your VPS to fix the data
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixRepairPrices() {
  try {
    console.log('Starting to fix repair prices...');
    
    // Get all repairs with prices less than 1000 (assuming these are in dollars, not cents)
    const repairsToFix = await prisma.repairDevice.findMany({
      where: {
        OR: [
          {
            estimatedCost: {
              not: null,
              lt: 1000, // Less than $10 (1000 cents)
            }
          },
          {
            actualCost: {
              not: null,
              lt: 1000,
            }
          }
        ]
      }
    });

    console.log(`Found ${repairsToFix.length} repairs to fix`);

    // Update each repair
    for (const repair of repairsToFix) {
      const updateData = {};
      
      if (repair.estimatedCost !== null && repair.estimatedCost < 1000) {
        updateData.estimatedCost = Math.round(repair.estimatedCost * 100);
        console.log(`  Repair ${repair.id}: estimatedCost ${repair.estimatedCost} -> ${updateData.estimatedCost}`);
      }
      
      if (repair.actualCost !== null && repair.actualCost < 1000) {
        updateData.actualCost = Math.round(repair.actualCost * 100);
        console.log(`  Repair ${repair.id}: actualCost ${repair.actualCost} -> ${updateData.actualCost}`);
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.repairDevice.update({
          where: { id: repair.id },
          data: updateData,
        });
      }
    }

    console.log('✅ All repair prices fixed successfully!');
  } catch (error) {
    console.error('❌ Error fixing repair prices:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixRepairPrices()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
