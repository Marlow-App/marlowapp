import { getUncachableStripeClient } from './stripeClient';

async function createProducts() {
  const stripe = await getUncachableStripeClient();

  const existingProducts = await stripe.products.list({ limit: 100 });
  const existingNames = existingProducts.data.map(p => p.name);

  if (!existingNames.includes('Pro Plan')) {
    const proProduct = await stripe.products.create({
      name: 'Pro Plan',
      description: '3 recordings per day with priority feedback',
      metadata: {
        tier: 'pro',
        daily_limit: '3',
      },
    });

    const proPrice = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: 799,
      currency: 'usd',
      recurring: { interval: 'month' },
    });

    console.log(`Created Pro Plan: ${proProduct.id}, Price: ${proPrice.id}`);
  } else {
    console.log('Pro Plan already exists, skipping.');
  }

  const legacyNames = ['Pro Starter', 'Pro Max'];
  for (const name of legacyNames) {
    const legacy = existingProducts.data.find(p => p.name === name && p.active);
    if (legacy) {
      await stripe.products.update(legacy.id, { active: false });
      console.log(`Archived legacy product: ${name} (${legacy.id})`);
    }
  }

  console.log('Done seeding products!');
}

createProducts().catch(console.error);
