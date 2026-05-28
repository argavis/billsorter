-- MOCO-Rechnungs-Log: Dedup pro Stripe-Invoice-ID, damit ein erneut zugestellter
-- Webhook keine doppelte MOCO-Rechnung erzeugt.
CREATE TABLE IF NOT EXISTS moco_invoices (
  stripe_invoice_id   TEXT PRIMARY KEY,
  moco_invoice_id     TEXT,
  identifier          TEXT,
  license_id          TEXT,
  created_at          TEXT NOT NULL
);
