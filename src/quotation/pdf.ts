import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import { QuotePayload, TermRow } from './types';
import { calcTotals, numberToWords, isMetreOption, discountAmount, optionUnitTotal } from './pricing';
import { QuoteLine, LineTotals } from './types';

const GOLD = '#9B7C50';
const INK = '#0F172A';
const GREY = '#475569';
const LINE = '#E2E8F0';
const LAZBOY_NAVY = '#00314A'; // the navy of the La-Z-Boy logo

export interface PdfMeta {
  number: string;
  linkedQuotation?: string;
  date: string;
  clientName: string;
  mobile: string;
  email: string;
  billing: string;
  shipping: string;
  salespersonName: string;
  salespersonId: string;
  salespersonRole?: string;
  salespersonPhone?: string;
  /** company block for the top right; the first line is printed bold */
  companyDetails?: string;
  bank?: string;
  terms: string[];
  logoBase64?: string | null;
  /** La-Z-Boy logo, shown beside the Little Nap logo on La-Z-Boy documents */
  lazboyLogoBase64?: string | null;
}

export interface Attachment {
  id: string;
  name: string;
  type: 'pdf' | 'image';
  base64Url?: string;
  arrayBuffer?: ArrayBuffer;
}

const money = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const DEFAULT_COMPANY = [
  'Little Nap Designs Pvt. Ltd.',
  'IVR Number: +91 8882800600',
  'Email: enquiry@littlenap.in',
  'GSTIN: 06AACCL0576H1ZM',
  'Corp. Office: 844, M.G. Road, Ghitorni,',
  'New Delhi - 110030, India'
].join('\n');

export function termsFor(terms: TermRow[], brand: string, kind: string = 'Retail'): string[] {
  return terms
    .filter(t => t.brand === brand && t.active && (!t.kind || t.kind === kind))
    .sort((a, b) => a.no - b.no)
    .map(t => t.text);
}

interface Comp { gross: number; disc: number; net: number }

/** Splits an item's totals into the product itself and each upholstery or add-on, so every line can show its own MRP, discount and price. */
function lineComponents(l: QuoteLine, lt: LineTotals, project: boolean): Comp[] {
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const qty = Math.max(0, Number(l.qty) || 0);
  const grossOf = (unit: number) => r2(unit * qty);
  const parts = [grossOf(Number(l.unitPrice) || 0), ...l.options.map(o => grossOf(optionUnitTotal(o)))];
  if (project) return parts.map(g => ({ gross: g, disc: 0, net: g }));
  const disc = [
    l.partDiscounts ? discountAmount(parts[0], l.discount) : 0,
    ...l.options.map((o, k) => (l.partDiscounts ? discountAmount(parts[k + 1], o.discount) : 0))
  ];
  let extra = r2(lt.discount - disc.reduce((a, b) => a + b, 0));
  const base = parts.reduce((a, b, k) => a + (b - disc[k]), 0);
  if (extra !== 0 && base > 0) {
    let given = 0;
    parts.forEach((g, k) => {
      const share = k === parts.length - 1 ? r2(extra - given) : r2(extra * (g - disc[k]) / base);
      disc[k] = r2(disc[k] + share); given = r2(given + share);
    });
  }
  return parts.map((g, k) => ({ gross: g, disc: disc[k], net: r2(g - disc[k]) }));
}

