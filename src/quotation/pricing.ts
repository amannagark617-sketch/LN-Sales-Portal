import {
  Brand, DocType, Discount, Freight, LineOption, LineTotals, PriceRow, QuoteLine, QuotePayload, Totals
} from './types';

export const GST_RATE = 0.18;

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const num = (n: unknown) => {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
};

/** Rules that differ per brand, taken from the 2026 price lists. */
export const BRAND_RULES: Record<Brand, {
  customisation: boolean;
  freightDefault: 'included' | 'extra';
  freightNote: string;
  prefix: string;
}> = {
  'Little Nap': {
    customisation: true,
    freightDefault: 'extra',
    freightNote: 'Little Nap prices are inclusive of GST. Freight is extra, charged on actual.',
    prefix: 'LN'
  },
  'La-Z-Boy': {
    customisation: false,
    freightDefault: 'included',
    freightNote: 'La-Z-Boy prices are inclusive of GST and freight. No customisation is available.',
    prefix: 'LZ'
  },
  'Smart Comfort': {
    customisation: false,
    freightDefault: 'included',
    freightNote: 'Smart Comfort prices are inclusive of GST and freight. No customisation is available.',
    prefix: 'SC'
  }
};

export const emptyDiscount = (): Discount => ({ mode: 'pct', value: 0 });

export function discountAmount(base: number, d: Discount | undefined): number {
  if (!d) return 0;
  const v = Math.max(0, num(d.value));
  if (d.mode === 'pct') return r2(base * Math.min(100, v) / 100);
  return r2(Math.min(base, v));
}

export function optionUnitTotal(o: LineOption): number {
  return num(o.unitPrice) * Math.max(0, num(o.qty));
}

export function calcLine(line: QuoteLine): LineTotals {
  const perPiece = num(line.unitPrice) + line.options.reduce((s, o) => s + optionUnitTotal(o), 0);
  const gross = r2(perPiece * Math.max(0, num(line.qty)));
  const discount = discountAmount(gross, line.discount);
  return { gross, discount, net: r2(gross - discount) };
}

export function calcTotals(p: Pick<QuotePayload, 'lines' | 'discount' | 'freight'>): Totals {
  const lines = p.lines.map(calcLine);
  const subtotal = r2(lines.reduce((s, l) => s + l.net, 0));
  const overallDiscount = discountAmount(subtotal, p.discount);
  const taxable = r2(subtotal - overallDiscount);
  // All list prices are GST-inclusive, so GST is the portion already inside the discounted value.
  const gstIncluded = r2(taxable / (1 + GST_RATE) * GST_RATE);
  const freightExtra = p.freight.mode === 'extra' ? r2(Math.max(0, num(p.freight.amount))) : 0;
  const grandTotal = r2(taxable + freightExtra);
  const hasAnyDiscount = overallDiscount > 0 || lines.some(l => l.discount > 0);
  return { lines, subtotal, overallDiscount, taxable, gstIncluded, freightExtra, grandTotal, hasAnyDiscount };
}

export function lineIsEdited(line: QuoteLine): boolean {
  return !line.custom && r2(num(line.unitPrice)) !== r2(num(line.listPrice));
}

export function payloadHasEditedPrices(p: QuotePayload): boolean {
  return p.lines.some(l =>
    l.custom || lineIsEdited(l) ||
    l.options.some(o => o.custom || r2(num(o.unitPrice)) !== r2(num(o.listPrice)))
  );
}

export const rowKey = (b: string, c: string, i: string, v: string) =>
  [b, c, i, v].map(s => s.trim().toLowerCase()).join('|');

/**
 * Checks a quotation against the price list. Returns a list of problems (empty = ok).
 * - every line and option must belong to the quotation's brand (no mixing)
 * - La-Z-Boy and Smart Comfort cannot carry customisation
 * - list prices must still match the sheet (otherwise the sheet changed after the user picked)
 */
