import { PrismaClient, Prisma, SubscriptionStatus } from '@prisma/client';

import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // ------------------------------------------------------------
  // 0) PLATFORM TENANT (for platform_admin user attachment)
  // ------------------------------------------------------------
  const platformTenant = await prisma.tenant.upsert({
    where: { slug: 'platform' },
    update: {},
    create: {
      slug: 'platform',
      name: 'Platform (System Owner)',
      subscriptionStatus: SubscriptionStatus.NONE,
      planId: null,
    },
  });

  // ------------------------------------------------------------
  // 1) PLATFORM ADMIN (linked to platform tenant to satisfy schema)
  //    Your app logic should still treat role=platform_admin as global.
  // ------------------------------------------------------------
  const platformAdmin = await prisma.user.upsert({
    where: { email: 'platform@example.com' },
    update: {},
    create: {
      email: 'platform@example.com',
      passwordHash: await bcrypt.hash('AdminPass123!', 10),
      role: 'platform_admin',
      tenant: { connect: { id: platformTenant.id } }, // <-- attach required tenant
    },
  });

  // ------------------------------------------------------------
  // 2) TENANT #1: Alpha Phone Shop (ACTIVE)
  // ------------------------------------------------------------
  const tenant1 = await prisma.tenant.upsert({
    where: { slug: 'alpha-shop' },
    update: {},
    create: {
      name: 'Alpha Phone Shop',
      slug: 'alpha-shop',
      planId: 'basic',
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      stripeCustomerId: 'cus_demo123',
      stripeSubscriptionId: 'sub_demo123',
    },
  });

  const store1 = await prisma.store.upsert({
    where: { id: `${tenant1.id}-store-1` }, // synthetic stable key if you don't have uniques; else use create
    update: {},
    create: {
      id: `${tenant1.id}-store-1`,
      tenantId: tenant1.id,
      name: 'Alpha Main Branch',
      address: '123 Market Street',
      active: true,
    },
  });

  const tenantAdmin1 = await prisma.user.upsert({
    where: { email: 'owner@alpha.com' },
    update: {},
    create: {
      email: 'owner@alpha.com',
      passwordHash: await bcrypt.hash('TenantAdmin123!', 10),
      role: 'tenant_admin',
      tenantId: tenant1.id,
    },
  });

  const cashier1 = await prisma.user.upsert({
    where: { email: 'cashier@alpha.com' },
    update: {},
    create: {
      email: 'cashier@alpha.com',
      passwordHash: await bcrypt.hash('Cashier123!', 10),
      role: 'cashier',
      tenantId: tenant1.id,
      storeId: store1.id,
    },
  });

  const customer1 = await prisma.customer.upsert({
    where: { email: 'john@example.com' },
    update: {},
    create: {
      tenantId: tenant1.id,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '+123456789',
      tier: 'SILVER',
      totalSpend: new Prisma.Decimal(100), // optional
    },
  });

  const card1 = await prisma.card.upsert({
    where: { cardUid: 'CARD-ALPHA-001' },
    update: {},
    create: {
      tenantId: tenant1.id,
      cardUid: 'CARD-ALPHA-001',
      customerId: customer1.id,
      storeId: store1.id,
      status: 'ACTIVE',
      balanceCents: 1500, // $15.00
    },
  });

  await prisma.transaction.create({
    data: {
      tenantId: tenant1.id,
      storeId: store1.id,
      cardId: card1.id,
      customerId: customer1.id,
      cashierId: cashier1.id,
      type: 'EARN',
      category: 'PURCHASE',
      amountCents: 10000, // $100
      cashbackCents: 500, // $5
      beforeBalanceCents: 1000,
      afterBalanceCents: 1500,
    },
  });

  // ------------------------------------------------------------
  // 3) TENANT #2: Beta Mobile Repairs (TRIALING)
  // ------------------------------------------------------------
  const tenant2 = await prisma.tenant.upsert({
    where: { slug: 'beta-repairs' },
    update: {},
    create: {
      name: 'Beta Mobile Repairs',
      slug: 'beta-repairs',
      planId: 'pro',
      subscriptionStatus: SubscriptionStatus.TRIALING,
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  const store2 = await prisma.store.upsert({
    where: { id: `${tenant2.id}-store-1` },
    update: {},
    create: {
      id: `${tenant2.id}-store-1`,
      tenantId: tenant2.id,
      name: 'Beta Repair Center',
      address: '456 High Street',
      active: true,
    },
  });

  const tenantAdmin2 = await prisma.user.upsert({
    where: { email: 'owner@beta.com' },
    update: {},
    create: {
      email: 'owner@beta.com',
      passwordHash: await bcrypt.hash('TenantAdmin123!', 10),
      role: 'tenant_admin',
      tenantId: tenant2.id,
    },
  });

  // (optional) add more demo customers/cards/transactions to tenant2...

  console.log('🌱 Seed data created successfully');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
