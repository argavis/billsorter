-- BillSorter D1 Schema — initial migration
-- Apply: `wrangler d1 execute billsorter-dev --local --file=./src/db/migrations/0001_init.sql`

-- ───── USERS ────────────────────────────────────────────────────────────────
-- Anonymous bei Trial (email NULL). E-Mail wird beim Stripe-Checkout gesetzt.

CREATE TABLE IF NOT EXISTS users (
  id                  TEXT PRIMARY KEY,
  email               TEXT UNIQUE,
  email_hash          TEXT,
  stripe_customer_id  TEXT UNIQUE,
  locale              TEXT NOT NULL DEFAULT 'de',
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email_hash ON users(email_hash);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);

-- ───── LICENSES ─────────────────────────────────────────────────────────────
-- status: 'trial' | 'active' | 'grace' | 'expired' | 'revoked'
-- provider: 'stripe' | 'paypal' | NULL (NULL für Trial)

CREATE TABLE IF NOT EXISTS licenses (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT REFERENCES users(id),
  plan                TEXT NOT NULL DEFAULT 'monthly',
  status              TEXT NOT NULL,
  provider            TEXT,
  provider_sub_id     TEXT,
  provider_customer_id TEXT,
  trial_ends_at       TEXT,
  expires_at          TEXT NOT NULL,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_licenses_user ON licenses(user_id);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_provider_sub ON licenses(provider_sub_id);

-- ───── DEVICES ──────────────────────────────────────────────────────────────
-- device_id_hash = HMAC(APP_DEVICE_SALT, raw_device_id). Wir speichern nur den Hash.
-- Eine License kann mehrere Devices haben (Mac + Win zB), aber das gleiche Device
-- gehört genau einer aktiven License.

CREATE TABLE IF NOT EXISTS devices (
  device_id_hash      TEXT PRIMARY KEY,
  license_id          TEXT REFERENCES licenses(id),
  first_seen_at       TEXT NOT NULL,
  last_check_at       TEXT NOT NULL,
  app_version         TEXT,
  os                  TEXT,
  locale              TEXT
);

CREATE INDEX IF NOT EXISTS idx_devices_license ON devices(license_id);

-- ───── EVENTS ───────────────────────────────────────────────────────────────
-- Append-only Audit-Log. Nutzen: Debugging, Lifecycle-Analysen, Anti-Fraud-Spuren.

CREATE TABLE IF NOT EXISTS events (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  type                TEXT NOT NULL,
  license_id          TEXT,
  device_id_hash      TEXT,
  user_id             TEXT,
  payload             TEXT,
  created_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_license ON events(license_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);

-- ───── REVOCATIONS ──────────────────────────────────────────────────────────
-- Schnelle Lookup-Tabelle für invalidierte Lizenzen.

CREATE TABLE IF NOT EXISTS revocations (
  license_id          TEXT PRIMARY KEY REFERENCES licenses(id),
  reason              TEXT NOT NULL,
  revoked_at          TEXT NOT NULL
);

-- ───── WEBHOOK_DEDUPE ───────────────────────────────────────────────────────
-- Stripe sendet Webhooks bei Retries mehrfach. Wir deduplizieren per event_id.

CREATE TABLE IF NOT EXISTS webhook_events (
  event_id            TEXT PRIMARY KEY,
  provider            TEXT NOT NULL,
  type                TEXT NOT NULL,
  received_at         TEXT NOT NULL,
  processed_at        TEXT
);
