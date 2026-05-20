import { Hono } from 'hono';
import { z } from 'zod';
import type { Bindings } from '../types';
import { hashDeviceId } from '../lib/deviceHash';
import {
  db,
  findDevice,
  findLicenseById,
  logEvent,
} from '../lib/db';
import { getStripe } from '../lib/stripe';
import { buildLicenseToken, refreshLicenseStatusInDb } from '../lib/license';
import { badRequest, notFound, ok } from '../lib/responses';

export const checkoutRoutes = new Hono<{ Bindings: Bindings }>();

const StripeCheckoutBody = z.object({
  deviceId: z.string().min(8).max(256),
  locale: z.enum(['de', 'en']).optional().default('de'),
});

checkoutRoutes.post('/stripe', async (c) => {
  const json = await c.req.json().catch(() => null);
  const parsed = StripeCheckoutBody.safeParse(json);
  if (!parsed.success) {
    return badRequest(c, 'invalid_body', parsed.error.issues[0]?.message ?? 'invalid body');
  }
  const env = c.env;
  const stripe = getStripe(env);

  const deviceIdHash = await hashDeviceId(parsed.data.deviceId, env.APP_DEVICE_SALT);
  const device = await findDevice(db(env), deviceIdHash);
  if (!device || !device.license_id) {
    return notFound(c, 'no_license_for_device');
  }
  const license = await findLicenseById(db(env), device.license_id);
  if (!license) return notFound(c, 'license_not_found');

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: env.STRIPE_PRICE_ID, quantity: 1 }],
    success_url: `${env.API_URL}/v1/checkout/done?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.WEB_URL}/checkout-cancelled?locale=${parsed.data.locale}`,
    locale: parsed.data.locale === 'en' ? 'en' : 'de',
    automatic_tax: { enabled: true },
    tax_id_collection: { enabled: true },
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    customer_creation: 'always',
    metadata: {
      licenseId: license.id,
      deviceIdHash,
    },
    subscription_data: {
      metadata: {
        licenseId: license.id,
        deviceIdHash,
      },
    },
  });

  await logEvent(
    db(env),
    'checkout_session_created',
    { sessionId: session.id, locale: parsed.data.locale },
    { license_id: license.id, device_id_hash: deviceIdHash },
  );

  return ok(c, { url: session.url, sessionId: session.id });
});

// Stripe redirect-Ziel nach erfolgreichem Payment.
// Wir bauen Token + redirecten in den Deep-Link `billsorter://license?token=…`.
checkoutRoutes.get('/done', async (c) => {
  const sessionId = c.req.query('session_id');
  if (!sessionId) return badRequest(c, 'missing_session_id', 'session_id missing');
  const env = c.env;
  const stripe = getStripe(env);

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription', 'customer'],
  });

  const licenseId =
    (session.metadata?.licenseId as string | undefined) ??
    (typeof session.subscription === 'object' &&
    session.subscription &&
    'metadata' in session.subscription
      ? ((session.subscription.metadata as Record<string, string>).licenseId as string)
      : undefined);

  if (!licenseId) {
    return c.html(renderErrorPage('Session ohne licenseId — bitte Support kontaktieren.'), 500);
  }
  const license = await findLicenseById(db(env), licenseId);
  if (!license) return notFound(c, 'license_not_found');

  const deviceIdHash =
    (session.metadata?.deviceIdHash as string | undefined) ?? null;
  if (!deviceIdHash) {
    return c.html(renderErrorPage('Session ohne deviceIdHash.'), 500);
  }

  // Webhook hat den Status idealerweise schon auf 'active' gesetzt.
  // Falls Webhook noch nicht durch ist, returnen wir den aktuellen Stand.
  const effectiveStatus = await refreshLicenseStatusInDb(db(env), license);
  const token = await buildLicenseToken(env, license, deviceIdHash, effectiveStatus);

  await logEvent(
    db(env),
    'checkout_done_visited',
    { sessionId, status: session.status, effectiveStatus },
    { license_id: license.id, device_id_hash: deviceIdHash },
  );

  const deepLink = `${env.APP_DEEP_LINK_SCHEME}://license?token=${encodeURIComponent(token ?? '')}&status=${effectiveStatus}`;
  return c.html(renderSuccessPage(deepLink, env.WEB_URL));
});

// ───── HTML helpers ─────

const renderSuccessPage = (deepLink: string, webUrl: string): string => `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>BillSorter — Aktiviert</title>
<style>
  body{font-family:Inter,system-ui,sans-serif;margin:0;background:#fafafa;color:#0f172a;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:48px;max-width:480px;text-align:center;box-shadow:0 4px 24px rgba(108,43,217,.08)}
  .badge{display:inline-block;background:#6C2BD9;color:#fff;font-size:12px;padding:6px 12px;border-radius:999px;letter-spacing:.05em;text-transform:uppercase;margin-bottom:24px}
  h1{font-size:24px;margin:0 0 12px}
  p{color:#475569;line-height:1.6;margin:0 0 16px}
  a.btn{display:inline-block;background:#6C2BD9;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600;margin-top:8px}
  .muted{font-size:13px;color:#94a3b8;margin-top:24px}
</style>
<script>
  // Auto-Redirect zum Deep-Link nach 800ms.
  setTimeout(function(){ window.location.href = ${JSON.stringify(deepLink)}; }, 800);
</script>
</head>
<body>
  <div class="card">
    <span class="badge">Aktiviert</span>
    <h1>Zahlung erfolgreich</h1>
    <p>BillSorter wird gleich automatisch geöffnet. Falls nicht, klicke unten.</p>
    <a class="btn" href="${deepLink}">BillSorter öffnen</a>
    <p class="muted">Du kannst dieses Fenster danach schließen.<br>
      <a href="${webUrl}" style="color:#6C2BD9">${webUrl}</a></p>
  </div>
</body></html>`;

const renderErrorPage = (msg: string): string => `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>BillSorter — Fehler</title>
<style>
  body{font-family:Inter,system-ui,sans-serif;margin:0;background:#fafafa;color:#0f172a;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
  .card{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:48px;max-width:480px;text-align:center}
</style></head>
<body><div class="card"><h1>Da ist etwas schiefgelaufen</h1><p>${msg}</p></div></body></html>`;
