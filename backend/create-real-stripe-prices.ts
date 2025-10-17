import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });

async function createRealStripeProductsAndPrices() {
  try {

    // Create a product for our Premium plan (Free trial doesn't need Stripe product)
    const product = await stripe.products.create({
      name: 'QR Cashback Loyalty System - Premium',
      description: 'Unlimited card activations and full features for QR cashback loyalty system',
    });


    // Get only Premium plan from database (Free trial doesn't need Stripe price)
    const premiumPlan = await prisma.plan.findFirst({
      where: { 
        name: 'Premium',
        isActive: true 
      }
    });

    if (!premiumPlan) {
      process.exit(1);
    }

    // Create price for Premium plan only
    try {
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: Math.round(premiumPlan.priceMonthly * 100), // Convert to cents
        currency: 'usd',
        recurring: {
          interval: 'month',
        },
        nickname: `${premiumPlan.name} Monthly`,
      });


      // Update the Premium plan in database
      await prisma.plan.update({
        where: { id: premiumPlan.id },
        data: { stripePriceId: price.id }
      });

    } catch (error: any) {
      console.error(`❌ Failed to create price for ${premiumPlan.name}:`, error.message);
    }

    const updatedPlans = await prisma.plan.findMany({
      where: { isActive: true },
      select: { name: true, priceMonthly: true, stripePriceId: true }
    });

    updatedPlans.forEach(plan => {
      if (plan.name === 'Free Trial') {
      } else {
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Check if Stripe is configured
if (!process.env.STRIPE_SECRET_KEY) {
  process.exit(1);
}

if (process.env.STRIPE_SECRET_KEY.startsWith('sk_test_') || process.env.STRIPE_SECRET_KEY.startsWith('sk_live_')) {
  createRealStripeProductsAndPrices();
} else {
  process.exit(1);
}
