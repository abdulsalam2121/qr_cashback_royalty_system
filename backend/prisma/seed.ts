import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create default plans
  console.log('📋 Creating subscription plans...');
  const plans = [
    {
      name: 'Starter Plan',
      description: 'Perfect for small businesses - unlimited card activations after trial',
      priceMonthly: 1999, // $19.99
      billingPeriod: 'MONTHLY' as const,
      billingPeriodMultiplier: 1,
      stripePriceId: 'price_starter_monthly',
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
      stripePriceId: 'price_pro_monthly',
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
    },
    {
      name: 'Enterprise',
      description: 'Complete solution for large businesses',
      priceMonthly: 9999, // $99.99
      billingPeriod: 'MONTHLY' as const,
      billingPeriodMultiplier: 1,
      stripePriceId: 'price_enterprise_monthly',
      features: [
        'Everything in Professional',
        'API access',
        'Custom integrations',
        'Dedicated account manager',
        'SLA guarantee',
        'Custom reporting',
        'Multi-language support',
        'White-label options'
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
      console.log(`✅ Created plan: ${planData.name}`);
    } else {
      console.log(`ℹ️  Plan already exists: ${planData.name}`);
    }
  }

  // Create platform admin user
  console.log('👤 Creating platform admin user...');
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
    console.log(`✅ Created platform admin: ${platformAdminEmail}`);
  } else {
    console.log(`ℹ️  Platform admin already exists: ${platformAdminEmail}`);
  }

  // Create demo tenant
  console.log('🏢 Creating demo tenant...');
  const demoTenantDomain = 'demo';
  const existingTenant = await prisma.tenant.findUnique({
    where: { domain: demoTenantDomain }
  });

  let demoTenant;
  if (!existingTenant) {
    const starterPlan = await prisma.plan.findFirst({
      where: { name: 'Starter Plan' }
    });

    demoTenant = await prisma.tenant.create({
      data: {
        name: 'Demo Retail Store',
        domain: demoTenantDomain,
        status: 'ACTIVE',
        planId: starterPlan!.id,
        subscriptionStatus: 'ACTIVE',
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days trial
        isTrialUsed: false,
        settings: {
          businessType: 'retail',
          timezone: 'UTC',
          currency: 'USD',
          notifications: {
            sms: true,
            email: true,
            whatsapp: false
          }
        }
      }
    });
    console.log(`✅ Created demo tenant: ${demoTenant.name}`);
  } else {
    demoTenant = existingTenant;
    console.log(`ℹ️  Demo tenant already exists: ${demoTenant.name}`);
  }

  // Create demo store
  console.log('🏪 Creating demo store...');
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
        phone: '+1-555-0123',
        email: 'store@demo.com',
        isActive: true
      }
    });
    console.log(`✅ Created demo store: ${demoStore.name}`);
  } else {
    demoStore = existingStore;
    console.log(`ℹ️  Demo store already exists: ${demoStore.name}`);
  }

  // Create demo users
  console.log('👥 Creating demo users...');
  const demoUsers = [
    {
      email: 'admin@demo.com',
      name: 'Demo Store Admin',
      password: 'DemoAdmin123!',
      role: 'TENANT_ADMIN' as const,
      tenantId: demoTenant.id
    },
    {
      email: 'cashier@demo.com',
      name: 'Demo Cashier',
      password: 'DemoCashier123!',
      role: 'CASHIER' as const,
      tenantId: demoTenant.id,
      storeId: demoStore.id
    }
  ];

  for (const userData of demoUsers) {
    const existingUser = await prisma.user.findUnique({
      where: { email: userData.email }
    });

    if (!existingUser) {
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      await prisma.user.create({
        data: {
          ...userData,
          password: hashedPassword,
          emailVerified: true
        }
      });
      console.log(`✅ Created demo user: ${userData.email}`);
    } else {
      console.log(`ℹ️  Demo user already exists: ${userData.email}`);
    }
  }

  // Create cashback rules
  console.log('💰 Creating cashback rules...');
  const cashbackRules = [
    {
      tenantId: demoTenant.id,
      category: 'GENERAL',
      tier: 'SILVER',
      percentage: 2.0,
      description: 'General purchases - Silver tier'
    },
    {
      tenantId: demoTenant.id,
      category: 'GENERAL',
      tier: 'GOLD',
      percentage: 3.0,
      description: 'General purchases - Gold tier'
    },
    {
      tenantId: demoTenant.id,
      category: 'GENERAL',
      tier: 'PLATINUM',
      percentage: 5.0,
      description: 'General purchases - Platinum tier'
    },
    {
      tenantId: demoTenant.id,
      category: 'ELECTRONICS',
      tier: 'SILVER',
      percentage: 3.0,
      description: 'Electronics - Silver tier'
    },
    {
      tenantId: demoTenant.id,
      category: 'ELECTRONICS',
      tier: 'GOLD',
      percentage: 4.0,
      description: 'Electronics - Gold tier'
    },
    {
      tenantId: demoTenant.id,
      category: 'ELECTRONICS',
      tier: 'PLATINUM',
      percentage: 6.0,
      description: 'Electronics - Platinum tier'
    }
  ];

  for (const ruleData of cashbackRules) {
    const existingRule = await prisma.cashbackRule.findFirst({
      where: {
        tenantId: ruleData.tenantId,
        category: ruleData.category,
        tier: ruleData.tier
      }
    });

    if (!existingRule) {
      await prisma.cashbackRule.create({
        data: ruleData
      });
      console.log(`✅ Created cashback rule: ${ruleData.category} - ${ruleData.tier}`);
    } else {
      console.log(`ℹ️  Cashback rule already exists: ${ruleData.category} - ${ruleData.tier}`);
    }
  }

  // Create sample customers and cards
  console.log('👨‍👩‍👧‍👦 Creating sample customers and cards...');
  const sampleCustomers = [
    {
      name: 'John Smith',
      email: 'john.smith@email.com',
      phone: '+1-555-0101',
      tier: 'SILVER' as const
    },
    {
      name: 'Sarah Johnson',
      email: 'sarah.johnson@email.com',
      phone: '+1-555-0102',
      tier: 'GOLD' as const
    },
    {
      name: 'Mike Wilson',
      email: 'mike.wilson@email.com',
      phone: '+1-555-0103',
      tier: 'PLATINUM' as const
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
          tenantId: demoTenant.id,
          balance: customerData.tier === 'SILVER' ? 1500 : 
                  customerData.tier === 'GOLD' ? 2500 : 5000, // in cents
          totalSpent: customerData.tier === 'SILVER' ? 15000 : 
                     customerData.tier === 'GOLD' ? 35000 : 75000, // in cents
        }
      });

      // Create a card for this customer
      const cardUid = `DEMO${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
      await prisma.card.create({
        data: {
          uid: cardUid,
          tenantId: demoTenant.id,
          storeId: demoStore.id,
          customerId: customer.id,
          status: 'ACTIVE',
          activatedAt: new Date(),
          qrCode: `${process.env.FRONTEND_URL}/card/${cardUid}`
        }
      });

      console.log(`✅ Created customer: ${customerData.name} with card: ${cardUid}`);
    } else {
      console.log(`ℹ️  Customer already exists: ${customerData.name}`);
    }
  }

  console.log('🎉 Database seed completed successfully!');
  console.log('');
  console.log('📝 Demo Accounts Created:');
  console.log('  Platform Admin: admin@platform.com / AdminSecure123!');
  console.log('  Store Admin: admin@demo.com / DemoAdmin123!');
  console.log('  Cashier: cashier@demo.com / DemoCashier123!');
  console.log('');
  console.log('🏢 Demo Tenant: demo.localhost (or demo subdomain)');
  console.log('💳 Sample cards have been created for testing');
  console.log('💰 Cashback rules configured for all tiers');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
