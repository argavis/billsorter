import type { D1Database } from '@cloudflare/workers-types';
import type {
  Bindings,
  DeviceRow,
  LicenseRow,
  LicenseStatus,
  UserRow,
} from '../types';

export const nowIso = (): string => new Date().toISOString();

export const addDays = (iso: string, days: number): string => {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
};

export const isPast = (iso: string): boolean => new Date(iso).getTime() < Date.now();

export const uuid = (): string => crypto.randomUUID();

// ───── USERS ─────

export const findUserById = async (db: D1Database, id: string): Promise<UserRow | null> =>
  (await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>()) ?? null;

export const findUserByStripeCustomer = async (
  db: D1Database,
  customerId: string,
): Promise<UserRow | null> =>
  (await db
    .prepare('SELECT * FROM users WHERE stripe_customer_id = ?')
    .bind(customerId)
    .first<UserRow>()) ?? null;

export const findUserByEmailHash = async (
  db: D1Database,
  emailHash: string,
): Promise<UserRow | null> =>
  (await db
    .prepare('SELECT * FROM users WHERE email_hash = ?')
    .bind(emailHash)
    .first<UserRow>()) ?? null;

export const insertUser = async (
  db: D1Database,
  row: Pick<UserRow, 'id' | 'email' | 'email_hash' | 'locale'>,
): Promise<void> => {
  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO users (id, email, email_hash, stripe_customer_id, locale, created_at, updated_at)
       VALUES (?, ?, ?, NULL, ?, ?, ?)`,
    )
    .bind(row.id, row.email, row.email_hash, row.locale, now, now)
    .run();
};

export const setUserStripeCustomer = async (
  db: D1Database,
  userId: string,
  stripeCustomerId: string,
): Promise<void> => {
  await db
    .prepare('UPDATE users SET stripe_customer_id = ?, updated_at = ? WHERE id = ?')
    .bind(stripeCustomerId, nowIso(), userId)
    .run();
};

export const setUserEmail = async (
  db: D1Database,
  userId: string,
  email: string,
  emailHash: string,
): Promise<void> => {
  await db
    .prepare('UPDATE users SET email = ?, email_hash = ?, updated_at = ? WHERE id = ?')
    .bind(email, emailHash, nowIso(), userId)
    .run();
};

// ───── LICENSES ─────

export const findLicenseById = async (
  db: D1Database,
  id: string,
): Promise<LicenseRow | null> =>
  (await db.prepare('SELECT * FROM licenses WHERE id = ?').bind(id).first<LicenseRow>()) ??
  null;

export const findLicenseBySubscription = async (
  db: D1Database,
  providerSubId: string,
): Promise<LicenseRow | null> =>
  (await db
    .prepare('SELECT * FROM licenses WHERE provider_sub_id = ?')
    .bind(providerSubId)
    .first<LicenseRow>()) ?? null;

export const insertLicense = async (
  db: D1Database,
  row: Omit<LicenseRow, 'created_at' | 'updated_at'>,
): Promise<void> => {
  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO licenses (
        id, user_id, plan, status, provider, provider_sub_id, provider_customer_id,
        trial_ends_at, expires_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.user_id,
      row.plan,
      row.status,
      row.provider,
      row.provider_sub_id,
      row.provider_customer_id,
      row.trial_ends_at,
      row.expires_at,
      now,
      now,
    )
    .run();
};

export const updateLicenseStatus = async (
  db: D1Database,
  id: string,
  status: LicenseStatus,
  expiresAt?: string,
): Promise<void> => {
  if (expiresAt) {
    await db
      .prepare('UPDATE licenses SET status = ?, expires_at = ?, updated_at = ? WHERE id = ?')
      .bind(status, expiresAt, nowIso(), id)
      .run();
  } else {
    await db
      .prepare('UPDATE licenses SET status = ?, updated_at = ? WHERE id = ?')
      .bind(status, nowIso(), id)
      .run();
  }
};

export const updateLicenseProvider = async (
  db: D1Database,
  id: string,
  provider: 'stripe' | 'paypal',
  providerSubId: string,
  providerCustomerId: string,
  userId: string,
): Promise<void> => {
  await db
    .prepare(
      `UPDATE licenses
         SET provider = ?, provider_sub_id = ?, provider_customer_id = ?, user_id = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(provider, providerSubId, providerCustomerId, userId, nowIso(), id)
    .run();
};

// ───── DEVICES ─────

export const findDevice = async (
  db: D1Database,
  deviceIdHash: string,
): Promise<DeviceRow | null> =>
  (await db
    .prepare('SELECT * FROM devices WHERE device_id_hash = ?')
    .bind(deviceIdHash)
    .first<DeviceRow>()) ?? null;

