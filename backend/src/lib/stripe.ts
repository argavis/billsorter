// Stripe SDK initialisieren — Workers brauchen httpClient: createFetchHttpClient.

import Stripe from 'stripe';
import type { Bindings } from '../types';

let cached: Stripe | null = null;

export const getStripe = (env: Pick<Bindings, 'STRIPE_SECRET_KEY'>): Stripe => {
  if (cached) return cached;
  cached = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-12-18.acacia',
    httpClient: Stripe.createFetchHttpClient(),
  });
  return cached;
};

export const verifyStripeWebhook = async (
  env: Bindings,
  payload: string,
  sigHeader: string,
): Promise<Stripe.Event> => {
  const stripe = getStripe(env);
  // constructEventAsync für Workers (SubtleCrypto ist async).
  return stripe.webhooks.constructEventAsync(
    payload,
    sigHeader,
    env.STRIPE_WEBHOOK_SECRET,
  );
};
