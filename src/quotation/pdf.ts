import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';
import { QuotePayload, TermRow } from './types';
import { calcTotals, numberToWords } from './pricing';

const GOLD = '#9B7C50';
const INK = '#0F172A';
const GREY = '#475569';
const LINE = '#E2E8F0';

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
  bank?: string;
  terms: string[];
  logoBase64?: string | null;
}

export interface Attachment {
  id: string;
  name: string;
  type: 'pdf' | 'image';
  base64Url?: string;
  arrayBuffer?: ArrayBuffer;
}

const money = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function termsFor(terms: TermRow[], brand: string): string[] {
  return terms.filter(t => t.brand === brand && t.active).sort((a, b) => a.no - b.no).map(t => t.text);
}

export function buildCorePdf(p: QuotePayload, m: PdfMeta): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const t = calcTotals(p);
  const isPI = p.docType === 'PI';
  const title = isPI ? 'PROFORMA INVOICE' : 'QUOTATION';
  const hasDisc = t.hasAnyDiscount;
  let y = 0;
  let page = 1;

  const colQty = hasDisc ? 104 : 125;
  const colRate = hasDisc ? 125 : 160;   // MRP
  const colDisc = 147;
  const colSpecial = 169;
  const colTotal = 193;
  const descW = hasDisc ? 66 : 92;

  const header = () => {
    doc.setFillColor(GOLD); doc.rect(0, 0, W, 3, 'F');
    if (page === 1) {
      if (m.logoBase64) { try { doc.addImage(m.logoBase64, 'PNG', 15, 9, 34, 18); } catch (_) {} }
      doc.setFont('Helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(GOLD);
      doc.text(title, W / 2, 14, { align: 'center' });
      doc.setFontSize(10); doc.setTextColor(INK);
      doc.text(p.brand === 'Little Nap' ? 'LITTLE NAP RECLINERS' : p.brand.toUpperCase(), W / 2, 19.5, { align: 'center' });
      doc.setFont('Helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(INK);
      doc.text('Little Nap Designs Pvt. Ltd.', W - 15, 10, { align: 'right' });
      doc.setFont('Helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(GREY);
      doc.text('IVR Number: +91 8882800600', W - 15, 13.5, { align: 'right' });
      doc.text('Email: enquiry@littlenap.in', W - 15, 17, { align: 'right' });
      doc.text('GSTIN: 06AACCL0576H1ZM', W - 15, 20.5, { align: 'right' });
      doc.text('Corp. Office: 844, M.G. Road, Ghitorni,', W - 15, 24, { align: 'right' });
      doc.text('New Delhi - 110030, India', W - 15, 27.5, { align: 'right' });
      y = 31;
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
    doc.setFillColor(INK); doc.rect(15, y, W - 30, 11, 'F');
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor('#FFFFFF');
    doc.text('Sr.', 17, y + 7);
    doc.text('Item', 27, y + 7);
    doc.text('Qty', colQty, y + 7, { align: 'right' });
    doc.text('MRP (Rs.)', colRate, y + 5, { align: 'right' });
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

  const space = (h: number, withHead = false) => {
    if (y + h > 275) {
      doc.addPage(); page += 1; header();
      if (withHead) tableHead();
    }
  };

  const heading = (txt: string) => {
    space(10);
    doc.setFillColor(GOLD); doc.rect(15, y - 3.5, 1.5, 4.5, 'F');
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
  kv('Number:', m.number, 15); kv('Employee No:', m.salespersonId || 'N/A', 112); y += 4.5;
  y += 3;

  heading('CLIENT & DELIVERY');
  kv('Client:', m.clientName || 'N/A', 15); kv('Phone:', m.mobile || 'N/A', 112); y += 4.5;
  kv('Email:', m.email || 'N/A', 15); y += 5;
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
    const desc: string[] = [];
    const main = `${l.item}${l.variant && l.variant !== 'Standard' ? ` (${l.variant})` : ''}`;
    doc.setFont('Helvetica', 'bold'); doc.setFontSize(8.5);
    desc.push(...doc.splitTextToSize(main, descW));
    const optLines: string[] = [];
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(7.5);
    l.options.forEach(o => {
      const q = o.qty > 1 ? ` x${o.qty}` : '';
      const label = `+ ${o.item}${o.variant && o.variant !== 'Per seat' ? ` (${o.variant})` : ''}${q}  Rs. ${money(o.unitPrice * o.qty)}`;
      optLines.push(...doc.splitTextToSize(label, descW - 3));
    });
    if (l.note) optLines.push(...doc.splitTextToSize(`Note: ${l.note}`, descW - 3));
    const h = Math.max((desc.length * 4.2) + (optLines.length * 3.6) + 4, hasDisc ? 10 : 8);
    space(h, true);

    const top = y + 4.5;
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(INK);
    doc.text(String(i + 1), 17, top);
    doc.setFont('Helvetica', 'bold');
    doc.text(desc, 27, top);
    doc.setFont('Helvetica', 'normal');
    const perPiece = lt.gross / Math.max(1, l.qty);
    doc.text(String(l.qty), colQty, top, { align: 'right' });
    doc.text(money(perPiece), colRate, top, { align: 'right' });
    if (hasDisc) {
      const q = Math.max(1, l.qty);
      if (lt.discount > 0) {
        const pct = lt.gross > 0 ? Math.round(lt.discount / lt.gross * 10000) / 100 : 0;
        doc.text(`-${money(lt.discount / q)}`, colDisc, top, { align: 'right' });
        doc.setFontSize(7); doc.setTextColor(GREY);
        doc.text(`(${pct}%)`, colDisc, top + 3.6, { align: 'right' });
        doc.setFontSize(8.5); doc.setTextColor(INK);
      } else {
        doc.text('-', colDisc, top, { align: 'right' });
      }
      doc.text(money(lt.net / q), colSpecial, top, { align: 'right' });
    }
    doc.text(money(lt.net), colTotal, top, { align: 'right' });
    let oy = top + (desc.length - 1) * 4.2 + 3.8;
    doc.setFontSize(7.5); doc.setTextColor(GREY);
    optLines.forEach(s => { doc.text(s, 29, oy); oy += 3.6; });
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
  doc.setDrawColor(GOLD); doc.setLineWidth(0.5); doc.line(100, y - 3, W - 15, y - 3);
  y += 1.5;
  row('GRAND TOTAL', `Rs. ${money(t.grandTotal)}`, true);
  doc.setFont('Helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(GREY);
  doc.text(numberToWords(t.grandTotal), 15, y);
  y += 8;

  if (m.bank) {
    heading('BANK DETAILS');
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(GREY);
    doc.splitTextToSize(m.bank, W - 35).forEach((s: string) => { space(5); doc.text(s, 15, y); y += 4.2; });
    y += 3;
  }

  if (m.terms.length) {
    heading('TERMS & CONDITIONS');
    doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(GREY);
    m.terms.forEach((tx, i) => {
      const lines = doc.splitTextToSize(`${i + 1}. ${tx}`, W - 35);
      space(lines.length * 3.8 + 1);
      doc.text(lines, 15, y);
      y += lines.length * 3.8 + 1;
    });
  }

  // signature
  space(24);
  y += 8;
  doc.setDrawColor(LINE); doc.line(130, y + 10, W - 15, y + 10);
  doc.setFont('Helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(GREY);
  doc.text('Authorised Signatory', W - 15, y + 14, { align: 'right' });

  return doc;
}

/** Attaches the brochure / warehouse policy (PI only) and any extra files the user chose. */
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