export const upsertDevice = async (
  db: D1Database,
  row: {
    device_id_hash: string;
    license_id: string;
    app_version: string | null;
    os: string | null;
    locale: string | null;
  },
): Promise<void> => {
  const existing = await findDevice(db, row.device_id_hash);
  const now = nowIso();
  if (existing) {
    await db
      .prepare(
        `UPDATE devices
           SET license_id = ?, last_check_at = ?, app_version = ?, os = ?, locale = ?
         WHERE device_id_hash = ?`,
      )
      .bind(
        row.license_id,
        now,
        row.app_version,
        row.os,
        row.locale,
        row.device_id_hash,
      )
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO devices
          (device_id_hash, license_id, first_seen_at, last_check_at, app_version, os, locale)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        row.device_id_hash,
        row.license_id,
        now,
        now,
        row.app_version,
        row.os,
        row.locale,
      )
      .run();
  }
};

export const touchDevice = async (db: D1Database, deviceIdHash: string): Promise<void> => {
  await db
    .prepare('UPDATE devices SET last_check_at = ? WHERE device_id_hash = ?')
    .bind(nowIso(), deviceIdHash)
    .run();
};

// ───── EVENTS ─────

export const logEvent = async (
  db: D1Database,
  type: string,
  payload: Record<string, unknown>,
  refs: { license_id?: string; device_id_hash?: string; user_id?: string } = {},
): Promise<void> => {
  await db
    .prepare(
      `INSERT INTO events (type, license_id, device_id_hash, user_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      type,
      refs.license_id ?? null,
      refs.device_id_hash ?? null,
      refs.user_id ?? null,
      JSON.stringify(payload),
      nowIso(),
    )
    .run();
};

// ───── REVOCATIONS ─────

export const isRevoked = async (db: D1Database, licenseId: string): Promise<boolean> => {
  const row = await db
    .prepare('SELECT 1 as found FROM revocations WHERE license_id = ?')
    .bind(licenseId)
    .first<{ found: number }>();
  return !!row;
};

export const revokeLicense = async (
  db: D1Database,
  licenseId: string,
  reason: string,
): Promise<void> => {
  await db
    .prepare(
      `INSERT INTO revocations (license_id, reason, revoked_at)
       VALUES (?, ?, ?)
       ON CONFLICT(license_id) DO UPDATE SET reason = excluded.reason, revoked_at = excluded.revoked_at`,
    )
    .bind(licenseId, reason, nowIso())
    .run();
};

// ───── WEBHOOK DEDUPE ─────

export const wasWebhookProcessed = async (
  db: D1Database,
  eventId: string,
): Promise<boolean> => {
  const row = await db
    .prepare('SELECT processed_at FROM webhook_events WHERE event_id = ?')
    .bind(eventId)
    .first<{ processed_at: string | null }>();
  return row !== null && row.processed_at !== null;
};

export const markWebhookSeen = async (
  db: D1Database,
  eventId: string,
  provider: string,
  type: string,
): Promise<void> => {
  await db
    .prepare(
      `INSERT INTO webhook_events (event_id, provider, type, received_at, processed_at)
       VALUES (?, ?, ?, ?, NULL)
       ON CONFLICT(event_id) DO NOTHING`,
    )
    .bind(eventId, provider, type, nowIso())
    .run();
};

export const markWebhookProcessed = async (
  db: D1Database,
  eventId: string,
): Promise<void> => {
  await db
    .prepare('UPDATE webhook_events SET processed_at = ? WHERE event_id = ?')
    .bind(nowIso(), eventId)
    .run();
};

// ───── MOCO-Rechnungs-Dedup ─────

export const wasMocoInvoiceCreated = async (
  db: D1Database,
  stripeInvoiceId: string,
): Promise<boolean> => {
  const row = await db
    .prepare('SELECT stripe_invoice_id FROM moco_invoices WHERE stripe_invoice_id = ?')
    .bind(stripeInvoiceId)
    .first<{ stripe_invoice_id: string }>();
  return row !== null;
};

export const recordMocoInvoice = async (
  db: D1Database,
  args: {
    stripeInvoiceId: string;
    mocoInvoiceId: string | null;
    identifier: string | null;
    licenseId: string | null;
  },
): Promise<void> => {
  await db
    .prepare(
      `INSERT INTO moco_invoices (stripe_invoice_id, moco_invoice_id, identifier, license_id, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(stripe_invoice_id) DO NOTHING`,
    )
    .bind(
      args.stripeInvoiceId,
      args.mocoInvoiceId,
      args.identifier,
      args.licenseId,
      nowIso(),
    )
    .run();
};

// Convenience access to Bindings.DB through Hono context (saves boilerplate).
export const db = (env: Pick<Bindings, 'DB'>): D1Database => env.DB;