export function validatePayload(p: QuotePayload, rows: PriceRow[]): string[] {
  const problems: string[] = [];
  if (!p.lines.length) problems.push('Add at least one item.');
  const rule = BRAND_RULES[p.brand];
  if (!rule) return ['Unknown brand.'];

  const map = new Map<string, PriceRow>();
  rows.forEach(r => map.set(rowKey(r.brand, r.category, r.item, r.variant), r));

  p.lines.forEach((l, idx) => {
    const label = `Item ${idx + 1} (${l.item || 'unnamed'})`;
    if (l.brand !== p.brand) problems.push(`${label} belongs to ${l.brand}. ${p.brand} and ${l.brand} cannot be in the same quotation.`);
    if (num(l.qty) < 1) problems.push(`${label}: quantity must be at least 1.`);
    if (num(l.unitPrice) < 0) problems.push(`${label}: price cannot be negative.`);
    if (!l.custom) {
      const row = map.get(rowKey(l.brand, l.category, l.item, l.variant));
      if (!row) problems.push(`${label} is not in the ${l.brand} price list.`);
      else if (r2(row.price) !== r2(num(l.listPrice))) problems.push(`${label}: the price list has changed since it was picked. Please re-select it.`);
    } else if (!rule.customisation) {
      problems.push(`${label}: custom items are not allowed for ${p.brand}.`);
    }
    if (l.options.length && !rule.customisation) problems.push(`${label}: ${p.brand} has no customisation.`);
    l.options.forEach(o => {
      const oLabel = `${label} / ${o.item || 'option'}`;
      if (o.brand !== p.brand) problems.push(`${oLabel} belongs to ${o.brand}.`);
      if (num(o.qty) <= 0) problems.push(`${oLabel}: quantity must be above zero.`);
      if (!o.custom) {
        const row = map.get(rowKey(o.brand, o.category, o.item, o.variant));
        if (!row) problems.push(`${oLabel} is not in the ${o.brand} price list.`);
        else if (r2(row.price) !== r2(num(o.listPrice))) problems.push(`${oLabel}: the price list has changed since it was picked.`);
      }
    });
  });

  if (p.freight.mode === 'extra' && !(num(p.freight.amount) > 0)) problems.push('Enter the freight amount, or choose "Included".');
  return problems;
}

// ---------- numbering ----------

/** Indian financial year code, April to March: Oct 2026 -> "2627". */
export function fyCode(d: Date = new Date()): string {
  const ist = new Date(d.getTime() + 5.5 * 3600 * 1000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${String(start).slice(-2)}${String(start + 1).slice(-2)}`;
}

/** e.g. LNQ / LNPI / LZQ / LZPI / SCQ / SCPI */
export function docPrefix(brand: Brand, docType: DocType): string {
  const base = BRAND_RULES[brand]?.prefix || 'LN';
  return docType === 'PI' ? `${base}PI` : `${base}Q`;
}

export function nextNumber(brand: Brand, docType: DocType, existingNumbers: string[], now: Date = new Date()): string {
  const prefix = docPrefix(brand, docType);
  const re = new RegExp(`^${prefix}-\\d+-(\\d+)$`, 'i');
  let max = 0;
  existingNumbers.forEach(n => {
    const m = (n || '').trim().match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  // Little Nap quotations continue the legacy series, which was already past 6780.
  if (prefix === 'LNQ') max = Math.max(max, 6780);
  return `${prefix}-${fyCode(now)}-${max + 1}`;
}

// ---------- amount in words (Indian system) ----------

export function numberToWords(value: number): string {
  if (!value) return 'Zero Rupees Only';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
    'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const below1000 = (n: number): string => {
    let s = '';
    if (n >= 100) { s += ones[Math.floor(n / 100)] + ' Hundred '; n %= 100; }
    if (n >= 20) { s += tens[Math.floor(n / 10)] + ' '; n %= 10; }
    if (n > 0) s += ones[n] + ' ';
    return s.trim();
  };
  let n = Math.floor(value);
  const paise = Math.round((value - n) * 100);
  let out = '';
  if (n >= 10000000) { out += below1000(Math.floor(n / 10000000)) + ' Crore '; n %= 10000000; }
  if (n >= 100000) { out += below1000(Math.floor(n / 100000)) + ' Lakh '; n %= 100000; }
  if (n >= 1000) { out += below1000(Math.floor(n / 1000)) + ' Thousand '; n %= 1000; }
  if (n > 0) out += below1000(n);
  out = out.trim() + ' Rupees';
  if (paise > 0) out += ' and ' + below1000(paise) + ' Paise';
  return out + ' Only';
}

export const formatINR = (n: number) =>
  'Rs. ' + num(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
