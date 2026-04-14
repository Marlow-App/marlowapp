import { getStripeSync, getUncachableStripeClient } from './stripeClient';
import { storage } from '../storage';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        'STRIPE WEBHOOK ERROR: Payload must be a Buffer. ' +
        'Received type: ' + typeof payload + '. ' +
        'Ensure webhook route is registered BEFORE app.use(express.json()).'
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);

    // Handle subscription lifecycle events
    try {
      const stripe = await getUncachableStripeClient();
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (!webhookSecret) return;

      const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

      if (
        event.type === 'customer.subscription.created' ||
        event.type === 'customer.subscription.updated'
      ) {
        const subscription = event.data.object as any;
        const customerId = subscription.customer as string;
        const userId = subscription.metadata?.userId;

        const resolvedUserId = userId || (await storage.getUserByStripeCustomerId(customerId))?.id;
        if (!resolvedUserId) return;

        const isActive = subscription.status === 'active' || subscription.status === 'trialing';
        const periodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : null;
        const isCanceling = isActive && subscription.cancel_at_period_end === true;

        await storage.updateUserSubscription(resolvedUserId, {
          subscriptionTier: isActive ? 'pro' : 'free',
          subscriptionStatus: isCanceling ? 'canceling' : subscription.status,
          stripeSubscriptionId: subscription.id,
          subscriptionPeriodEnd: periodEnd,
        });

        console.log(`[Stripe] Subscription ${event.type} for user ${resolvedUserId}: ${subscription.status}`);
      }

      if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object as any;
        const customerId = subscription.customer as string;
        const userId = subscription.metadata?.userId;

        const resolvedUserId = userId || (await storage.getUserByStripeCustomerId(customerId))?.id;
        if (!resolvedUserId) return;

        await storage.updateUserSubscription(resolvedUserId, {
          subscriptionTier: 'free',
          subscriptionStatus: 'canceled',
          stripeSubscriptionId: subscription.id,
          subscriptionPeriodEnd: null,
        });

        console.log(`[Stripe] Subscription canceled for user ${resolvedUserId}`);
      }
    } catch (err) {
      console.error('Subscription webhook processing error:', err);
    }
  }
}
