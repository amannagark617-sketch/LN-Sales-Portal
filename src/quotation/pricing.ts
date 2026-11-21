import {
  Brand, DocType, Discount, Freight, LineOption, LineTotals, PriceRow, QuoteKind, QuoteLine, QuotePayload, Totals
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

/** Every quotation is for one brand only. */
export function allowedBrands(b: Brand): Brand[] {
  return [b];
}

/** Upholstery and add-on categories that can also be sold as an item on their own (Little Nap only). */
export const STANDALONE_CATS = ['Upholstery', 'Accessories', 'Single Motor Controls', 'Dual Motor Controls', 'Three Motor Controls', 'Other Accessories', 'Veneer Arm'];

export const emptyDiscount = (): Discount => ({ mode: 'pct', value: 0 });

export function discountAmount(base: number, d: Discount | undefined): number {
  if (!d) return 0;
  const v = Math.max(0, num(d.value));
  if (d.mode === 'pct') return r2(base * Math.min(100, v) / 100);
  return r2(Math.min(base, v));
}

/** Items sold by the metre (extra fabric, leather) take a decimal quantity such as 1.7 */
export const isMetreOption = (o: { variant: string }) => /\b(metre|meter|mtr)s?\b/i.test(o.variant || '');

export function optionUnitTotal(o: LineOption): number {
  return num(o.unitPrice) * Math.max(0, num(o.qty));
}

export function calcLine(line: QuoteLine, kind: QuoteKind = 'Retail'): LineTotals {
  const qty = Math.max(0, num(line.qty));
  if (kind === 'Project') {
    const listPer = num(line.listPrice) + line.options.reduce((s, o) => s + num(o.listPrice) * Math.max(0, num(o.qty)), 0);
    const specialPer = num(line.unitPrice) + line.options.reduce((s, o) => s + optionUnitTotal(o), 0);
    const special = r2(specialPer * qty);
    const gross = r2(Math.max(listPer * qty, special));
    return { gross, discount: r2(gross - special), net: special };
  }
  const selfBase = r2(num(line.unitPrice) * qty);
  const optBases = line.options.map(o => r2(optionUnitTotal(o) * qty));
  const gross = r2(selfBase + optBases.reduce((s, v) => s + v, 0));
  const discount = line.partDiscounts
    ? r2(discountAmount(selfBase, line.discount) + line.options.reduce((s, o, i) => s + discountAmount(optBases[i], o.discount), 0))
    : discountAmount(gross, line.discount);
  return { gross, discount, net: r2(gross - discount) };
}

export function calcTotals(p: Pick<QuotePayload, 'lines' | 'discount' | 'freight' | 'kind'> & { gstRate?: number; installation?: number }): Totals {
  const project = p.kind === 'Project';
  const lines = p.lines.map(l => calcLine(l, p.kind));
  const subtotal = r2(lines.reduce((s, l) => s + l.net, 0));
  const overallDiscount = project ? 0 : discountAmount(subtotal, p.discount);
  const taxable = r2(subtotal - overallDiscount);
  // All list prices are GST-inclusive, so GST is the portion already inside the discounted value.
  const rate = Number.isFinite(Number(p.gstRate)) && p.gstRate !== undefined ? Math.max(0, Number(p.gstRate)) / 100 : GST_RATE;
  const freightExtra = p.freight.mode === 'extra' ? r2(Math.max(0, num(p.freight.amount))) : 0;
  const installation = r2(Math.max(0, num(p.installation)));
  // Project: special prices, freight and installation are all without GST; GST is added once, at the end.
  const gstIncluded = project ? 0 : r2(taxable / (1 + rate) * rate);
  const taxableExGst = project ? taxable : r2(taxable - gstIncluded);
  const gstExtra = project ? r2((taxable + freightExtra + installation) * rate) : 0;
  const grandTotal = project ? r2(taxable + freightExtra + installation + gstExtra) : r2(taxable + freightExtra + installation);
  const hasAnyDiscount = overallDiscount > 0 || lines.some(l => l.discount > 0);
  // Share a whole-quotation discount across the items, in proportion to their value
  let given = 0;
  const effLines: LineTotals[] = lines.map((l, i) => {
    const extra = i === lines.length - 1 ? r2(overallDiscount - given) : (subtotal > 0 ? r2(l.net * overallDiscount / subtotal) : 0);
    given = r2(given + extra);
    return { gross: l.gross, discount: r2(l.discount + extra), net: r2(l.net - extra) };
  });
  return { lines, effLines, subtotal, overallDiscount, taxable, taxableExGst, gstRate: r2(rate * 100), gstIncluded, gstExtra, freightExtra, installation, grandTotal, hasAnyDiscount };
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
  if (p.kind !== undefined && p.kind !== 'Retail' && p.kind !== 'Project') return ['Unknown quotation type.'];
  const project = p.kind === 'Project';
  if (project && p.brand !== 'Little Nap') return ['A Project quotation is only for Little Nap.'];

  const map = new Map<string, PriceRow>();
  rows.forEach(r => map.set(rowKey(r.brand, r.category, r.item, r.variant), r));

  p.lines.forEach((l, idx) => {
    const label = `Item ${idx + 1} (${l.item || 'unnamed'})`;
    if (!allowedBrands(p.brand).includes(l.brand)) problems.push(`${label} belongs to ${l.brand}. ${p.brand} and ${l.brand} cannot be in the same quotation.`);
    if (l.standalone ? !(num(l.qty) > 0) : num(l.qty) < 1) problems.push(`${label}: quantity must be ${l.standalone ? 'above zero' : 'at least 1'}.`);
    if (l.standalone && l.brand !== 'Little Nap') problems.push(`${label}: only Little Nap upholstery and add-ons can be sold on their own.`);
    if (l.standalone && l.options.length) problems.push(`${label}: an item sold on its own has no customisation.`);
    if (l.standalone && !STANDALONE_CATS.includes(l.category)) problems.push(`${label}: this item cannot be sold on its own.`);
    if (num(l.unitPrice) < 0) problems.push(`${label}: price cannot be negative.`);
    if (l.custom) {
      if (!project) problems.push(`${label}: only items from the price list can be added.`);
      else {
        if (l.brand !== 'Little Nap') problems.push(`${label}: your own items are only for Little Nap.`);
        if (!String(l.item || '').trim() || String(l.item).length > 120) problems.push(`${label}: give the item a name (up to 120 characters).`);
        if (!(num(l.unitPrice) >= 0) || r2(num(l.unitPrice)) !== r2(num(l.listPrice))) problems.push(`${label}: the price is not valid.`);
      }
    } else {
      const row = map.get(rowKey(l.brand, l.category, l.item, l.variant));
      if (!row) problems.push(`${label} is not in the ${l.brand} price list.`);
      else if (r2(row.price) !== r2(num(l.listPrice))) problems.push(`${label}: the price list has changed since it was picked. Please re-select it.`);
      if (project || l.standalone) { if (!(num(l.unitPrice) >= 0)) problems.push(`${label}: enter a price of zero or more.`); }
      else if (r2(num(l.unitPrice)) !== r2(num(l.listPrice))) problems.push(`${label}: the price cannot be changed. Use a discount instead.`);
    }
    if (l.options.length && !BRAND_RULES[l.brand]?.customisation) problems.push(`${label}: ${l.brand} has no customisation.`);
    l.options.forEach(o => {
      const oLabel = `${label} / ${o.item || 'option'}`;
      if (o.brand !== l.brand) problems.push(`${oLabel} belongs to ${o.brand}, not ${l.brand}.`);
      if (num(o.qty) <= 0) problems.push(`${oLabel}: quantity must be above zero.`);
      if (o.custom) {
        if (!project) problems.push(`${oLabel}: only items from the price list can be added.`);
        else {
          if (!String(o.item || '').trim() || String(o.item).length > 120) problems.push(`${oLabel}: give the item a name (up to 120 characters).`);
          if (!(num(o.unitPrice) >= 0) || r2(num(o.unitPrice)) !== r2(num(o.listPrice))) problems.push(`${oLabel}: the price is not valid.`);
        }
      } else {
        const row = map.get(rowKey(o.brand, o.category, o.item, o.variant));
        if (!row) problems.push(`${oLabel} is not in the ${o.brand} price list.`);
        else if (r2(row.price) !== r2(num(o.listPrice))) problems.push(`${oLabel}: the price list has changed since it was picked.`);
        if (project) { if (!(num(o.unitPrice) >= 0)) problems.push(`${oLabel}: enter a special price of zero or more.`); }
        else if (r2(num(o.unitPrice)) !== r2(num(o.listPrice))) problems.push(`${oLabel}: the price cannot be changed.`);
      }
    });
  });

  const bad = (s: unknown, n: number) => typeof s !== 'string' || s.length > n;
  p.lines.forEach((l, idx) => {
    if (l.specs !== undefined && (!Array.isArray(l.specs) || l.specs.length > 40 || l.specs.some(x => !x || bad(x.label, 120) || bad(x.value, 400)))) {
      problems.push(`Item ${idx + 1}: the specifications are not valid.`);
    }
  });
  if (p.customer !== undefined && (typeof p.customer !== 'object' || p.customer === null || [p.customer.site, p.customer.gstin].some(x => x !== undefined && bad(x, 200)))) {
    problems.push('The customer details are not valid.');
  }
  if (p.installation !== undefined && !(num(p.installation) >= 0)) problems.push('Installation must be zero or more.');
  if (p.contact !== undefined && (typeof p.contact !== 'object' || p.contact === null || [p.contact.phone, p.contact.email].some(x => x !== undefined && bad(x, 120)))) problems.push('The contact details are not valid.');
  if (p.terms !== undefined) {
    if (!Array.isArray(p.terms) || p.terms.length > 40 || p.terms.some(t => typeof t !== 'string' || t.length > 800)) problems.push('The terms and conditions are not valid.');
  }
  if (p.gstRate !== undefined && !(Number(p.gstRate) >= 0 && Number(p.gstRate) <= 28)) problems.push('GST % must be between 0 and 28.');
  if (!['included', 'extra', 'actual'].includes(p.freight.mode)) problems.push('Unknown freight option.');
  if (p.freight.mode === 'actual' && !project) problems.push('"On actual" freight is only for Project quotations.');
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
