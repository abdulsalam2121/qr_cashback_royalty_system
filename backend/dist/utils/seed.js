import { PrismaClient, Prisma, SubscriptionStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
async function main() {
    console.log('🌱 Starting database seeding...');
    // ------------------------------------------------------------
    // 1) CREATE DEFAULT PLANS
    // ------------------------------------------------------------
    console.log('📋 Creating subscription plans...');
    const plans = [
        {
            name: 'Starter Plan',
            description: 'Perfect for small businesses - unlimited card activations after trial',
            priceMonthly: 1999, // $19.99
            billingPeriod: 'MONTHLY',
            billingPeriodMultiplier: 1,
            stripePriceId: process.env.STRIPE_PRICE_ID_BASIC || 'price_starter',
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
            billingPeriod: 'MONTHLY',
            billingPeriodMultiplier: 1,
            stripePriceId: process.env.STRIPE_PRICE_ID_PRO || 'price_pro',
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
            console.log(`✅ Created plan: ${planData.name}`);
        }
        else {
            console.log(`⏭️  Plan already exists: ${planData.name}`);
        }
    }
    // ------------------------------------------------------------
    // 2) PLATFORM TENANT (for platform_admin user attachment)
    // ------------------------------------------------------------
    console.log('🏗️  Creating platform tenant...');
    const platformTenant = await prisma.tenant.upsert({
        where: { slug: 'platform' },
        update: {},
        create: {
            slug: 'platform',
            name: 'Platform Administration',
            subscriptionStatus: SubscriptionStatus.NONE,
            planId: null,
        },
    });
    console.log('✅ Platform tenant ready');
    // ------------------------------------------------------------
    // 3) PLATFORM ADMIN USER
    // ------------------------------------------------------------
    console.log('👤 Creating platform admin user...');
    const platformAdmin = await prisma.user.upsert({
        where: { email: 'admin@platform.com' },
        update: {},
        create: {
            email: 'admin@platform.com',
            firstName: 'Platform',
            lastName: 'Administrator',
            passwordHash: await bcrypt.hash('AdminSecure123!', 12),
            role: 'platform_admin',
            tenantId: platformTenant.id,
        },
    });
    console.log('✅ Platform admin created: admin@platform.com / AdminSecure123!');
    // ------------------------------------------------------------
    // 4) DEMO TENANT (ACTIVE SUBSCRIPTION)
    // ------------------------------------------------------------
    console.log('🏪 Creating demo tenant...');
    const demoTenant = await prisma.tenant.upsert({
        where: { slug: 'demo-store' },
        update: {},
        create: {
            name: 'Demo Electronics Store',
            slug: 'demo-store',
            planId: null,
            subscriptionStatus: SubscriptionStatus.ACTIVE,
            stripeCustomerId: null, // Will be created when needed
            stripeSubscriptionId: null,
            freeTrialActivations: 0,
            freeTrialCardsCreated: 0,
            freeTrialLimit: 50,
        },
    });
    console.log('✅ Demo tenant created');
    // Create demo store location
    const demoStore = await prisma.store.upsert({
        where: { id: `${demoTenant.id}-main` },
        update: {},
        create: {
            id: `${demoTenant.id}-main`,
            tenantId: demoTenant.id,
            name: 'Demo Store - Main Branch',
            address: '123 Demo Street, Demo City, DC 12345',
            active: true,
        },
    });
    console.log('✅ Demo store location created');
    // Create demo tenant admin
    const demoAdmin = await prisma.user.upsert({
        where: { email: 'admin@demo.com' },
        update: {},
        create: {
            email: 'admin@demo.com',
            firstName: 'Demo',
            lastName: 'Administrator',
            passwordHash: await bcrypt.hash('DemoAdmin123!', 12),
            role: 'tenant_admin',
            tenantId: demoTenant.id,
        },
    });
    console.log('✅ Demo admin created: admin@demo.com / DemoAdmin123!');
    // Create demo cashier
    const demoCashier = await prisma.user.upsert({
        where: { email: 'cashier@demo.com' },
        update: {},
        create: {
            email: 'cashier@demo.com',
            firstName: 'Demo',
            lastName: 'Cashier',
            passwordHash: await bcrypt.hash('DemoCashier123!', 12),
            role: 'cashier',
            tenantId: demoTenant.id,
            storeId: demoStore.id,
        },
    });
    console.log('✅ Demo cashier created: cashier@demo.com / DemoCashier123!');
    // Create demo customer
    const demoCustomer = await prisma.customer.upsert({
        where: { email: 'customer@demo.com' },
        update: {},
        create: {
            tenantId: demoTenant.id,
            firstName: 'John',
            lastName: 'Customer',
            email: 'customer@demo.com',
            phone: '+1234567890',
            tier: 'SILVER',
            totalSpend: new Prisma.Decimal(150.00),
        },
    });
    console.log('✅ Demo customer created');
    // ------------------------------------------------------------
    // 5) DEFAULT CASHBACK AND TIER RULES
    // ------------------------------------------------------------
    console.log('⚙️  Setting up default business rules...');
    // Create default tier rules
    const tierRules = [
        { tier: 'SILVER', name: 'Silver Tier', minTotalSpendCents: 0, baseRateBps: 200 },
        { tier: 'GOLD', name: 'Gold Tier', minTotalSpendCents: 50000, baseRateBps: 300 },
        { tier: 'PLATINUM', name: 'Platinum Tier', minTotalSpendCents: 200000, baseRateBps: 500 },
    ];
    for (const ruleData of tierRules) {
        const existingRule = await prisma.tierRule.findFirst({
            where: {
                tenantId: demoTenant.id,
                tier: ruleData.tier
            }
        });
        if (!existingRule) {
            await prisma.tierRule.create({
                data: {
                    tenantId: demoTenant.id,
                    tier: ruleData.tier,
                    name: ruleData.name,
                    minTotalSpendCents: ruleData.minTotalSpendCents,
                    baseRateBps: ruleData.baseRateBps,
                }
            });
            console.log(`✅ Created tier rule: ${ruleData.tier}`);
        }
    }
    // Create default cashback rules
    const cashbackRules = [
        { category: 'PURCHASE', baseRateBps: 250 }, // 2.5%
        { category: 'REPAIR', baseRateBps: 200 }, // 2.0%
        { category: 'OTHER', baseRateBps: 150 }, // 1.5%
    ];
    for (const ruleData of cashbackRules) {
        const existingRule = await prisma.cashbackRule.findFirst({
            where: {
                tenantId: demoTenant.id,
                category: ruleData.category
            }
        });
        if (!existingRule) {
            await prisma.cashbackRule.create({
                data: {
                    tenantId: demoTenant.id,
                    category: ruleData.category,
                    baseRateBps: ruleData.baseRateBps,
                    isActive: true,
                }
            });
            console.log(`✅ Created cashback rule: ${ruleData.category}`);
        }
    }
    // ------------------------------------------------------------
    // 6) SAMPLE DATA FOR DEMO
    // ------------------------------------------------------------
    console.log('📊 Creating sample demo data...');
    // Create a sample card for the demo customer
    const { nanoid } = await import('nanoid');
    const jwt = await import('jsonwebtoken');
    const cardUid = nanoid(12);
    const qrToken = jwt.sign({ cardUid, tenantId: demoTenant.id }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '365d' });
    const qrUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/c/${cardUid}?t=${qrToken}`;
    const demoCard = await prisma.card.upsert({
        where: { cardUid },
        update: {},
        create: {
            tenantId: demoTenant.id,
            cardUid,
            qrUrl,
            status: 'ACTIVE',
            customerId: demoCustomer.id,
            storeId: demoStore.id,
            balanceCents: 2500, // $25.00 demo balance
            activatedAt: new Date(),
        },
    });
    console.log(`✅ Demo card created: ${cardUid}`);
    // Create sample transactions
    const sampleTransactions = [
        {
            type: 'EARN',
            category: 'PURCHASE',
            amountCents: 5000, // $50.00
            cashbackCents: 100, // $1.00 (2% for silver)
            note: 'Phone accessories purchase'
        },
        {
            type: 'EARN',
            category: 'REPAIR',
            amountCents: 8000, // $80.00
            cashbackCents: 120, // $1.20 (1.5% for silver)
            note: 'Screen repair service'
        },
        {
            type: 'REDEEM',
            category: 'OTHER',
            amountCents: 500, // $5.00
            cashbackCents: 0,
            note: 'Cashback redemption'
        }
    ];
    let currentBalance = 0;
    for (const [index, txData] of sampleTransactions.entries()) {
        const beforeBalance = currentBalance;
        const afterBalance = txData.type === 'EARN'
            ? currentBalance + txData.cashbackCents
            : currentBalance - txData.amountCents;
        await prisma.transaction.create({
            data: {
                tenantId: demoTenant.id,
                storeId: demoStore.id,
                cardId: demoCard.id,
                customerId: demoCustomer.id,
                cashierId: demoCashier.id,
                type: txData.type,
                category: txData.category,
                amountCents: txData.amountCents,
                cashbackCents: txData.cashbackCents,
                beforeBalanceCents: beforeBalance,
                afterBalanceCents: afterBalance,
                note: txData.note,
                sourceIp: '127.0.0.1',
                createdAt: new Date(Date.now() - (sampleTransactions.length - index) * 24 * 60 * 60 * 1000)
            },
        });
        currentBalance = afterBalance;
        console.log(`✅ Created sample transaction: ${txData.type} - ${txData.note}`);
    }
    // Update card balance to match final transaction state
    await prisma.card.update({
        where: { id: demoCard.id },
        data: { balanceCents: 2720 } // Final calculated balance
    });
    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📋 Demo Credentials:');
    console.log('Platform Admin: admin@platform.com / AdminSecure123!');
    console.log('Demo Store Admin: admin@demo.com / DemoAdmin123!');
    console.log('Demo Cashier: cashier@demo.com / DemoCashier123!');
    console.log(`Demo Customer Card: ${cardUid}`);
    console.log(`Demo Store Slug: demo-store`);
    console.log('\n🚀 System is ready for deployment!');
    // Continue with more seed data
    const card1 = await prisma.card.upsert({
        where: { cardUid: 'CARD-ALPHA-001' },
        update: {},
        create: {
            tenantId: demoTenant.id,
            cardUid: 'CARD-ALPHA-001',
            customerId: demoCustomer.id,
            storeId: demoStore.id,
            status: 'ACTIVE',
            balanceCents: 1500, // $15.00
        },
    });
    await prisma.transaction.create({
        data: {
            tenantId: demoTenant.id,
            storeId: demoStore.id,
            cardId: card1.id,
            customerId: demoCustomer.id,
            cashierId: demoCashier.id,
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
            planId: null,
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
    // Add 35 cards to beta-repairs (close to limit)
    for (let i = 1; i <= 35; i++) {
        await prisma.card.upsert({
            where: { cardUid: `BETA-CARD-${i.toString().padStart(3, '0')}` },
            update: {},
            create: {
                tenantId: tenant2.id,
                cardUid: `BETA-CARD-${i.toString().padStart(3, '0')}`,
                storeId: store2.id,
                status: 'UNASSIGNED',
                balanceCents: 0,
            },
        });
    }
    // (optional) add more demo customers/cards/transactions to tenant2...
    // ------------------------------------------------------------
    // 4) TENANT #3: Gamma Electronics (TRIALING - EXCEEDED LIMIT)
    // ------------------------------------------------------------
    const tenant3 = await prisma.tenant.upsert({
        where: { slug: 'gamma-electronics' },
        update: {},
        create: {
            name: 'Gamma Electronics',
            slug: 'gamma-electronics',
            planId: null,
            subscriptionStatus: SubscriptionStatus.TRIALING,
            trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
    });
    const store3 = await prisma.store.upsert({
        where: { id: `${tenant3.id}-store-1` },
        update: {},
        create: {
            id: `${tenant3.id}-store-1`,
            tenantId: tenant3.id,
            name: 'Gamma Electronics Store',
            address: '789 Tech Ave',
            active: true,
        },
    });
    const tenantAdmin3 = await prisma.user.upsert({
        where: { email: 'owner@gamma.com' },
        update: {},
        create: {
            email: 'owner@gamma.com',
            passwordHash: await bcrypt.hash('TenantAdmin123!', 10),
            role: 'tenant_admin',
            tenantId: tenant3.id,
        },
    });
    // Add 45 cards to gamma-electronics (exceeded limit)
    for (let i = 1; i <= 45; i++) {
        await prisma.card.upsert({
            where: { cardUid: `GAMMA-CARD-${i.toString().padStart(3, '0')}` },
            update: {},
            create: {
                tenantId: tenant3.id,
                cardUid: `GAMMA-CARD-${i.toString().padStart(3, '0')}`,
                storeId: store3.id,
                status: 'UNASSIGNED',
                balanceCents: 0,
            },
        });
    }
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
//# sourceMappingURL=seed.js.map