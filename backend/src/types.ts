import type { D1Database } from '@cloudflare/workers-types';

export type Bindings = {
  DB: D1Database;

  // Vars
  ENVIRONMENT: 'development' | 'production';
  WEB_URL: string;
  API_URL: string;
  APP_DEEP_LINK_SCHEME: string;
  TRIAL_DAYS: string;
  GRACE_DAYS: string;
  PLAN_INTERVAL_DAYS: string;

  // Secrets (wrangler secret put)
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_ID: string;
  JWT_PRIVATE_KEY_PEM: string;
  JWT_PUBLIC_KEY_PEM: string;
  APP_DEVICE_SALT: string;
  ADMIN_TOKEN: string;
  ANTHROPIC_API_KEY: string;

  // MOCO (Rechnungs-Automatik nach Stripe-Zahlung) — gleicher Account wie SALIO.
  // MOCO erstellt UND verschickt die Rechnung selbst per Mail an den Kunden.
  MOCO_SUBDOMAIN?: string;
  MOCO_API_KEY?: string;
};

export type LicenseStatus = 'trial' | 'active' | 'grace' | 'expired' | 'revoked';

export type LicenseRow = {
  id: string;
  user_id: string | null;
  plan: string;
  status: LicenseStatus;
  provider: 'stripe' | 'paypal' | null;
  provider_sub_id: string | null;
  provider_customer_id: string | null;
  trial_ends_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export type UserRow = {
  id: string;
  email: string | null;
  email_hash: string | null;
  stripe_customer_id: string | null;
  locale: string;
  created_at: string;
  updated_at: string;
};

export type DeviceRow = {
  device_id_hash: string;
  license_id: string | null;
  first_seen_at: string;
  last_check_at: string;
  app_version: string | null;
  os: string | null;
  locale: string | null;
};

export type LicenseCheckResponse = {
  status: LicenseStatus;
  expiresAt: string;
  trialEndsAt: string | null;
  graceDays: number;
  token: string | null;
};
