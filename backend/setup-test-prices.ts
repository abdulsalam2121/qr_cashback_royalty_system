import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createTestPrices() {
  try {
    console.log('🔧 Setting up realistic test Stripe price IDs...');

    // These are example test price IDs that would come from Stripe Test Mode
    // In a real setup, you'd run the create-real-stripe-prices.ts script to generate these
    const testPrices = {
      'Starter Plan': 'price_test_starter_monthly_999',
      'Professional': 'price_test_professional_monthly_2999', 
      'Enterprise': 'price_test_enterprise_monthly_9999'
    };

    const plans = await prisma.plan.findMany({
      where: { isActive: true }
    });

    for (const plan of plans) {
      const priceId = testPrices[plan.name as keyof typeof testPrices];
      if (priceId) {
        await prisma.plan.update({
          where: { id: plan.id },
          data: { stripePriceId: priceId }
        });
        console.log(`✅ Updated ${plan.name}: ${priceId} ($${plan.priceMonthly}/month)`);
      }
    }

    console.log('\n📋 Updated plans with test Stripe price IDs:');
    const updatedPlans = await prisma.plan.findMany({
      where: { isActive: true },
      select: { name: true, priceMonthly: true, stripePriceId: true }
    });

    updatedPlans.forEach(plan => {
      console.log(`- ${plan.name}: $${plan.priceMonthly}/month -> ${plan.stripePriceId}`);
    });

    console.log('\n💡 Note: These are test price IDs. With valid Stripe test keys,');
    console.log('   run "npx tsx create-real-stripe-prices.ts" to create real Stripe prices.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestPrices();
