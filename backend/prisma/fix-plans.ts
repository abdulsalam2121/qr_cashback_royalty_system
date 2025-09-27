import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixPlans() {
  console.log('🔧 Fixing plans with proper Stripe price IDs...');

  // Update plans with demo price IDs for testing
  const plansToUpdate = [
    {
      name: 'Starter Plan',
      stripePriceId: 'price_demo_starter',
    },
    {
      name: 'Professional',
      stripePriceId: 'price_demo_professional',
    },
    {
      name: 'Enterprise',
      stripePriceId: 'price_demo_enterprise',
    }
  ];

  for (const planUpdate of plansToUpdate) {
    try {
      const result = await prisma.plan.updateMany({
        where: {
          name: {
            contains: planUpdate.name,
            mode: 'insensitive'
          }
        },
        data: {
          stripePriceId: planUpdate.stripePriceId
        }
      });
      
      console.log(`✅ Updated ${result.count} plan(s) for "${planUpdate.name}" with price ID: ${planUpdate.stripePriceId}`);
    } catch (error) {
      console.error(`❌ Failed to update plan "${planUpdate.name}":`, error);
    }
  }

  // List all plans to verify
  console.log('\n📋 Current plans:');
  const allPlans = await prisma.plan.findMany({
    select: {
      id: true,
      name: true,
      stripePriceId: true,
      priceMonthly: true,
      isActive: true
    }
  });

  allPlans.forEach(plan => {
    console.log(`- ${plan.name}: ${plan.stripePriceId} ($${plan.priceMonthly}/month) [${plan.isActive ? 'Active' : 'Inactive'}]`);
  });

  console.log('\n🎉 Plans updated successfully!');
}

fixPlans()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
