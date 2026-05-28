// MOCO-Integration — automatische Rechnung nach Stripe-Zahlung.
// TypeScript-Port der SALIO-Python-Integration (gleicher MOCO-Account + API-Key).
// MOCO erzeugt nur das PDF; der Versand läuft über Brevo (gebrandete BillSorter-Mail).

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

// Rechnung als PDF von MOCO holen und per Brevo (BillSorter-Branding) an den Kunden senden.
export const sendInvoiceEmail = async (
  env: Bindings,
  args: { invoiceId: number; identifier: string; customerEmail: string; customerName: string },
): Promise<boolean> => {
  if (!env.BREVO_API_KEY || !env.BREVO_SENDER_EMAIL) return false;

  // MOCO braucht kurz, bis das PDF generiert ist.
  await new Promise((r) => setTimeout(r, 3000));
  const invoice = await mocoGet(env, `/invoices/${args.invoiceId}`);
  const fileUrl = invoice?.file_url as string | undefined;
  if (!fileUrl) return false;

  const pdfResp = await fetch(fileUrl);
  if (!pdfResp.ok) return false;
  const pdfBytes = new Uint8Array(await pdfResp.arrayBuffer());
  const pdfB64 = base64FromBytes(pdfBytes);

  const html = [
    '<div style="font-family:Inter,system-ui,sans-serif;max-width:560px;margin:auto;color:#1f2026">',
    '<h2 style="color:#5923c2;margin:0 0 16px">Deine BillSorter Rechnung</h2>',
    `<p>Hallo ${escapeHtml(args.customerName)},</p>`,
    '<p>vielen Dank, dass du BillSorter nutzt.</p>',
    '<p>Anbei findest du deine Rechnung fuer dein <strong>BillSorter Pro</strong> Abonnement. Der Betrag wurde bereits per Stripe eingezogen, du musst nichts weiter tun.</p>',
    '<p>Bei Fragen antworte einfach auf diese Mail.</p>',
    '<p style="margin-top:24px">Viele Gruesse<br>Dein BillSorter Team</p>',
    '</div>',
  ].join('');

  const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'BillSorter', email: env.BREVO_SENDER_EMAIL },
      to: [{ email: args.customerEmail, name: args.customerName }],
      subject: `Deine Rechnung ${args.identifier} - BillSorter`,
      htmlContent: html,
      attachment: [{ name: `${args.identifier}_BillSorter_Rechnung.pdf`, content: pdfB64 }],
    }),
  });
  return resp.status >= 200 && resp.status < 300;
};

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

const base64FromBytes = (bytes: Uint8Array): string => {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};