export function buildCorePdf(p: QuotePayload, m: PdfMeta): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const t = calcTotals(p);
  const isPI = p.docType === 'PI';
  const title = isPI ? 'PROFORMA INVOICE' : 'QUOTATION';
  const project = p.kind === 'Project';
  const hasDisc = !project && t.hasAnyDiscount;
  const lz = p.brand === 'La-Z-Boy';
  const ACC = lz ? LAZBOY_NAVY : GOLD;   // accent colour
  const HEAD = lz ? LAZBOY_NAVY : INK;   // table header colour
  let y = 0;
  let page = 1;

  const colQty = hasDisc ? 104 : 125;
  const colRate = hasDisc ? 125 : 160;   // MRP
  const colDisc = 147;
  const colSpecial = 169;
  const colTotal = 193;
  const descW = hasDisc ? 66 : 92;

  const header = () => {
    if (lz && page === 1) {
      doc.setFillColor(ACC); doc.rect(0, 0, W, 6.5, 'F');
      doc.setFont('Helvetica', 'bold'); doc.setFontSize(6.8); doc.setTextColor('#FFFFFF');
      doc.text('LITTLE NAP  |  EXCLUSIVE PARTNER OF LA-Z-BOY IN INDIA', W / 2, 4.3, { align: 'center', charSpace: 0.4 });
    } else {
      doc.setFillColor(ACC); doc.rect(0, 0, W, 3, 'F');
    }
    if (page === 1 && lz) {
      // Little Nap logo, a thin divider, then the La-Z-Boy logo
      let x = 15;
      if (m.logoBase64) {
        try {
          const ip = doc.getImageProperties(m.logoBase64);
          const sc = Math.min(24 / ip.width, 14 / ip.height);
          doc.addImage(m.logoBase64, 'PNG', x, 10, ip.width * sc, ip.height * sc);
          x += ip.width * sc + 4;
        } catch (_) {}
      }
      if (m.lazboyLogoBase64) {
        doc.setDrawColor('#CBD5E1'); doc.setLineWidth(0.3); doc.line(x, 11, x, 23);
        x += 4;
        try {
          const ip = doc.getImageProperties(m.lazboyLogoBase64);
          const sc = Math.min(32 / ip.width, 11 / ip.height);
          doc.addImage(m.lazboyLogoBase64, 'PNG', x, 12 + (11 - ip.height * sc) / 2, ip.width * sc, ip.height * sc);
        } catch (_) {}
      }
    }
    if (page === 1) {
      if (m.logoBase64 && !lz) {
        try {
          const ip = doc.getImageProperties(m.logoBase64);
          const maxW = 52, maxH = 22;
          const sc = Math.min(maxW / ip.width, maxH / ip.height);
          doc.addImage(m.logoBase64, 'PNG', 15, 8, ip.width * sc, ip.height * sc);
        } catch (_) {}
      }
      doc.setFont('Helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(ACC);
      doc.text(title, lz ? 112 : W / 2, 14 + (lz ? 3 : 0), { align: 'center' });
      doc.setFontSize(10); doc.setTextColor(INK);
      doc.text(p.brand === 'Little Nap' ? 'LITTLE NAP RECLINERS' : lz ? 'LA-Z-BOY RECLINERS' : p.brand.toUpperCase(), lz ? 112 : W / 2, 19.5 + (lz ? 3 : 0), { align: 'center' });
      const co = (m.companyDetails && m.companyDetails.trim() ? m.companyDetails : DEFAULT_COMPANY)
        .split(/\r?\n/).map(x => x.trim()).filter(Boolean);
      let cy = 10;
      co.forEach((ln, i) => {
        doc.setFont('Helvetica', i === 0 ? 'bold' : 'normal');
        doc.setFontSize(i === 0 ? 7.5 : 6.8);
        doc.setTextColor(i === 0 ? INK : GREY);
        (doc.splitTextToSize(ln, 70) as string[]).forEach(part => {
          doc.text(part, W - 15, cy, { align: 'right' });
          cy += i === 0 ? 3.5 : 3.5;
        });
      });
      y = Math.max(31, cy + 1.5);
    } else {
      doc.setFont('Helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(GREY);
      doc.text(`${m.number} | Page ${page}`, 15, 12);
      doc.text(`${p.brand.toUpperCase()} - ${title} (continued)`, W - 15, 12, { align: 'right' });
      y = 15;
    }
    doc.setDrawColor(LINE); doc.setLineWidth(0.4); doc.line(15, y, W - 15, y);
    y += 5;
  };

  const tableHead = () => {
    doc.setFillColor(HEAD); doc.rect(15, y, W - 30, 11, 'F');
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor('#FFFFFF');
    doc.text('Sr.', 17, y + 7);
    doc.text('Item', 27, y + 7);
    doc.text('Qty', colQty, y + 7, { align: 'right' });
    doc.text(project ? 'Price (Rs.)' : 'MRP (Rs.)', colRate, y + 5, { align: 'right' });
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor('#CBD5E1');
    doc.text('(GST included)', colRate, y + 9, { align: 'right' });
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor('#FFFFFF');
    if (hasDisc) {
      doc.text('Discount', colDisc, y + 7, { align: 'right' });
      doc.text('Special', colSpecial, y + 5, { align: 'right' });
      doc.text('Price (Rs.)', colSpecial, y + 9, { align: 'right' });
    }
    doc.text('Amount (Rs.)', colTotal, y + 7, { align: 'right' });
    y += 11;
  };

  const space = (h: number, withHead = false, limit = 284) => {
    if (y + h > limit) {
      doc.addPage(); page += 1; header();
      if (withHead) tableHead();
    }
  };

  const heading = (txt: string) => {
    space(10);
    doc.setFillColor(ACC); doc.rect(15, y - 3.5, 1.5, 4.5, 'F');
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(INK);
    doc.text(txt, 18, y);
    y += 5;
  };

  const kv = (a: string, b: string, x: number) => {
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(GREY);
    doc.text(`${a}  ${b}`, x, y);
  };

  header();

  heading(`${isPI ? 'PI' : 'QUOTATION'} DETAILS`);
  kv('Date:', m.date, 15); kv('Prepared by:', m.salespersonName, 112); y += 4.5;
  kv('Number:', m.number, 15); kv('Employee ID:', m.salespersonId || 'N/A', 112); y += 4.5;
  if (p.contact?.phone || p.contact?.email) {
    // contact sits on its own row, so the details block stays three rows tall
    if (p.contact.phone) kv('Contact:', p.contact.phone, 15);
    if (p.contact.email) kv('Email:', p.contact.email, 112);
    y += 4.5;
  }
  y += 2;

  heading('CLIENT & DELIVERY');
  kv('Client:', m.clientName || 'N/A', 15); kv('Phone:', m.mobile || 'N/A', 112); y += 4.5;
  kv('Email:', m.email || 'N/A', 15); y += 4.5;
  const cx = p.customer || {};
  if (cx.site) { kv('Site:', cx.site, 15); y += 4.5; }
  if (cx.gstin) { kv('Customer GSTIN:', cx.gstin, 15); y += 4.5; }
  y += 0.5;
  doc.setFont('Helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(INK);
  doc.text('BILLING ADDRESS', 15, y); doc.text('SHIPPING ADDRESS', 112, y); y += 4;
  doc.setFont('Helvetica', 'normal'); doc.setTextColor(GREY);
  const bl = doc.splitTextToSize(m.billing || 'N/A', 80);
  const sl = doc.splitTextToSize(m.shipping || m.billing || 'N/A', 80);
  doc.text(bl, 15, y); doc.text(sl, 112, y);
  y += Math.max(bl.length, sl.length) * 4 + 4;

  heading('ITEMS');
  tableHead();

  p.lines.forEach((l, i) => {
    const lt = t.effLines[i];
    const q = Math.max(0.0001, Number(l.qty) || 1);
    const comps = lineComponents(l, lt, project);
    const metreMain = l.category === 'Upholstery' || isMetreOption(l);
    const qtyText = (n: number, metre: boolean) => `${Number.isInteger(n) ? n : n.toFixed(2)}${metre ? ' m' : ''}`;

    doc.setFont('Helvetica', 'bold'); doc.setFontSize(8.5);
    const desc: string[] = doc.splitTextToSize(`${l.item}${l.variant && !['Standard', 'Per seat', 'Per piece'].includes(l.variant) ? ` (${l.variant})` : ''}`, descW);
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(7.5);
    const specLines: string[] = [];
    (l.specs || []).filter(sp => sp.label.trim() && sp.value.trim()).forEach((sp, k) => {
      specLines.push(...doc.splitTextToSize(`${String.fromCharCode(97 + (k % 26))}. ${sp.label.trim()} : ${sp.value.trim()}`, descW - 3));
    });
    const opts = l.options.map((o, k) => {
      const per = o.qty > 1 ? ` x${Number.isInteger(o.qty) ? o.qty : o.qty.toFixed(2)}` : '';
      const od = !project && l.partDiscounts && o.discount && o.discount.value > 0
        ? (o.discount.mode === 'pct' ? `  less ${o.discount.value}%` : `  less Rs. ${money(o.discount.value)}`)
        : '';
      const label = isMetreOption(o)
        ? `+ ${o.item} - ${o.qty} m`
        : `+ ${o.item}${o.variant && !['Per seat', 'Per piece'].includes(o.variant) ? ` (${o.variant})` : ''}${per}`;
      return { lines: doc.splitTextToSize(label + od, descW - 3) as string[], comp: comps[k + 1] };
    });
    const noteLines: string[] = l.note ? doc.splitTextToSize(`Note: ${l.note}`, descW - 3) : [];

    const h = Math.max(desc.length * 4.2 + 1.5, hasDisc ? 10 : 8)
      + (specLines.length ? specLines.length * 3.6 + 1 : 0)
      + opts.reduce((sum, o) => sum + o.lines.length * 3.6 + 0.8, 0)
      + noteLines.length * 3.6 + 2;
    space(h, true);

    const numbers = (c: { gross: number; disc: number; net: number }, yy: number, qtyTxt: string, main: boolean) => {
      doc.text(qtyTxt, colQty, yy, { align: 'right' });
      doc.text(money((project ? c.net : c.gross) / q), colRate, yy, { align: 'right' });
      if (hasDisc) {
        if (c.disc > 0) {
          doc.text(`-${money(c.disc / q)}`, colDisc, yy, { align: 'right' });
          if (main) {
            const pct = c.gross > 0 ? Math.round(c.disc / c.gross * 10000) / 100 : 0;
            doc.setFontSize(7); doc.setTextColor(GREY);
            doc.text(`(${pct}%)`, colDisc, yy + 3.6, { align: 'right' });
            doc.setFontSize(8.5); doc.setTextColor(INK);
          }
        } else {
          doc.text('-', colDisc, yy, { align: 'right' });
        }
        doc.text(money(c.net / q), colSpecial, yy, { align: 'right' });
      }
      doc.text(money(c.net), colTotal, yy, { align: 'right' });
    };

    const top = y + 4.5;
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(INK);
    doc.text(String(i + 1), 17, top);
    doc.setFont('Helvetica', 'bold');
    doc.text(desc, 27, top);
    doc.setFont('Helvetica', 'normal');
    numbers(comps[0], top, qtyText(l.qty, metreMain), true);

    let oy = top + (desc.length - 1) * 4.2 + 4.2 + (hasDisc && comps[0].disc > 0 ? 0 : 0);
    doc.setFontSize(7.5); doc.setTextColor(GREY);
    specLines.forEach(sp => { doc.text(sp, 29, oy); oy += 3.6; });
    if (specLines.length) oy += 1;
    opts.forEach(o => {
      doc.setFont('Helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(GREY);
      doc.text(o.lines, 29, oy);
      numbers(o.comp, oy, qtyText(l.qty, false), false);
      oy += o.lines.length * 3.6 + 0.8;
    });
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(GREY);
    noteLines.forEach(nl => { doc.text(nl, 29, oy); oy += 3.6; });
    y += h;
    doc.setDrawColor(LINE); doc.setLineWidth(0.2); doc.line(15, y, W - 15, y);
  });

  // totals
  space(40);
  y += 5;
  const row = (label: string, val: string, bold = false) => {
    doc.setFont('Helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(bold ? 10 : 8.5);
    doc.setTextColor(bold ? INK : GREY);
    doc.text(label, 140, y, { align: 'right' });
    doc.text(val, colTotal, y, { align: 'right' });
    y += bold ? 6 : 4.8;
  };
  row('Sub Total', `Rs. ${money(t.taxable)}`);
  row('Taxable Value (excl. GST)', `Rs. ${money(t.taxableExGst)}`);
  row(`GST @ ${t.gstRate}% (included)`, `Rs. ${money(t.gstIncluded)}`);
  if (p.freight.mode === 'extra') row('Freight', `Rs. ${money(t.freightExtra)}`);
  else row('Freight', 'Included');
  if (t.installation > 0) row('Installation', `Rs. ${money(t.installation)}`);
  doc.setDrawColor(ACC); doc.setLineWidth(0.5); doc.line(100, y - 3, W - 15, y - 3);
  y += 1.5;
  row('GRAND TOTAL', `Rs. ${money(t.grandTotal)}`, true);
  doc.setFont('Helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(GREY);
  doc.text(numberToWords(t.grandTotal), 15, y);
  y += 6;
  y += 2;

  if (m.bank && p.showBank !== false) {
    heading('BANK DETAILS');
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(GREY);
    doc.splitTextToSize(m.bank, W - 35).forEach((s: string) => { space(5); doc.text(s, 15, y); y += 4.2; });
    y += 3;
  }

  if (m.terms.length) {
    heading('TERMS & CONDITIONS');
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(7.6); doc.setTextColor(GREY);
    m.terms.forEach((tx, i) => {
      const lines = doc.splitTextToSize(`${i + 1}. ${tx}`, W - 30);
      space(lines.length * 3.4 + 1, false, 266);
      doc.text(lines, 15, y);
      y += lines.length * 3.4 + 0.8;
    });
  }

  if (y + 24 > 292) { doc.addPage(); page += 1; header(); }
  y += 2;
  doc.setDrawColor(LINE); doc.line(130, y + 6, W - 15, y + 6);
  doc.setFont('Helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(INK);
  let sy = y + 10.5;
  if (m.salespersonName) { doc.text(m.salespersonName, W - 15, sy, { align: 'right' }); sy += 4; }
  doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(GREY);
  if (m.salespersonRole) { doc.text(m.salespersonRole, W - 15, sy, { align: 'right' }); sy += 4; }
  if (m.salespersonPhone) { doc.text(`Phone: ${m.salespersonPhone}`, W - 15, sy, { align: 'right' }); sy += 4; }
  doc.text('Authorised Signatory', W - 15, sy, { align: 'right' });

  return doc;
}

/** Attaches the brochure / warehouse policy and any extra files the user chose. */
export async function mergePdf(core: jsPDF, opts: { brochure?: ArrayBuffer | null; attachments?: Attachment[] }): Promise<Uint8Array> {
  const merged = await PDFDocument.load(core.output('arraybuffer'));
  if (opts.brochure) {
    try {
      const b = await PDFDocument.load(opts.brochure);
      (await merged.copyPages(b, b.getPageIndices())).forEach(pg => merged.addPage(pg));
    } catch (e) { console.error('brochure merge failed', e); }
  }
  for (const f of opts.attachments || []) {
    try {
      if (f.type === 'pdf' && f.arrayBuffer) {
        const s = await PDFDocument.load(f.arrayBuffer);
        (await merged.copyPages(s, s.getPageIndices())).forEach(pg => merged.addPage(pg));
      } else if (f.type === 'image' && f.base64Url) {
        const pg = merged.addPage([595.276, 841.89]);
        const raw = Uint8Array.from(atob(f.base64Url.split(',')[1]), c => c.charCodeAt(0));
        const img = f.base64Url.startsWith('data:image/png') ? await merged.embedPng(raw) : await merged.embedJpg(raw);
        const d = img.scale(1);
        const sc = Math.min(1, (595.276 - 40) / d.width, (841.89 - 40) / d.height);
        pg.drawImage(img, { x: (595.276 - d.width * sc) / 2, y: (841.89 - d.height * sc) / 2, width: d.width * sc, height: d.height * sc });
      }
    } catch (e) { console.error('attachment merge failed', f.name, e); }
  }
  return await merged.save();
}
