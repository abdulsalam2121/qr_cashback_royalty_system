import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixPlans() {

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
      
    } catch (error) {
      console.error(`❌ Failed to update plan "${planUpdate.name}":`, error);
    }
  }

  // List all plans to verify
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
  });

}

fixPlans()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
