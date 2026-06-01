// Dynamische Umsatzsteuer-Logik — TypeScript-Port der SALIO-Steuerlogik.
// Bestimmt den MwSt-Satz für die MOCO-Rechnung aus Land + USt-IdNr (B2B Reverse Charge).

// EU-Mitgliedsstaaten OHNE Deutschland (DE wird als Inland separat behandelt).
export const EU_COUNTRIES = new Set<string>([
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE',
  'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
]);

// Deutscher Regelsteuersatz.
const STANDARD_RATE = 19;

// MwSt-Satz nach Land + ob eine gültige EU-USt-IdNr vorliegt (B2B):
//   DE oder unbekannt        → 19% (Inland / Vorsicht-Default)
//   EU + USt-IdNr (B2B)      → 0% (Reverse Charge)
//   EU ohne USt-IdNr (B2C)   → 19%
//   Nicht-EU (Drittland)     → 0% (nicht steuerbar)
export const resolveTaxRate = (
  country: string | null | undefined,
  hasVatId: boolean,
): number => {
  const c = (country ?? '').toUpperCase();
  if (!c) return STANDARD_RATE; // unbekanntes Land → sicherheitshalber 19%
  if (c === 'DE') return STANDARD_RATE;
  if (EU_COUNTRIES.has(c)) return hasVatId ? 0 : STANDARD_RATE;
  return 0; // Drittland
};

// Lockerer Strukturtyp — deckt sowohl Stripe.Invoice (customer_address / customer_tax_ids)
// als auch Stripe.Checkout.Session (customer_details.address / customer_details.tax_ids) ab.
type TaxLike = {
  customer_details?: {
    address?: { country?: string | null } | null;
    tax_ids?: ReadonlyArray<{ type?: string | null }> | null;
  } | null;
  customer_address?: { country?: string | null } | null;
  customer_tax_ids?: ReadonlyArray<{ type?: string | null }> | null;
};

// Land + USt-IdNr-Flag aus einem Stripe-Objekt ziehen.
// hasVatId ist NUR true bei type === 'eu_vat' (eine US-EIN o.Ä. zählt NICHT).
export const extractCountryVatId = (
  obj: TaxLike,
): { country: string | null; hasVatId: boolean } => {
  const country =
    obj.customer_details?.address?.country ?? obj.customer_address?.country ?? null;
  const taxIds = obj.customer_details?.tax_ids ?? obj.customer_tax_ids ?? [];
  const hasVatId = Array.isArray(taxIds) && taxIds.some((t) => t?.type === 'eu_vat');
  return { country: country ?? null, hasVatId };
};

// Steuer-Hinweis für den Rechnungs-Footer (rechtlich korrekte Formulierung).
export const taxNote = (
  taxRate: number,
  hasVatId: boolean,
  country: string | null | undefined,
): string => {
  if (taxRate > 0) return `inkl. ${taxRate}% MwSt.`;
  const c = (country ?? '').toUpperCase();
  if (EU_COUNTRIES.has(c) && hasVatId) {
    return 'Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge).';
  }
  return 'Nicht steuerbare sonstige Leistung (Drittland).';
};
