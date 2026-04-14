import Stripe from 'stripe';

let connectionSettings: any;

async function fetchConnection(hostname: string, xReplitToken: string, environment: string) {
  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set('include_secrets', 'true');
  url.searchParams.set('connector_names', 'stripe');
  url.searchParams.set('environment', environment);

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'X_REPLIT_TOKEN': xReplitToken
    }
  });

  const data = await response.json();
  const settings = data.items?.[0];

  if (settings?.settings?.publishable && settings?.settings?.secret) {
    return settings;
  }
  return null;
}

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  const isProduction = process.env.REPLIT_DEPLOYMENT === '1';
  const targetEnvironment = isProduction ? 'production' : 'development';

  connectionSettings = await fetchConnection(hostname!, xReplitToken, targetEnvironment);

  if (!connectionSettings && isProduction) {
    console.log('Production Stripe connection not found, falling back to development connection');
    connectionSettings = await fetchConnection(hostname!, xReplitToken, 'development');
  }

  if (!connectionSettings) {
    throw new Error(`Stripe connection not found (tried ${targetEnvironment}${isProduction ? ' and development' : ''})`);
  }

  return {
    publishableKey: connectionSettings.settings.publishable,
    secretKey: connectionSettings.settings.secret,
  };
}

export async function getUncachableStripeClient() {
  const { secretKey } = await getCredentials();
  return new Stripe(secretKey, {
    apiVersion: '2025-08-27.basil' as any,
  });
}

export async function getStripePublishableKey() {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export async function getStripeSecretKey() {
  const { secretKey } = await getCredentials();
  return secretKey;
}

let stripeSync: any = null;

export async function getStripeSync() {
  if (!stripeSync) {
    const { StripeSync } = await import('stripe-replit-sync');
    const secretKey = await getStripeSecretKey();

    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL!,
        max: 2,
      },
      stripeSecretKey: secretKey,
    });
  }
  return stripeSync;
}
