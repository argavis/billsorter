// MOCO-Integration — automatische Rechnung nach Stripe-Zahlung.
// TypeScript-Port der SALIO-Python-Integration (gleicher MOCO-Account + API-Key).
// MOCO erstellt die Rechnung UND verschickt sie selbst per Mail an den Kunden.

import type { Bindings } from '../types';

const PRODUCT = {
  title: 'BillSorter Pro — Monatliches Abonnement',
  description: 'Automatische Rechnungs-Erkennung und Monatsordner-Ablage per E-Mail-Scan.',
  unitPrice: 6.99,
  unit: 'Monat',
};
const TAX_RATE = 19.0;

type CustomerInput = {
  email: string;
  name: string | null;
  company: string | null;
  address: {
    line1?: string | null;
    line2?: string | null;
    postalCode?: string | null;
    city?: string | null;
    country?: string | null;
  } | null;
};

const mocoBase = (env: Bindings): string =>
  `https://${env.MOCO_SUBDOMAIN}.mocoapp.com/api/v1`;

const mocoHeaders = (env: Bindings): Record<string, string> => ({
  Authorization: `Token token=${env.MOCO_API_KEY}`,
  'Content-Type': 'application/json',
});

const mocoGet = async (env: Bindings, path: string): Promise<any> => {
  const res = await fetch(mocoBase(env) + path, { headers: mocoHeaders(env) });
  if (!res.ok) throw new Error(`MOCO GET ${path} → ${res.status} ${await res.text()}`);
  return res.json();
};

const mocoPost = async (env: Bindings, path: string, body: unknown): Promise<any> => {
  const res = await fetch(mocoBase(env) + path, {
    method: 'POST',
    headers: mocoHeaders(env),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`MOCO POST ${path} → ${res.status} ${await res.text()}`);
  return res.json();
};

// MOCO-Company per Email finden, sonst anlegen (idempotent).
export const getOrCreateCustomer = async (
  env: Bindings,
  input: CustomerInput,
): Promise<number> => {
  const term = encodeURIComponent(input.email);
  const existing = await mocoGet(env, `/companies?term=${term}&type=customer`);
  if (Array.isArray(existing) && existing.length > 0) {
    return existing[0].id as number;
  }
  const created = await mocoPost(env, '/companies', {
    name: input.company || input.name || input.email,
    type: 'customer',
    currency: 'EUR',
    country_code: (input.address?.country || 'DE').toUpperCase(),
    info: input.company && input.name ? `Kontakt: ${input.name} <${input.email}>` : input.email,
  });
  return created.id as number;
};

// Mehrzeilige Empfänger-Adresse: Firma → Name → Straße → PLZ Ort → Land (falls != DE).
const buildRecipientAddress = (input: CustomerInput): string => {
  const a = input.address;
  const parts: string[] = [];
  if (input.company) parts.push(input.company);
  if (input.name) parts.push(input.name);
  if (a?.line1) parts.push(a.line2 ? `${a.line1} ${a.line2}`.trim() : a.line1);
  const zipCity = [a?.postalCode, a?.city].filter(Boolean).join(' ').trim();
  if (zipCity) parts.push(zipCity);
  if (a?.country && a.country.toUpperCase() !== 'DE') parts.push(a.country.toUpperCase());
  return parts.join('\n') || input.name || input.email;
};

const monthBounds = (): { from: string; to: string; label: string } => {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const label = `${String(from.getUTCMonth() + 1).padStart(2, '0')}/${from.getUTCFullYear()}`;
  return { from: iso(from), to: iso(to), label };
};

export type CreatedInvoice = { id: number | null; identifier: string | null };

export const createBillSorterInvoice = async (
  env: Bindings,
  args: { customerId: number; input: CustomerInput; stripeInvoiceId: string },
): Promise<CreatedInvoice> => {
  const today = new Date().toISOString().slice(0, 10);
  const { from, to, label } = monthBounds();
  const net = PRODUCT.unitPrice;
  const gross = Math.round(net * (1 + TAX_RATE / 100) * 100) / 100;

  const footer =
    `<div>Vielen Dank, dass du BillSorter nutzt.</div>` +
    `<div>Der Betrag von ${gross.toFixed(2)} EUR (inkl. ${TAX_RATE}% MwSt.) wurde bereits per Stripe eingezogen.</div>` +
    `<div>Stripe Invoice: ${args.stripeInvoiceId}</div>`;

  const payload = {
    customer_id: args.customerId,
    title: `BillSorter Abonnement - ${label}`,
    date: today,
    due_date: today,
    service_period_from: from,
    service_period_to: to,
    recipient_address: buildRecipientAddress(args.input),
    currency: 'EUR',
    tax: TAX_RATE,
    discount: 0,
    cash_discount: 0,
    status: 'created',
    tags: ['BillSorter', `stripe:${args.stripeInvoiceId}`],
    items: [
      {
        type: 'item',
        title: PRODUCT.title,
        description: PRODUCT.description,
        quantity: 1,
        unit: PRODUCT.unit,
        unit_price: net,
        net_total: net,
      },
    ],
    footer,
  };

  const invoice = await mocoPost(env, '/invoices', payload);
  return { id: invoice?.id ?? null, identifier: invoice?.identifier ?? String(invoice?.id ?? '') };
};

export type SendResult = { ok: boolean; mailId: number | null; detail: string };

// MOCO verschickt die Rechnung selbst per E-Mail an den Kunden (inkl. PDF).
// POST /invoices/{id}/send_email — kein Brevo, kein PDF-Download durch uns.
// WICHTIG (SALIO): emails_to MUSS ein String sein (Array → 422), text ist Pflicht,
// und die Antwort MUSS ausgewertet werden — niemals blind "sent" loggen.
export const sendInvoiceViaMoco = async (
  env: Bindings,
  args: { invoiceId: number; identifier: string; customerEmail: string; customerName: string },
): Promise<SendResult> => {
  const text = [
    `Hallo ${args.customerName},`,
    '',
    'vielen Dank, dass du BillSorter nutzt. Anbei findest du deine Rechnung fuer dein',
    'BillSorter Pro Abonnement. Der Betrag wurde bereits per Stripe eingezogen,',
    'du musst nichts weiter tun.',
    '',
    'Bei Fragen antworte einfach auf diese Mail.',
    '',
    'Viele Gruesse',
    'Dein BillSorter Team',
  ].join('\n');

  // mocoPost wirft bei !res.ok (HTTP-Fehler). Erreicht den Code unten nur bei 2xx —
  // wir werten die Antwort trotzdem aus, statt blind Erfolg anzunehmen.
  const res = await mocoPost(env, `/invoices/${args.invoiceId}/send_email`, {
    subject: `Deine Rechnung ${args.identifier} - BillSorter`,
    text,
    emails_to: args.customerEmail,
  });

  // MOCO liefert bei Erfolg das versendete Email-Objekt zurück.
  const mailId =
    res && typeof res === 'object' && typeof res.id === 'number' ? (res.id as number) : null;
  const ok = res != null && typeof res === 'object' && !('error' in res);
  const detail = ok
    ? `mailId=${mailId ?? 'n/a'}`
    : `unexpected response: ${JSON.stringify(res).slice(0, 200)}`;
  return { ok, mailId, detail };
};
