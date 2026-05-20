# BillSorter Backend

License- + Payment-API auf **Cloudflare Workers + D1 + Hono**.

## Endpoints

| Method | Path | Auth | Zweck |
|---|---|---|---|
| `GET` | `/health` | — | Healthcheck |
| `POST` | `/v1/trial/start` | — | Trial starten (Device-ID nötig), liefert JWT |
| `POST` | `/v1/license/check` | — | Status + neuer JWT |
| `POST` | `/v1/checkout/stripe` | — | Stripe Checkout Session erzeugen |
| `GET` | `/v1/checkout/done?session_id=…` | Stripe-Redirect | HTML-Page → Deep-Link `billsorter://license?token=…` |
| `POST` | `/v1/portal` | — | Stripe Customer Portal Link |
| `POST` | `/webhooks/stripe` | Stripe-Signatur | Subscription-Lifecycle |
| `POST` | `/v1/admin/revoke` | `Bearer ADMIN_TOKEN` | License revoken |
| `GET` | `/v1/admin/stats` | `Bearer ADMIN_TOKEN` | Counts |

## Quick-Start (lokal, eine Sitzung)

```bash
cd backend
npm install

# 1. Lokale D1-Datenbank anlegen
npx wrangler d1 create billsorter-dev
# → kopiere die ausgegebene database_id in wrangler.toml
#   (Block: [[d1_databases]] in DEFAULT)

# 2. Schema anwenden
npm run db:init:local

# 3. JWT-Keys generieren
node ./scripts/generate-keys.mjs
# → kopiere die JWT_PRIVATE_KEY_PEM + JWT_PUBLIC_KEY_PEM Zeilen in `.dev.vars`

# 4. .dev.vars anlegen
cp .dev.vars.example .dev.vars
# → STRIPE_SECRET_KEY = sk_test_...  (aus dashboard.stripe.com Test-Mode)
# → STRIPE_PRICE_ID  = price_...     (Product "BillSorter Monthly")
# → STRIPE_WEBHOOK_SECRET = whsec_... (siehe unten, Webhook-Setup)
# → APP_DEVICE_SALT = base64-32bytes  (z.B. `openssl rand -base64 32`)
# → ADMIN_TOKEN     = long random     (z.B. `openssl rand -hex 32`)
# → JWT_*           = aus Schritt 3

# 5. Dev-Server starten
npm run dev
# → http://localhost:8787
```

## Stripe-Webhook lokal testen

```bash
# In separater Konsole — Stripe CLI installieren falls noch nicht:
# brew install stripe/stripe-cli/stripe

stripe login
stripe listen --forward-to localhost:8787/webhooks/stripe
# → kopiere `whsec_...` als STRIPE_WEBHOOK_SECRET in .dev.vars und dev-server restarten

# Test-Event triggern:
stripe trigger checkout.session.completed
```

## Production-Deploy

```bash
# 1. Production-D1 anlegen
npx wrangler d1 create billsorter-prod
# → database_id in wrangler.toml unter [[env.production.d1_databases]] eintragen

# 2. Schema auf Prod anwenden
npm run db:init:remote

# 3. Secrets setzen (jeder einzeln interaktiv)
npx wrangler secret put STRIPE_SECRET_KEY --env production
npx wrangler secret put STRIPE_WEBHOOK_SECRET --env production
npx wrangler secret put STRIPE_PRICE_ID --env production
npx wrangler secret put JWT_PRIVATE_KEY_PEM --env production
npx wrangler secret put JWT_PUBLIC_KEY_PEM --env production
npx wrangler secret put APP_DEVICE_SALT --env production
npx wrangler secret put ADMIN_TOKEN --env production

# 4. Deploy
npm run deploy:prod

# 5. Custom Domain
# Cloudflare Dashboard → Workers → billsorter-api → Settings → Triggers →
# "Add Custom Domain" → api.billsorter.de
# (DNS-Record entsteht automatisch).

# 6. Stripe-Webhook-Endpoint in Stripe-Dashboard anlegen
# URL:    https://api.billsorter.de/webhooks/stripe
# Events: checkout.session.completed, invoice.payment_succeeded,
#         invoice.payment_failed, customer.subscription.deleted, charge.refunded
# → Signing-Secret holen → `wrangler secret put STRIPE_WEBHOOK_SECRET --env production`
# → Redeploy: npm run deploy:prod
```

## Datenmodell-Notizen

- `users.email` ist **nullable** — Trial hat keine E-Mail. Wird beim Stripe-Checkout via Webhook befüllt.
- `licenses.user_id` ist **nullable** — Trial-License existiert vor User-Record.
- `devices.device_id_hash` = `HMAC-SHA256(APP_DEVICE_SALT, raw_device_id)`. Wir speichern nie raw IDs.
- `webhook_events` dedupliziert Stripe-Retries via Event-ID.

## License-Status-Maschine

```
trial    → expires_at = trial_ends_at + 7d Grace im JWT
active   → expires_at = nächster Abrechnungstag
grace    → expires_at überschritten, < 7 Tage her (Stripe retried)
expired  → expires_at + Grace überschritten → Paywall
revoked  → durch Admin oder charge.refunded → Paywall
```

`computeStatus()` in `lib/license.ts` ist die zentrale Wahrheit.

## Sicherheit

- `JWT_PRIVATE_KEY_PEM` → **niemals** in App-Binary oder Repo. Nur Workers-Secret.
- `JWT_PUBLIC_KEY_PEM` → wird in App-Binary embedded, **offline-Validation** möglich.
- `APP_DEVICE_SALT` → muss in App-Binary _und_ Worker übereinstimmen (gleicher HMAC-Output).
- `ADMIN_TOKEN` → 32+ Bytes random.

## Troubleshooting

- **`Error: importPKCS8 invalid pem`** → die `\n` in `.dev.vars` müssen literal `\n` (zwei Zeichen) sein, nicht echte Newlines. `generate-keys.mjs` gibt den korrekten String aus.
- **D1 lokal hat alte Daten?** → `rm -rf .wrangler/` löscht den lokalen D1-State.
- **Stripe-Signature-Mismatch in Production** → `STRIPE_WEBHOOK_SECRET` muss exakt aus dem Production-Endpoint im Stripe-Dashboard kommen (nicht aus `stripe listen`).
