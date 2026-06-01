// Idempotentes Stripe-Setup für BillSorter.
// Legt Produkt + Price + Webhook-Endpoint NUR an, wenn sie noch nicht existieren.
// Bestehende Webhook-Endpoints mit korrekter URL werden auf die Soll-Events aktualisiert.
//
// Ausführen (Key bleibt bei dir, niemals committen):
//   STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-setup.mjs
//
// Optional nur anzeigen, nichts ändern:
//   STRIPE_SECRET_KEY=sk_live_... DRY_RUN=1 node scripts/stripe-setup.mjs

import Stripe from 'stripe';

const KEY = process.env.STRIPE_SECRET_KEY;
const DRY_RUN = process.env.DRY_RUN === '1';

if (!KEY) {
  console.error('FEHLER: STRIPE_SECRET_KEY env fehlt.');
  process.exit(1);
}

const stripe = new Stripe(KEY);

const PRODUCT_NAME = 'BillSorter Pro — Monatliches Abonnement';
const PRICE_AMOUNT = 699; // 6,99 EUR in Cent (netto, tax_behavior=exclusive)
const PRICE_CURRENCY = 'eur';
const WEBHOOK_URL = 'https://api.billsorter.app/webhooks/stripe';
const EVENTS = [
  'invoice.paid',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'customer.subscription.deleted',
  'checkout.session.completed',
  'charge.refunded',
];

const log = (...a) => console.log(...a);
const arraysEqual = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

async function ensureProduct() {
  const list = await stripe.products.list({ active: true, limit: 100 });
  const existing = list.data.find((p) => p.name === PRODUCT_NAME);
  if (existing) {
    log(`✓ Produkt existiert: ${existing.id} ("${existing.name}")`);
    return existing;
  }
  if (DRY_RUN) {
    log(`[dry-run] würde Produkt anlegen: "${PRODUCT_NAME}"`);
    return null;
  }
  const created = await stripe.products.create({
    name: PRODUCT_NAME,
    description: 'Automatische Rechnungs-Erkennung und Monatsordner-Ablage per E-Mail-Scan.',
  });
  log(`+ Produkt angelegt: ${created.id}`);
  return created;
}

async function ensurePrice(product) {
  if (!product) {
    log('[dry-run] überspringe Price (kein Produkt).');
    return null;
  }
  const list = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
  const existing = list.data.find(
    (p) =>
      p.unit_amount === PRICE_AMOUNT &&
      p.currency === PRICE_CURRENCY &&
      p.recurring?.interval === 'month',
  );
  if (existing) {
    log(`✓ Price existiert: ${existing.id} (${(existing.unit_amount / 100).toFixed(2)} ${existing.currency.toUpperCase()} / Monat, tax_behavior=${existing.tax_behavior})`);
    return existing;
  }
  if (DRY_RUN) {
    log('[dry-run] würde Price anlegen: 6.99 EUR/Monat netto (exclusive)');
    return null;
  }
  const created = await stripe.prices.create({
    product: product.id,
    unit_amount: PRICE_AMOUNT,
    currency: PRICE_CURRENCY,
    recurring: { interval: 'month' },
    tax_behavior: 'exclusive', // 6,99 ist NETTO; automatic_tax schlägt MwSt oben drauf
  });
  log(`+ Price angelegt: ${created.id}`);
  return created;
}

async function ensureWebhook() {
  const list = await stripe.webhookEndpoints.list({ limit: 100 });

  // Stale Endpoints (alte/falsche URL) melden — nicht automatisch löschen.
  const stale = list.data.filter(
    (w) => w.url !== WEBHOOK_URL && /billsorter\.(de|app)/.test(w.url),
  );
  for (const w of stale) {
    log(`! Hinweis: bestehender Webhook mit abweichender URL: ${w.id} → ${w.url} (Status: ${w.status}). Bei Bedarf im Dashboard prüfen/deaktivieren.`);
  }

  const existing = list.data.find((w) => w.url === WEBHOOK_URL);
  if (existing) {
    if (arraysEqual(existing.enabled_events, EVENTS)) {
      log(`✓ Webhook existiert mit korrekten Events: ${existing.id}`);
      return existing;
    }
    if (DRY_RUN) {
      log(`[dry-run] würde Webhook-Events aktualisieren: ${existing.id}`);
      return existing;
    }
    const updated = await stripe.webhookEndpoints.update(existing.id, { enabled_events: EVENTS });
    log(`~ Webhook-Events aktualisiert: ${updated.id}`);
    log('  (Signing-Secret unverändert — bestehendes STRIPE_WEBHOOK_SECRET bleibt gültig.)');
    return updated;
  }

  if (DRY_RUN) {
    log(`[dry-run] würde Webhook anlegen: ${WEBHOOK_URL}`);
    return null;
  }
  const created = await stripe.webhookEndpoints.create({
    url: WEBHOOK_URL,
    enabled_events: EVENTS,
    description: 'BillSorter production webhook',
  });
  log(`+ Webhook angelegt: ${created.id}`);
  log('');
  log('  WICHTIG — Signing-Secret als CF-Secret setzen:');
  log(`    echo "${created.secret}" | npx wrangler secret put STRIPE_WEBHOOK_SECRET --env production`);
  return created;
}

(async () => {
  log(`== BillSorter Stripe-Setup ==${DRY_RUN ? ' (DRY RUN)' : ''}`);
  log(`Key-Modus: ${KEY.startsWith('sk_live') ? 'LIVE' : 'TEST'}`);
  log('');
  const product = await ensureProduct();
  const price = await ensurePrice(product);
  await ensureWebhook();
  log('');
  if (price?.id) {
    log('Nächster Schritt: STRIPE_PRICE_ID-Secret prüfen/setzen, falls abweichend:');
    log(`    echo "${price.id}" | npx wrangler secret put STRIPE_PRICE_ID --env production`);
  }
  log('Fertig.');
})().catch((err) => {
  console.error('Stripe-Setup fehlgeschlagen:', err?.message ?? err);
  process.exit(1);
});
