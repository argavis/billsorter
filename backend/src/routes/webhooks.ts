import { Hono } from 'hono';
import type { ExecutionContext } from '@cloudflare/workers-types';
import type Stripe from 'stripe';
import type { Bindings } from '../types';
import { getStripe, verifyStripeWebhook } from '../lib/stripe';
import {
  addDays,
  db,
  findLicenseById,
  findLicenseBySubscription,
  findUserByStripeCustomer,
  insertUser,
  logEvent,
  markWebhookProcessed,
  markWebhookSeen,
  recordMocoInvoice,
  revokeLicense,
  setUserEmail,
  setUserStripeCustomer,
  updateLicenseProvider,
  updateLicenseStatus,
  uuid,
  wasMocoInvoiceCreated,
  wasWebhookProcessed,
} from '../lib/db';
import {
  createBillSorterInvoice,
  getOrCreateCustomer,
  sendInvoiceViaMoco,
} from '../lib/moco';
import { hashEmail } from '../lib/deviceHash';
import { badRequest, ok, unauthorized } from '../lib/responses';

export const webhookRoutes = new Hono<{ Bindings: Bindings }>();

webhookRoutes.post('/stripe', async (c) => {
  const sig = c.req.header('stripe-signature');
  if (!sig) return unauthorized(c, 'missing_signature');
  const env = c.env;

  const payload = await c.req.text();
  let event: Stripe.Event;
  try {
    event = await verifyStripeWebhook(env, payload, sig);
  } catch (err) {
    return badRequest(c, 'invalid_signature', (err as Error).message);
  }

  // Dedup
  if (await wasWebhookProcessed(db(env), event.id)) {
    return ok(c, { received: true, deduped: true });
  }
  await markWebhookSeen(db(env), event.id, 'stripe', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutCompleted(env, event.data.object as Stripe.Checkout.Session);
        break;
      }
      // Stripe feuert je nach Konfiguration invoice.paid und/oder
      // invoice.payment_succeeded — beide auf denselben Handler. Die MOCO-Dedup
      // pro Stripe-Invoice-ID verhindert doppelte Rechnungen.
      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        await handleInvoicePaid(env, event.data.object as Stripe.Invoice, c.executionCtx);
        break;
      }
      case 'invoice.payment_failed': {
        await handleInvoiceFailed(env, event.data.object as Stripe.Invoice);
        break;
      }
      case 'customer.subscription.deleted': {
        await handleSubscriptionDeleted(env, event.data.object as Stripe.Subscription);
        break;
      }
      case 'charge.refunded': {
        await handleChargeRefunded(env, event.data.object as Stripe.Charge);
        break;
      }
      default:
        await logEvent(db(env), `stripe.${event.type}.ignored`, {
          id: event.id,
        });
    }

    await markWebhookProcessed(db(env), event.id);
    return ok(c, { received: true, type: event.type });
  } catch (err) {
    await logEvent(db(env), `stripe.${event.type}.error`, {
      eventId: event.id,
      message: (err as Error).message,
    });
    throw err;
  }
});

// ───── Handlers ─────

