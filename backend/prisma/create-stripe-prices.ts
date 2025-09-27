// Script to create Stripe prices for the 2-tier system
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });

async function createTestPrices() {
  try {
    console.log('Creating Stripe test prices for 2-tier system...');

    // Create product for Premium plan (Free trial doesn't need Stripe product)
    const premiumProduct = await stripe.products.create({
      name: 'Premium Plan',
      description: 'Unlimited card activations and features',
    });

    // Create price for Premium plan ($20/month)
    const premiumPrice = await stripe.prices.create({
      product: premiumProduct.id,
      unit_amount: 2000, // $20.00
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
    });

    console.log('✅ Created Stripe prices:');
    console.log(`Premium Price ID: ${premiumPrice.id}`);

    console.log('\n📋 Update your seed.ts file with this price ID:');
    console.log(`stripePriceId: '${premiumPrice.id}', // Premium`);

  } catch (error) {
    console.error('Error creating Stripe prices:', error);
  }
}

createTestPrices();
