import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });

async function createRealStripeProductsAndPrices() {
  try {
    console.log('🚀 Creating real Stripe products and prices...');

    // Create a product for our plans
    const product = await stripe.products.create({
      name: 'QR Cashback Loyalty System',
      description: 'QR code-based cashback and loyalty management system',
    });

    console.log(`✅ Created product: ${product.id}`);

    // Get all plans from database
    const plans = await prisma.plan.findMany({
      where: { isActive: true }
    });

    for (const plan of plans) {
      try {
        // Create price for this plan
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: Math.round(plan.priceMonthly * 100), // Convert to cents
          currency: 'usd',
          recurring: {
            interval: 'month',
          },
          nickname: `${plan.name} Monthly`,
        });

        console.log(`✅ Created price for ${plan.name}: ${price.id} ($${plan.priceMonthly}/month)`);

        // Update the plan in database
        await prisma.plan.update({
          where: { id: plan.id },
          data: { stripePriceId: price.id }
        });

        console.log(`✅ Updated plan ${plan.name} with price ID: ${price.id}`);
      } catch (error: any) {
        console.error(`❌ Failed to create price for ${plan.name}:`, error.message);
      }
    }

    console.log('\n🎉 All done! Updated plans:');
    const updatedPlans = await prisma.plan.findMany({
      where: { isActive: true },
      select: { name: true, priceMonthly: true, stripePriceId: true }
    });

    updatedPlans.forEach(plan => {
      console.log(`- ${plan.name}: $${plan.priceMonthly}/month -> ${plan.stripePriceId}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Check if Stripe is configured
if (!process.env.STRIPE_SECRET_KEY) {
  console.log('❌ STRIPE_SECRET_KEY not found. Using demo prices.');
  process.exit(1);
}

if (process.env.STRIPE_SECRET_KEY.startsWith('sk_test_') || process.env.STRIPE_SECRET_KEY.startsWith('sk_live_')) {
  createRealStripeProductsAndPrices();
} else {
  console.log('❌ Invalid Stripe secret key format. Using demo prices.');
  process.exit(1);
}