const handleCheckoutCompleted = async (
  env: Bindings,
  session: Stripe.Checkout.Session,
): Promise<void> => {
  const licenseId = session.metadata?.licenseId;
  const deviceIdHash = session.metadata?.deviceIdHash;
  if (!licenseId) {
    await logEvent(db(env), 'stripe.checkout_completed.no_license_id', { id: session.id });
    return;
  }

  const license = await findLicenseById(db(env), licenseId);
  if (!license) {
    await logEvent(db(env), 'stripe.checkout_completed.license_missing', { licenseId });
    return;
  }

  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id;
  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;

  const email = session.customer_details?.email ?? null;
  const locale = (session.metadata?.locale as string | undefined) ?? 'de';

  // User-Record anlegen/aktualisieren.
  let userId = license.user_id;
  if (!userId) {
    userId = uuid();
    await insertUser(db(env), {
      id: userId,
      email,
      email_hash: email ? await hashEmail(email) : null,
      locale,
    });
  } else if (email) {
    await setUserEmail(db(env), userId, email, await hashEmail(email));
  }
  if (customerId && userId) {
    await setUserStripeCustomer(db(env), userId, customerId);
  }

  // Optionaler Firmenname aus dem Checkout-Custom-Field → Customer-Metadata,
  // damit wiederkehrende MOCO-Rechnungen ihn übernehmen können.
  const companyField = session.custom_fields?.find((f) => f.key === 'company');
  const company = companyField?.text?.value?.trim();
  if (company && customerId) {
    try {
      await getStripe(env).customers.update(customerId, { metadata: { company } });
    } catch (err) {
      await logEvent(db(env), 'stripe.company_meta.error', {
        customerId,
        message: (err as Error).message,
      });
    }
  }

  if (!subscriptionId || !customerId) {
    await logEvent(db(env), 'stripe.checkout_completed.missing_ids', {
      licenseId,
      hasCustomer: !!customerId,
      hasSubscription: !!subscriptionId,
    });
    return;
  }

  const planIntervalDays = Number(env.PLAN_INTERVAL_DAYS ?? '30');
  const newExpiry = addDays(new Date().toISOString(), planIntervalDays);

  await updateLicenseProvider(
    db(env),
    license.id,
    'stripe',
    subscriptionId,
    customerId,
    userId!,
  );
  await updateLicenseStatus(db(env), license.id, 'active', newExpiry);

  await logEvent(
    db(env),
    'stripe.checkout_completed',
    { sessionId: session.id, subscriptionId, customerId, newExpiry },
    { license_id: license.id, device_id_hash: deviceIdHash ?? undefined, user_id: userId! },
  );
};

const handleInvoicePaid = async (
  env: Bindings,
  invoice: Stripe.Invoice,
  ctx?: ExecutionContext,
): Promise<void> => {
  const subId = invoice.subscription;
  if (!subId || typeof subId !== 'string') return;
  const license = await findLicenseBySubscription(db(env), subId);
  if (!license) return;

  const planIntervalDays = Number(env.PLAN_INTERVAL_DAYS ?? '30');
  const newExpiry = addDays(new Date().toISOString(), planIntervalDays);
  await updateLicenseStatus(db(env), license.id, 'active', newExpiry);
  await logEvent(
    db(env),
    'stripe.invoice_paid',
    { invoiceId: invoice.id, newExpiry },
    { license_id: license.id },
  );

  // MOCO-Rechnung erstellen + versenden (best effort — darf die Lizenz-Aktivierung
  // niemals brechen). Dedup pro Stripe-Invoice-ID gegen doppelte Rechnungen.
  await maybeCreateMocoInvoice(env, invoice, license.id, ctx);
};

