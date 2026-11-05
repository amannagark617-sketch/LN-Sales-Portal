export type StockTab = 'littlenap' | 'lazboy' | 'motion';

export interface StockItem {
  id: string;
  tab: StockTab;
  model: string;
  /** product description or configuration, first line */
  title: string;
  /** extra detail lines (dimensions, seat width, description) */
  details: string[];
  kind: 'Motorised' | 'Manual' | 'Fixed' | '';
  functionality: string;
  material: string;
  upholstery: string;
  shade: string;
  qty: number;
  image: string;
  /** Google Drive file id behind the photo link; the file can be a PDF with several pages */
  fileId: string;
  code: string;
  note: string;
  price: number;
}

export interface StockTabData { items: StockItem[]; error?: string }
export interface StockPayload { tabs: Record<StockTab, StockTabData>; loadedAt: number }

const norm = (s: string) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
/** Header text as Google exports it: a number from a title row can end up in front of it ("70 QTY."). */
const normHeader = (s: string) => norm(s).replace(/^\d+(\.\d+)?\s+(?=\D)/, '');
const clean = (s: string | undefined) => String(s ?? '').replace(/\r/g, '').trim();
const KEEP_UPPER = new Set(['NX', 'HR', 'USB', 'XR', 'LED', 'OPF', 'II', 'III']);
const SMALL = new Set(['of', 'and', 'with', 'in', 'on', 'for', 'to', 'the']);

