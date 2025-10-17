import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {

  // Create default plans - Only 2 tiers as requested
  const plans = [
    {
      name: 'Free Trial',
      description: 'Free trial with 40 card activations included',
      priceMonthly: 0, // Free
      billingPeriod: 'MONTHLY' as const,
      billingPeriodMultiplier: 1,
      stripePriceId: 'free_trial', // No Stripe price needed for free plan
      features: [
        '40 card activations included',
        'Basic cashback rules',
        'Up to 1 store location',
        'Up to 2 staff members',
        'Email support'
      ],
      maxStores: 1,
      maxStaff: 2,
      maxCards: 40,
      maxTransactions: -1,
      cardAllowance: 40,
      allowCardOrdering: false,
    },
    {
      name: 'Premium',
      description: 'Unlimited activations and full features for growing businesses',
      priceMonthly: 2000, // $20.00
      billingPeriod: 'MONTHLY' as const,
      billingPeriodMultiplier: 1,
      stripePriceId: process.env.STRIPE_PRICE_ID_PREMIUM || 'price_1QDZEuDh4OkzWWyK8UiS2lOc', // Test price ID - update this
      features: [
        'Unlimited card activations',
        'Unlimited store locations',
        'Unlimited staff members',
        'Advanced cashback rules',
        'Special offer campaigns',
        'Priority support',
        'Custom branding',
        'Advanced analytics',
        'Card ordering system'
      ],
      maxStores: -1,
      maxStaff: -1,
      maxCards: -1,
      maxTransactions: -1,
      cardAllowance: -1, // Unlimited
      allowCardOrdering: true,
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
    } else {
    }
  }

  // Create demo tenant first
  const demoTenantSlug = 'demo';
  const existingTenant = await prisma.tenant.findUnique({
    where: { slug: demoTenantSlug }
  });

  let demoTenant;
  if (!existingTenant) {
    const freeTrialPlan = await prisma.plan.findFirst({
      where: { name: 'Free Trial' }
    });

    demoTenant = await prisma.tenant.create({
      data: {
        name: 'Demo Retail Store',
        slug: demoTenantSlug,
        subscriptionStatus: 'TRIALING',
        planId: freeTrialPlan!.id,
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
        freeTrialLimit: 40
      }
    });
  } else {
    demoTenant = existingTenant;
  }

  // Create platform admin user
  const platformAdminEmail = 'admin@platform.com';
  const existingPlatformAdmin = await prisma.user.findUnique({
    where: { email: platformAdminEmail }
  });

  if (!existingPlatformAdmin) {
    const hashedPassword = await bcrypt.hash('AdminSecure123!', 10);
    await prisma.user.create({
      data: {
        email: platformAdminEmail,
        firstName: 'Platform',
        lastName: 'Administrator',
        passwordHash: hashedPassword,
        role: 'platform_admin',
        tenantId: demoTenant.id
      }
    });
  } else {
  }

  // Create demo store
  const existingStore = await prisma.store.findFirst({
    where: { 
      tenantId: demoTenant.id,
      name: 'Main Store'
    }
  });

  let demoStore;
  if (!existingStore) {
    demoStore = await prisma.store.create({
      data: {
        tenantId: demoTenant.id,
        name: 'Main Store',
        address: '123 Demo Street, Demo City, DC 12345',
        active: true
      }
    });
  } else {
    demoStore = existingStore;
  }

  // Create demo users
  
  // Tenant Admin
  const tenantAdminEmail = 'admin@demo.com';
  const existingTenantAdmin = await prisma.user.findUnique({
    where: { email: tenantAdminEmail }
  });

  if (!existingTenantAdmin) {
    const hashedPassword = await bcrypt.hash('DemoAdmin123!', 10);
    await prisma.user.create({
      data: {
        email: tenantAdminEmail,
        firstName: 'Demo',
        lastName: 'Admin',
        passwordHash: hashedPassword,
        role: 'tenant_admin',
        tenantId: demoTenant.id
      }
    });
  } else {
  }

  // Cashier
  const cashierEmail = 'cashier@demo.com';
  const existingCashier = await prisma.user.findUnique({
    where: { email: cashierEmail }
  });

  if (!existingCashier) {
    const hashedPassword = await bcrypt.hash('DemoCashier123!', 10);
    await prisma.user.create({
      data: {
        email: cashierEmail,
        firstName: 'Demo',
        lastName: 'Cashier',
        passwordHash: hashedPassword,
        role: 'cashier',
        tenantId: demoTenant.id,
        storeId: demoStore.id
      }
    });
  } else {
  }

  // Create tier rules
  const tierRules = [
    {
      tenantId: demoTenant.id,
      tier: 'SILVER' as const,
      name: 'Silver Tier',
      minTotalSpendCents: 0,
      baseRateBps: 200 // 2%
    },
    {
      tenantId: demoTenant.id,
      tier: 'GOLD' as const,
      name: 'Gold Tier',
      minTotalSpendCents: 50000, // $500
      baseRateBps: 300 // 3%
    },
    {
      tenantId: demoTenant.id,
      tier: 'PLATINUM' as const,
      name: 'Platinum Tier',
      minTotalSpendCents: 150000, // $1500
      baseRateBps: 500 // 5%
    }
  ];

  for (const tierRule of tierRules) {
    const existingTierRule = await prisma.tierRule.findFirst({
      where: {
        tenantId: tierRule.tenantId,
        tier: tierRule.tier
      }
    });

    if (!existingTierRule) {
      await prisma.tierRule.create({
        data: tierRule
      });
    } else {
    }
  }

  // Create cashback rules
  const cashbackRules = [
    {
      tenantId: demoTenant.id,
      category: 'PURCHASE' as const,
      baseRateBps: 300 // 3%
    },
    {
      tenantId: demoTenant.id,
      category: 'REPAIR' as const,
      baseRateBps: 500 // 5%
    },
    {
      tenantId: demoTenant.id,
      category: 'OTHER' as const,
      baseRateBps: 200 // 2%
    }
  ];

  for (const ruleData of cashbackRules) {
    const existingRule = await prisma.cashbackRule.findFirst({
      where: {
        tenantId: ruleData.tenantId,
        category: ruleData.category
      }
    });

    if (!existingRule) {
      await prisma.cashbackRule.create({
        data: ruleData
      });
    } else {
    }
  }

  // Create sample customers and cards
  const sampleCustomers = [
    {
      firstName: 'John',
      lastName: 'Smith',
      email: 'john.smith@email.com',
      phone: '+1-555-0101',
      tier: 'SILVER' as const,
      totalSpend: '150.00'
    },
    {
      firstName: 'Sarah',
      lastName: 'Johnson',
      email: 'sarah.johnson@email.com',
      phone: '+1-555-0102',
      tier: 'GOLD' as const,
      totalSpend: '750.00'
    },
    {
      firstName: 'Mike',
      lastName: 'Wilson',
      email: 'mike.wilson@email.com',
      phone: '+1-555-0103',
      tier: 'PLATINUM' as const,
      totalSpend: '2500.00'
    }
  ];

  for (const customerData of sampleCustomers) {
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        tenantId: demoTenant.id,
        email: customerData.email
      }
    });

    if (!existingCustomer) {
      const customer = await prisma.customer.create({
        data: {
          ...customerData,
          tenantId: demoTenant.id
        }
      });

      // Create a card for this customer
      const cardUid = `DEMO${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
      const balanceCents = customerData.tier === 'SILVER' ? 1500 : 
                          customerData.tier === 'GOLD' ? 2500 : 5000;
      
      await prisma.card.create({
        data: {
          cardUid: cardUid,
          tenantId: demoTenant.id,
          storeId: demoStore.id,
          customerId: customer.id,
          status: 'ACTIVE',
          activatedAt: new Date(),
          qrUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/card/${cardUid}`,
          balanceCents: balanceCents
        }
      });

    } else {
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