const maybeCreateMocoInvoice = async (
  env: Bindings,
  invoice: Stripe.Invoice,
  licenseId: string,
  ctx?: ExecutionContext,
): Promise<void> => {
  if (!env.MOCO_API_KEY || !env.MOCO_SUBDOMAIN || !invoice.id) return;
  try {
    if (await wasMocoInvoiceCreated(db(env), invoice.id)) return;

    // Kundendaten: zuerst aus dem Invoice-Snapshot, Firma/Fallbacks aus dem Customer.
    let name = invoice.customer_name ?? null;
    let email = invoice.customer_email ?? null;
    let address = invoice.customer_address ?? null;
    let company: string | null = null;

    const customerId =
      typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id ?? null;
    if (customerId) {
      try {
        const cust = await getStripe(env).customers.retrieve(customerId);
        if (!('deleted' in cust && cust.deleted)) {
          name = name ?? cust.name ?? null;
          email = email ?? cust.email ?? null;
          address = address ?? cust.address ?? null;
          const metaCompany = (cust.metadata?.company as string | undefined)?.trim();
          company = metaCompany && metaCompany.length > 0 ? metaCompany : null;
        }
      } catch {
        // Customer-Retrieve nicht kritisch — Invoice-Snapshot reicht.
      }
    }

    if (!email) {
      await logEvent(db(env), 'moco.invoice.skip_no_email', { invoiceId: invoice.id }, { license_id: licenseId });
      return;
    }

    const input = {
      email,
      name,
      company,
      address: address
        ? {
            line1: address.line1,
            line2: address.line2,
            postalCode: address.postal_code,
            city: address.city,
            country: address.country,
          }
        : null,
    };

    const mocoCustomerId = await getOrCreateCustomer(env, input);
    const created = await createBillSorterInvoice(env, {
      customerId: mocoCustomerId,
      input,
      stripeInvoiceId: invoice.id,
    });

    await recordMocoInvoice(db(env), {
      stripeInvoiceId: invoice.id,
      mocoInvoiceId: created.id != null ? String(created.id) : null,
      identifier: created.identifier,
      licenseId,
    });
    await logEvent(
      db(env),
      'moco.invoice.created',
      { invoiceId: invoice.id, mocoId: created.id, identifier: created.identifier },
      { license_id: licenseId },
    );

    // MOCO verschickt die Rechnung selbst per Mail an den Kunden. Netzwerk-Call →
    // via waitUntil im Hintergrund, damit der Webhook schnell antwortet.
    if (created.id != null) {
      const sendPromise = sendInvoiceViaMoco(env, {
        invoiceId: created.id,
        identifier: created.identifier ?? String(created.id),
        customerEmail: email,
        customerName: name ?? email,
      })
        .then((result) =>
          logEvent(db(env), result.ok ? 'moco.invoice.sent' : 'moco.invoice.send_failed', {
            invoiceId: invoice.id,
            identifier: created.identifier,
            mailId: result.mailId,
            detail: result.detail,
          }, { license_id: licenseId }),
        )
        .catch((err) =>
          logEvent(db(env), 'moco.invoice.send_error', {
            invoiceId: invoice.id,
            message: (err as Error).message,
          }, { license_id: licenseId }),
        );
      if (ctx?.waitUntil) ctx.waitUntil(sendPromise);
      else await sendPromise;
    }
  } catch (err) {
    await logEvent(
      db(env),
      'moco.invoice.error',
      { invoiceId: invoice.id, message: (err as Error).message },
      { license_id: licenseId },
    );
  }
};

const handleInvoiceFailed = async (env: Bindings, invoice: Stripe.Invoice): Promise<void> => {
  const subId = invoice.subscription;
  if (!subId || typeof subId !== 'string') return;
  const license = await findLicenseBySubscription(db(env), subId);
  if (!license) return;

  await updateLicenseStatus(db(env), license.id, 'grace');
  await logEvent(
    db(env),
    'stripe.invoice_failed',
    { invoiceId: invoice.id, attempts: invoice.attempt_count },
    { license_id: license.id },
  );
};

const handleSubscriptionDeleted = async (
  env: Bindings,
  sub: Stripe.Subscription,
): Promise<void> => {
  const license = await findLicenseBySubscription(db(env), sub.id);
  if (!license) return;
  await updateLicenseStatus(db(env), license.id, 'expired');
  await logEvent(
    db(env),
    'stripe.subscription_deleted',
    { subscriptionId: sub.id, cancelAt: sub.canceled_at },
    { license_id: license.id },
  );
};

const handleChargeRefunded = async (env: Bindings, charge: Stripe.Charge): Promise<void> => {
  const customerId = typeof charge.customer === 'string' ? charge.customer : charge.customer?.id;
  if (!customerId) return;
  const user = await findUserByStripeCustomer(db(env), customerId);
  if (!user) return;
  const row = await db(env)
    .prepare('SELECT id FROM licenses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1')
    .bind(user.id)
    .first<{ id: string }>();
  if (!row) return;
  await revokeLicense(db(env), row.id, 'charge_refunded');
  await updateLicenseStatus(db(env), row.id, 'revoked');
  await logEvent(
    db(env),
    'stripe.charge_refunded',
    { chargeId: charge.id, amount: charge.amount_refunded },
    { license_id: row.id, user_id: user.id },
  );
};