export function titleCase(input: string): string {
  const s = clean(input).replace(/\s*,\s*/g, ', ').replace(/[ \t]{2,}/g, ' ').replace(/(\d)\s*STR\b/gi, '$1 Seater');
  if (!s) return '';
  if (s !== s.toUpperCase()) return s; // already mixed case, leave it as typed
  return s.toLowerCase().replace(/[^\s+,()\-]+/g, (w, i) => {
    const up = w.toUpperCase();
    if (KEEP_UPPER.has(up) || w.includes('/') || /\d/.test(w) && w.length <= 3) return up;
    if (i > 0 && SMALL.has(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1);
  });
}

export function imageUrl(cell: string): string {
  const m = clean(cell).match(/https?:\/\/[^\s,"]+/);
  if (!m) return '';
  const url = m[0];
  if (/googleusercontent\.com\/d\//.test(url)) return url.replace(/=w\d+.*$/, '') + '=w800';
  if (/drive\.google\.com/.test(url)) {
    const id = (url.match(/\/d\/([\w-]+)/) || url.match(/[?&]id=([\w-]+)/) || [])[1];
    return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w800` : '';
  }
  return url;
}

export function driveFileId(cell: string): string {
  const m = clean(cell).match(/https?:\/\/drive\.google\.com[^\s,"]*/);
  if (!m) return '';
  return ((m[0].match(/\/d\/([\w-]+)/) || m[0].match(/[?&]id=([\w-]+)/) || [])[1]) || '';
}

const kindOf = (s: string): StockItem['kind'] => {
  const u = s.toUpperCase();
  if (/MOTOR/.test(u)) return 'Motorised';
  if (/MANUAL/.test(u)) return 'Manual';
  if (/FIXED/.test(u)) return 'Fixed';
  return '';
};
const materialOf = (s: string): string => {
  const u = s.toUpperCase();
  if (/LEATHER/.test(u)) return 'Leather';
  if (/FABRIC/.test(u)) return 'Fabric';
  return titleCase(s);
};
const num = (s: string | undefined) => {
  const n = Number(String(s ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/** Finds the header row (it is not always row 1 because some tabs have a title row above it). */
function findHeader(rows: string[][], needs: string[]): { at: number; cols: string[] } | null {
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const cols = rows[i].map(normHeader);
    if (needs.every(n => cols.some(c => c === n || c.startsWith(n)))) return { at: i, cols };
  }
  return null;
}
const colIdx = (cols: string[], name: string, exact = false) => {
  const i = cols.findIndex(c => c === name);
  if (i >= 0 || exact) return i;
  return cols.findIndex(c => c.startsWith(name));
};

export function parseLittleNap(rows: string[][]): StockItem[] {
  // Columns of the Response Ready Goods tab, used when Google does not hand over a readable header row.
  const POS = { code: 3, model: 4, fun: 5, up: 6, shade: 7, photo: 8, desc: 9, dim: 10, qty: 11 };
  const h = findHeader(rows, ['model']);
  let col = { ...POS };
  let start = 0;
  if (h) {
    const c = (n: string, d: number) => { const i = colIdx(h.cols, n); return i >= 0 ? i : d; };
    col = { code: c('code', POS.code), model: c('model', POS.model), fun: c('functionality', POS.fun), up: c('upholstery type', POS.up),
      shade: c('upholstery code', POS.shade), photo: c('photos', POS.photo), desc: c('description', POS.desc), dim: c('dimensions', POS.dim), qty: -1 };
    // the quantity header can come through as "70 QTY." or similar, so look for any header containing QTY
    const q = h.cols.findIndex(x => x.includes('qty') || x.includes('quantity'));
    col.qty = q >= 0 ? q : POS.qty;
    start = h.at + 1;
  }
  const out: StockItem[] = [];
  rows.slice(start).forEach((r, k) => {
    const model = clean(r[col.model]); const qty = num(r[col.qty]);
    if (!model || qty <= 0 || norm(model) === 'model') return;
    const fun = clean(r[col.fun]); const up = clean(r[col.up]);
    const desc = clean(r[col.desc]).replace(/\s{3,}/g, ' ');
    const dim = clean(r[col.dim]).replace(/\s*,\s*$/, '');
    out.push({
      id: `ln-${k}`, tab: 'littlenap', model: titleCase(model), title: titleCase(fun) || 'Recliner',
      details: [desc && titleCase(desc), dim && titleCase(dim)].filter(Boolean) as string[],
      kind: kindOf(fun), functionality: titleCase(fun), material: materialOf(up), upholstery: titleCase(up),
      shade: titleCase(clean(r[col.shade])), qty, image: imageUrl(r[col.photo]), fileId: driveFileId(r[col.photo]), code: clean(r[col.code]), note: '', price: 0
    });
  });
  return out;
}

export function parseLaZBoy(rows: string[][]): StockItem[] {
  const h = findHeader(rows, ['model name', 'qty']); if (!h) throw new Error('Could not find the header row (Model Name, Qty.) in the La-Z-Boy Stock tab.');
  const c = (n: string, exact = false) => colIdx(h.cols, n, exact);
  const iM = c('model name'), iDesc = c('product description'), iCode = c('model code'), iCover = c('cover code'), iFun = c('functionality'),
    iColour = c('cover', true), iQ = c('qty'), iImg = c('images link'), iHold = c('book in this opf'), iBox = c('no. of boxes'), iPrice = c('price', true);
  const upCols = h.cols.map((x, i) => x.startsWith('upholstery type') ? i : -1).filter(i => i >= 0);
  const out: StockItem[] = [];
  rows.slice(h.at + 1).forEach((r, k) => {
    const model = clean(r[iM]); const qty = num(r[iQ]);
    if (!model || qty <= 0) return;
    const up = upCols.map(i => clean(r[i])).find(Boolean) || '';
    const fun = clean(r[iFun]);
    const boxes = clean(r[iBox]);
    out.push({
      id: `lz-${k}`, tab: 'lazboy', model: titleCase(model), title: titleCase(clean(r[iDesc])) || 'Recliner',
      details: [boxes && `${boxes} box${num(boxes) === 1 ? '' : 'es'}`].filter(Boolean) as string[],
      kind: kindOf(fun), functionality: titleCase(fun), material: materialOf(up), upholstery: up,
      shade: titleCase(clean(r[iColour])), qty, image: imageUrl(r[iImg]), fileId: driveFileId(r[iImg]), code: [clean(r[iCode]), clean(r[iCover])].filter(Boolean).join(' · '),
      note: clean(r[iHold]), price: num(r[iPrice])
    });
  });
  return out;
}

export function parseMotion(rows: string[][]): StockItem[] {
  const h = findHeader(rows, ['model', 'configuration']); if (!h) throw new Error('Could not find the header row (MODEL, CONFIGURATION) in the Linea & Puls details tab.');
  const c = (n: string) => colIdx(h.cols, n);
  const iM = c('model'), iU = c('upholstery'), iC = c('colour'), iCfg = c('configuration'), iImg = c('image links'), iQ = c('qty');
  const iRem = c('remarks');
  const out: StockItem[] = [];
  rows.slice(h.at + 1).forEach((r, k) => {
    const model = clean(r[iM]); const qty = num(r[iQ]);
    if (!model || qty <= 0) return;
    const lines = clean(r[iCfg]).split('\n').map(x => x.trim()).filter(Boolean);
    const first = lines[0] || '';
    out.push({
      id: `mo-${k}`, tab: 'motion', model: titleCase(model), title: titleCase(first) || 'Motion sofa',
      details: lines.slice(1).map(x => x.replace(/^\(|\)$/g, '')),
      kind: kindOf(first), functionality: kindOf(first), material: materialOf(clean(r[iU])), upholstery: titleCase(clean(r[iU])),
      shade: titleCase(clean(r[iC])), qty, image: imageUrl(r[iImg]), fileId: driveFileId(r[iImg]), code: '', note: iRem >= 0 ? clean(r[iRem]) : '', price: 0
    });
  });
  return out;
}
