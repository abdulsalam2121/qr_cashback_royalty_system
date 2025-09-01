import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create default plans
  const plans = [
    {
      name: 'Starter Plan',
      description: 'Perfect for small businesses - unlimited card activations after trial',
      priceMonthly: 1999, // $19.99
      billingPeriod: 'MONTHLY' as const,
      billingPeriodMultiplier: 1,
      stripePriceId: 'price_starter',
      features: [
        'Unlimited card activations',
        'Up to 3 store locations',
        'Up to 10 staff members',
        'Unlimited loyalty cards',
        'Basic cashback rules',
        'Email support',
        'Card ordering system'
      ],
      maxStores: 3,
      maxStaff: 10,
      maxCards: -1,
      maxTransactions: -1,
    },
    {
      name: 'Professional',
      description: 'Advanced features for growing businesses',
      priceMonthly: 4999, // $49.99
      billingPeriod: 'MONTHLY' as const,
      billingPeriodMultiplier: 1,
      stripePriceId: 'price_pro',
      features: [
        'Everything in Starter',
        'Unlimited store locations',
        'Unlimited staff members',
        'Advanced cashback rules',
        'Special offer campaigns',
        'Priority support',
        'Custom branding',
        'Advanced analytics'
      ],
      maxStores: -1,
      maxStaff: -1,
      maxCards: -1,
      maxTransactions: -1,
    }
  ];

  for (const planData of plans) {
    const existingPlan = await prisma.plan.findFirst({
      where: { name: planData.name }
    });

    if (!existingPlan) {
      await prisma.plan.create({
        data: planData
      });
      console.log(`Created plan: ${planData.name}`);
    } else {
      console.log(`Plan already exists: ${planData.name}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
