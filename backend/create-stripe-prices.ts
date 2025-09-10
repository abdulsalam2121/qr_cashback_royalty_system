// Temporary script to create Stripe prices for testing
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });

async function createTestPrices() {
  try {
    console.log('Creating Stripe test prices...');

    // Create products first
    const starterProduct = await stripe.products.create({
      name: 'Starter Plan',
      description: 'Perfect for small businesses',
    });

    const proProduct = await stripe.products.create({
      name: 'Professional Plan', 
      description: 'Advanced features for growing businesses',
    });

    const enterpriseProduct = await stripe.products.create({
      name: 'Enterprise Plan',
      description: 'Complete solution for large businesses',
    });

    // Create prices
    const starterPrice = await stripe.prices.create({
      product: starterProduct.id,
      unit_amount: 1999, // $19.99
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
    });

    const proPrice = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: 4999, // $49.99
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
    });

    const enterprisePrice = await stripe.prices.create({
      product: enterpriseProduct.id,
      unit_amount: 9999, // $99.99
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
    });

    console.log('✅ Created Stripe prices:');
    console.log(`Starter Price ID: ${starterPrice.id}`);
    console.log(`Pro Price ID: ${proPrice.id}`);
    console.log(`Enterprise Price ID: ${enterprisePrice.id}`);

    console.log('\n📋 Update your seed.ts file with these price IDs:');
    console.log(`stripePriceId: '${starterPrice.id}', // Starter`);
    console.log(`stripePriceId: '${proPrice.id}', // Pro`);
    console.log(`stripePriceId: '${enterprisePrice.id}', // Enterprise`);

  } catch (error) {
    console.error('Error creating Stripe prices:', error);
  }
}

createTestPrices();
