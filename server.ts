import express from "express";
import compression from "compression";
import { parseOrderRows, normOpf, OrderHistory } from "./src/orders/status";
import { parseLittleNap, parseLaZBoy, parseMotion, StockPayload, StockTab, StockTabData } from "./src/stock/stock";
import path from "path";
import { createServer as createViteServer } from "vite";
import {
  calcTotals, validatePayload, nextNumber, numberToWords, payloadHasEditedPrices, docPrefix
} from "./src/quotation/pricing";
import type { Brand, DocType, PriceRow, QuotePayload, TermRow } from "./src/quotation/types";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

let salespersonsCache: CacheEntry<any[]> | null = null;
let targetsCache: CacheEntry<any[]> | null = null;
let validationCache: CacheEntry<any> | null = null;
let opfDataCache: CacheEntry<any[]> | null = null;
// Separate, longer-lived cache of the same OPF sheet used only by dashboard / list views.
// The OPF number sequence calculation keeps using opfDataCache (short TTL) exactly as before.
let opfViewCache: CacheEntry<any[]> | null = null;
let codeMapCache: CacheEntry<Record<string, string>> | null = null;
let quotationOptionsCache: CacheEntry<any[]> | null = null;
let quotationHistoryCache: CacheEntry<any[]> | null = null;
let bankDetailsCache: CacheEntry<any[]> | null = null;

const CACHE_TTL = 4000; // 4 seconds for fast real-time sequence synchronization (OPF / quotation numbering)
const LONG_TTL = 60000; // 60 seconds for data that is only displayed (dashboards, lists, auth lookups)

const BASE_URL = 'https://docs.google.com/spreadsheets/d/1-K_S1HXjca8dy0Sbl2qN7ts_e_YnKg5fBVSmaHB8kgU/export?format=csv&gid=';

function cleanStr(val: string | undefined): string {
  if (!val) return '';
  return val.replace(/[\r\n]/g, '').replace(/^"|"$/g, '').trim();
}

function cleanNum(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/[\r\n"',]/g, '').trim();
  return Number(cleaned) || 0;
}

function normalizeShowroomName(name: string | undefined): string {
  if (!name) return '';
  return name
    .replace(/[\r\n\t"]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function isRoomMatch(room1: string | undefined, room2: string | undefined): boolean {
  const r1 = normalizeShowroomName(room1);
  const r2 = normalizeShowroomName(room2);
  if (!r1 || !r2) return false;
  if (r1 === r2) return true;
  const stripped1 = r1.replace(/\bshowroom\b/g, '').trim();
  const stripped2 = r2.replace(/\bshowroom\b/g, '').trim();
  return stripped1 === stripped2;
}

function isRowInManagerRooms(rowRoom: string | undefined, managerRooms: Set<string>): boolean {
  if (!rowRoom) return false;
  for (const mRoom of managerRooms) {
    if (isRoomMatch(rowRoom, mRoom)) return true;
  }
  return false;
}

async function getSalespersons(): Promise<any[]> {
  const response = await fetch(`${BASE_URL}501620290`);
  const csvText = await response.text();
  const lines = csvText.split(/\r?\n/);
  const head = (lines[0] || '').split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(h => cleanStr(h).toLowerCase());
  const designationCol = head.indexOf('designation');
  return lines.slice(1).filter(line => line.trim() !== '').map(line => {
    const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    const col5 = cleanStr(values[5]);
    const col6 = cleanStr(values[6]);
    return {
      region: cleanStr(values[0]),
      showroom: cleanStr(values[1]),
      name: cleanStr(values[2]),
      id: cleanStr(values[3]),
      password: cleanStr(values[4]),
      code: col5,
      manager: col5,
      isManager: col5.toLowerCase() === 'manager',
      managerAccess: col6,
      mobile: cleanStr(values[7]),
      email: cleanStr(values[8]),
      team: cleanStr(values[9]),
      // blank means still working; only an explicit No switches a person off
      active: cleanStr(values[10]).toLowerCase() !== 'no',
      designation: designationCol >= 0 ? cleanStr(values[designationCol]) : '',
    };
  });
}

async function getTargets(): Promise<any[]> {
  const response = await fetch(`${BASE_URL}1850303239`); 
  const csvText = await response.text();
  const lines = csvText.split(/\r?\n/);
  const results: any[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    let values: string[] = [];
    if (line.includes('\t')) {
      values = line.split('\t');
    } else {
      values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    }
    
    const clean = (v: string | undefined) => v ? v.replace(/^["']|["']$/g, '').trim() : '';
    
    const salesperson = clean(values[0]);
    const rawDate = clean(values[1]);
    const rawTarget = clean(values[2]);
    
    if (!salesperson || !rawDate) continue;

    let normalizedMonthYear = rawDate;
    const parts = rawDate.split(/[/-]/);
    
    if (parts.length === 3) {
        if (parts[2].length === 4) {
            normalizedMonthYear = `${parts[1].padStart(2, '0')}-${parts[2]}`;
        } else if (parts[0].length === 4) {
            normalizedMonthYear = `${parts[1].padStart(2, '0')}-${parts[0]}`;
        }
    } else if (parts.length === 2) {
        if (parts[1].length === 4) {
            normalizedMonthYear = `${parts[0].padStart(2, '0')}-${parts[1]}`;
        } else if (parts[0].length === 4) {
            normalizedMonthYear = `${parts[1].padStart(2, '0')}-${parts[0]}`;
        }
    }

    const targetValue = Number(rawTarget.replace(/["',]/g, '')) || 0;
    
    results.push({
      salesperson,
      monthYear: normalizedMonthYear,
      target: targetValue
    });
  }
  return results;
}

async function getValidationData(): Promise<any> {
  const response = await fetch(`${BASE_URL}1117643655`);
  const csvText = await response.text();
  const lines = csvText.split('\n');
  const data: any = {
    segments: [],
    leadSources: [],
    subSegments: [],
    brands: [],
    models: [],
    functionalities: [],
    categories: [],
    crrNbds: [],
    typesOfBusiness: []
  };
  
  lines.slice(1).filter(line => line.trim() !== '').forEach(line => {
    const values = line.split(',');
    const trimValue = (v: string | undefined) => v?.trim();
    
    if (trimValue(values[0])) data.segments.push(trimValue(values[0])!);
    if (trimValue(values[1])) data.leadSources.push(trimValue(values[1])!);
    if (trimValue(values[2])) data.subSegments.push(trimValue(values[2])!);
    if (trimValue(values[3])) data.brands.push(trimValue(values[3])!);
    if (trimValue(values[4])) data.models.push(trimValue(values[4])!);
    if (trimValue(values[5])) data.functionalities.push(trimValue(values[5])!);
    if (trimValue(values[6])) data.categories.push(trimValue(values[6])!);
    if (trimValue(values[7])) data.crrNbds.push(trimValue(values[7])!);
    if (trimValue(values[8])) data.typesOfBusiness.push(trimValue(values[8])!);
  });
  return data;
}

async function getUniqueOPFCodeMap(): Promise<Record<string, string>> {
  const response = await fetch(`${BASE_URL}1178123264`);
  const csvText = await response.text();
  const lines = csvText.split('\n');
  const codeMap: Record<string, string> = {};
  lines.slice(1).filter(line => line.trim() !== '').forEach(line => {
    const values = line.split(',');
    const visitTypeStr = values[0]?.trim().toLowerCase();
    const salespersonName = values[1]?.trim().toLowerCase();
    const opfCode = values[2]?.trim();
    
    if (salespersonName && visitTypeStr && opfCode) {
        const key = `${visitTypeStr}-${salespersonName}`;
        codeMap[key] = opfCode;
    }
  });
  return codeMap;
}

async function getOPFData(): Promise<any[]> {
  const response = await fetch(`${BASE_URL}991175139`);
  const csvText = await response.text();
  const lines = csvText.split(/\r?\n/);
  return lines.slice(1).filter(line => line.trim() !== '').map(line => {
    const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    
    return {
      date: cleanStr(values[0]),
      salesperson: cleanStr(values[1]),
      opf: cleanStr(values[2]),
      region: cleanStr(values[3]),
      visitType: cleanStr(values[4]),
      segment: cleanStr(values[5]),
      subSegment: cleanStr(values[6]),
      leadSource: cleanStr(values[7]),
      clientName: cleanStr(values[8]),
      companyName: cleanStr(values[9]),
      mobileNumber: cleanStr(values[10]),
      emailId: cleanStr(values[11]),
      dealerName: cleanStr(values[12]),
      dealerMobileNumber: cleanStr(values[13]),
      dealerCompanyName: cleanStr(values[14]),
      dealerCity: cleanStr(values[15]),
      dealerState: cleanStr(values[16]),
      city: cleanStr(values[17]),
      state: cleanStr(values[18]),
      brandName: cleanStr(values[19]),
      model: cleanStr(values[20]),
      functionality: cleanStr(values[21]),
      category: cleanStr(values[22]),
      crrNbd: cleanStr(values[23]),
      typeOfBusiness: cleanStr(values[24]),
      quantity: cleanNum(values[25]),
      grossSales: cleanNum(values[26]),
      commission: cleanNum(values[27]),
      tax: cleanNum(values[28]),
      freightCharges: cleanNum(values[29]),
      netSales: cleanNum(values[30]),
      advanceAmount: cleanNum(values[31]),
      remarks: cleanStr(values[32]),
      clientVisits: cleanNum(values[33]),
      followUps: cleanNum(values[34]),
      showroom: cleanStr(values[36]) || cleanStr(values[3]),
    };
  });
}

function parseSafeDate(dStr: string | undefined): Date | null {
  if (!dStr) return null;
  const months: Record<string, number> = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
  const parts = dStr.split(/[\s,]+/)[0].split(/[-/]/);
  if (parts.length === 3) {
    const p0 = parts[0];
    const p1 = parts[1];
    const p2 = parts[2];
    if (isNaN(Number(p1)) && months[p1.toLowerCase().slice(0,3)] !== undefined) {
      const day = parseInt(p0, 10);
      const month = months[p1.toLowerCase().slice(0,3)];
      const year = parseInt(p2, 10);
      return new Date(year, month, day);
    }
    const day = parseInt(p0, 10);
    const month = parseInt(p1, 10) - 1;
    let year = parseInt(p2, 10);
    if (year < 100) year += 2000;
    return new Date(year, month, day);
  }
  const d = new Date(dStr);
  return isNaN(d.getTime()) ? null : d;
}

function resolveTargetShowroom(
  salespersonName: string,
  month: number,
  year: number,
  allUsers: any[],
  allRows: any[]
): string {
  const sNameLower = salespersonName.trim().toLowerCase();
  const userProfile = allUsers.find(u => u.name.trim().toLowerCase() === sNameLower);

  const monthSales = allRows.filter(r => {
    if (!r.salesperson || r.salesperson.trim().toLowerCase() !== sNameLower) return false;
    const d = parseSafeDate(r.date);
    return d && d.getMonth() + 1 === month && d.getFullYear() === year;
  });

  if (monthSales.length > 0) {
    const positiveSales = monthSales.filter(r => r.grossSales > 0);
    if (positiveSales.length > 0) {
      const counts: Record<string, number> = {};
      positiveSales.forEach(r => {
        const room = r.showroom || r.region;
        if (room) counts[room] = (counts[room] || 0) + r.grossSales;
      });
      const bestRoom = Object.keys(counts).sort((a,b) => counts[b] - counts[a])[0];
      if (bestRoom) return bestRoom;
    }
    const counts: Record<string, number> = {};
    monthSales.forEach(r => {
      const room = r.showroom || r.region;
      if (room) counts[room] = (counts[room] || 0) + 1;
    });
    const bestRoom = Object.keys(counts).sort((a,b) => counts[b] - counts[a])[0];
    if (bestRoom) return bestRoom;
  }

  // If month is in current profile timeframe (e.g. Sep 2026 onwards), use current profile showroom if available
  if (userProfile?.showroom && (year > 2026 || (year === 2026 && month >= 9))) {
    return userProfile.showroom;
  }

  // If past month with no transactions, check closest past transactions
  const targetTime = new Date(year, month - 1, 15).getTime();
  const pastSales = allRows.filter(r => {
    if (!r.salesperson || r.salesperson.trim().toLowerCase() !== sNameLower) return false;
    const d = parseSafeDate(r.date);
    return d && d.getTime() <= targetTime;
  }).sort((a, b) => (parseSafeDate(b.date)?.getTime() || 0) - (parseSafeDate(a.date)?.getTime() || 0));

  if (pastSales.length > 0) {
    return pastSales[0].showroom || pastSales[0].region;
  }

  return userProfile?.showroom || userProfile?.region || '';
}

// Memory-Cached Getters
async function getCachedSalespersons(): Promise<any[]> {
  const now = Date.now();
  if (salespersonsCache && (now - salespersonsCache.timestamp < LONG_TTL)) {
    return salespersonsCache.data;
  }
  const data = await getSalespersons();
  salespersonsCache = { data, timestamp: now };
  return data;
}

async function getCachedValidation(): Promise<any> {
  const now = Date.now();
  if (validationCache && (now - validationCache.timestamp < LONG_TTL)) {
    return validationCache.data;
  }
  const data = await getValidationData();
  validationCache = { data, timestamp: now };
  return data;
}

async function getCachedOPFData(): Promise<any[]> {
  const now = Date.now();
  if (opfDataCache && (now - opfDataCache.timestamp < CACHE_TTL)) {
    return opfDataCache.data;
  }
  const data = await getOPFData();
  opfDataCache = { data, timestamp: now };
  return data;
}

// Longer-lived OPF data for dashboards / "my submissions" / manager scoping.
// Not used by the OPF number sequence endpoint.
async function getCachedOPFDataForViews(): Promise<any[]> {
  const now = Date.now();
  if (opfViewCache && (now - opfViewCache.timestamp < LONG_TTL)) {
    return opfViewCache.data;
  }
  const data = await getOPFData();
  opfViewCache = { data, timestamp: now };
  return data;
}

async function getCachedTargets(): Promise<any[]> {
  const now = Date.now();
  if (targetsCache && (now - targetsCache.timestamp < LONG_TTL)) {
    return targetsCache.data;
  }
  const rawTargets = await getTargets();
  const allUsers = await getCachedSalespersons();
  const allRows = await getCachedOPFDataForViews();

  const data = rawTargets.map(t => {
    const [mStr, yStr] = t.monthYear.split('-');
    const m = Number(mStr);
    const y = Number(yStr);
    const showroom = resolveTargetShowroom(t.salesperson, m, y, allUsers, allRows);
    return { ...t, showroom };
  });

  targetsCache = { data, timestamp: now };
  return data;
}

async function getCachedCodeMap(): Promise<Record<string, string>> {
  const now = Date.now();
  if (codeMapCache && (now - codeMapCache.timestamp < CACHE_TTL)) {
    return codeMapCache.data;
  }
  const data = await getUniqueOPFCodeMap();
  codeMapCache = { data, timestamp: now };
  return data;
}

function parseQuotedCSV(text: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          field += '"';
          i++; // skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(field);
        field = "";
      } else if (char === '\n' || char === '\r') {
        row.push(field);
        field = "";
        if (row.some(val => val.trim() !== '')) {
          result.push(row);
        }
        row = [];
        if (char === '\r' && nextChar === '\n') {
          i++; // Skip standard Windows line endings
        }
      } else {
        field += char;
      }
    }
  }
  // push final field/row if any remaining
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some(val => val.trim() !== '')) {
      result.push(row);
    }
  }
  return result;
}

async function getQuotationOptions(): Promise<any[]> {
  const response = await fetch(`${BASE_URL}1570941522`);
  if (!response.ok) {
    throw new Error('Failed to fetch quotation options sheet');
  }
  const csvText = await response.text();
  const rows = parseQuotedCSV(csvText);
  return rows.slice(1).map(values => {
    const clean = (val: string | undefined) => val ? val.trim() : '';
    return {
      design: clean(values[0]),
      category: clean(values[1]),
      type: clean(values[2]),
      price: Number(clean(values[3]).replace(/[^0-9.]/g, '')) || 0,
      brand: clean(values[4])
    };
  });
}

async function getCachedQuotationOptions(): Promise<any[]> {
  const now = Date.now();
  if (quotationOptionsCache && (now - quotationOptionsCache.timestamp < CACHE_TTL)) {
    return quotationOptionsCache.data;
  }
  const data = await getQuotationOptions();
  quotationOptionsCache = { data, timestamp: now };
  return data;
}

async function getBankDetails(): Promise<any[]> {
  const response = await fetch(`${BASE_URL}2093321396`);
  if (!response.ok) {
    throw new Error('Failed to fetch bank details sheet');
  }
  const csvText = await response.text();
  const rows = parseQuotedCSV(csvText);
  return rows.slice(1).map(values => {
    const clean = (val: string | undefined) => val ? val.trim() : '';
    return {
      showroomOrRegion: clean(values[0]),
      bankingDetails: clean(values[1]),
      companyDetails: clean(values[2]),
      bankingDetails2: clean(values[3]),
      companyDetails2: clean(values[4])
    };
  });
}

async function getCachedBankDetails(): Promise<any[]> {
  const now = Date.now();
  if (bankDetailsCache && (now - bankDetailsCache.timestamp < CACHE_TTL)) {
    return bankDetailsCache.data;
  }
  const data = await getBankDetails();
  bankDetailsCache = { data, timestamp: now };
  return data;
}

// Strict reader: throws if the sheet cannot be read, so numbering never restarts from an empty list.
async function getQuotationHistoryStrict(): Promise<any[]> {
  const response = await fetch(`${BASE_URL}1236899347`);
  if (!response.ok) throw new Error('Could not read the quotation history sheet.');
  const csvText = await response.text();
  const rows = parseQuotedCSV(csvText);
  if (rows.length <= 1) return [];
  const clean = (val: string | undefined) => (val ? val.trim() : '');
  const toNum = (val: string | undefined) => Number(String(val || '').replace(/[^0-9.\-]/g, '')) || 0;

  return rows.slice(1).map(values => ({
    date: clean(values[0]),
    quotationNumber: clean(values[1]),
    opfCode: clean(values[2]),
    salespersonId: clean(values[3]),
    salespersonName: clean(values[4]),
    brandName: clean(values[5]),
    clientName: clean(values[6]),
    mobileNumber: clean(values[7]),
    emailId: clean(values[8]),
    billingAddress: clean(values[9]),
    shippingAddress: clean(values[10]),
    subtotal: toNum(values[11]),
    gstIncluded: toNum(values[12]),
    freight: toNum(values[13]),
    grandTotal: toNum(values[14]),
    amountInWords: clean(values[15]),
    docUrl: clean(values[16]),
    pdfUrl: clean(values[17]),
    productsJson: clean(values[18]),
    timestamp: clean(values[19]),
    // Columns added with the quotation -> PI flow. Older rows leave them empty.
    docType: clean(values[20]).toUpperCase() === 'PI' ? 'PI' : 'Quotation',
    linkedQuotation: clean(values[21]),
    status: clean(values[22])
  }));
}

async function getQuotationHistory(): Promise<any[]> {
  try {
    return await getQuotationHistoryStrict();
  } catch (err) {
    console.error('getQuotationHistory error:', err);
    return [];
  }
}

async function getCachedQuotationHistory(): Promise<any[]> {
  const now = Date.now();
  if (quotationHistoryCache && (now - quotationHistoryCache.timestamp < CACHE_TTL)) {
    return quotationHistoryCache.data;
  }
  const data = await getQuotationHistory();
  quotationHistoryCache = { data, timestamp: now };
  return data;
}

// ---------- Price list + terms (maintained in the Google Sheet tabs "PriceList" and "Terms") ----------

const SHEET_ID = '1-K_S1HXjca8dy0Sbl2qN7ts_e_YnKg5fBVSmaHB8kgU';
const PRICE_TTL = 60000; // price list changes rarely; 60s keeps sheet downloads and CPU low

let priceListCache: { data: { rows: PriceRow[]; terms: TermRow[] }; timestamp: number } | null = null;

async function fetchSheetByName(name: string, mustHave: string[]): Promise<string[][]> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not read the "${name}" tab.`);
  const rows = parseQuotedCSV(await response.text());
  const header = (rows[0] || []).map(h => h.trim().toLowerCase());
  // Google silently returns the first tab when the name is wrong, so check the header.
  if (!mustHave.every(h => header.includes(h.toLowerCase()))) {
    throw new Error(`The "${name}" tab is missing or its header row is wrong (needs: ${mustHave.join(', ')}).`);
  }
  return rows;
}

const BRAND_NAMES: Brand[] = ['Little Nap', 'La-Z-Boy', 'Smart Comfort'];
const asBrand = (s: string): Brand | null => {
  const t = s.trim().toLowerCase();
  return BRAND_NAMES.find(b => b.toLowerCase() === t) || null;
};
const isYes = (s: string | undefined) => !['no', 'n', 'false', '0', 'inactive'].includes((s || 'yes').trim().toLowerCase());

async function loadPriceList(): Promise<{ rows: PriceRow[]; terms: TermRow[] }> {
  const [priceRaw, termsRaw] = await Promise.all([
    fetchSheetByName('PriceList', ['Brand', 'Category', 'Item', 'Variant', 'Price']),
    fetchSheetByName('Terms', ['Brand', 'Text']).catch(() => [] as string[][])
  ]);

  const ph = priceRaw[0].map(h => h.trim().toLowerCase());
  const col = (name: string) => ph.indexOf(name);
  const rows: PriceRow[] = [];
  priceRaw.slice(1).forEach((r, i) => {
    const brand = asBrand(r[col('brand')] || '');
    const item = (r[col('item')] || '').trim();
    if (!brand || !item) return;
    const price = Number(String(r[col('price')] || '').replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(price)) return;
    const active = isYes(r[col('active')]);
    if (!active) return;
    rows.push({
      brand,
      category: (r[col('category')] || '').trim(),
      item,
      variant: (r[col('variant')] || '').trim(),
      price,
      notes: (r[col('notes')] || '').trim(),
      active,
      order: Number(r[col('order')]) || i + 1
    });
  });

  const terms: TermRow[] = [];
  if (termsRaw.length > 1) {
    const th = termsRaw[0].map(h => h.trim().toLowerCase());
    termsRaw.slice(1).forEach((r, i) => {
      const brand = asBrand(r[th.indexOf('brand')] || '');
      const text = (r[th.indexOf('text')] || '').trim();
      if (!brand || !text || !isYes(r[th.indexOf('active')])) return;
      const rawKind = (r[th.indexOf('type')] || r[th.indexOf('kind')] || '').trim().toLowerCase();
      const kind = rawKind === 'retail' ? 'Retail' : rawKind === 'project' ? 'Project' : '';
      terms.push({ brand, kind, no: Number(r[th.indexOf('no')]) || i + 1, text, active: true });
    });
    terms.sort((a, b) => a.brand.localeCompare(b.brand) || (a.kind || '').localeCompare(b.kind || '') || a.no - b.no);
  }
  return { rows, terms };
}

// ---------- Ready stock (separate Google Sheet) ----------
const STOCK_SHEET_ID = process.env.STOCK_SHEET_ID || '1g5fxOgUtB44Wjgej8C7p32xG7ZacgZmaymEMXmIRtAo';
const STOCK_TABS: Record<StockTab, { name: string; parse: (rows: string[][]) => any[] }> = {
  littlenap: { name: 'Response Ready Goods', parse: parseLittleNap },
  lazboy: { name: 'La-Z-Boy Stock', parse: parseLaZBoy },
  motion: { name: 'Linea & Puls details', parse: parseMotion }
};
let stockCache: { data: StockPayload; timestamp: number } | null = null;
// Stock and order status are only re-read from Google when someone presses Refresh, opens the app, or the copy is 5 minutes old.
const STOCK_TTL = 300000;
const OPEN_TTL = 60000;
const REFRESH_TTL = 5000;

async function loadStockTab(tab: StockTab): Promise<StockTabData> {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${STOCK_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(STOCK_TABS[tab].name)}`;
    const r = await fetch(url);
    const text = await r.text();
    if (!r.ok || /^\s*</.test(text)) {
      return { items: [], error: 'The stock sheet could not be read. Its sharing must be "Anyone with the link can view".' };
    }
    return { items: STOCK_TABS[tab].parse(parseQuotedCSV(text)) };
  } catch (e: any) {
    return { items: [], error: e?.message || 'Could not read this tab.' };
  }
}

async function getStock(mode: 'refresh' | 'open' | 'cached'): Promise<StockPayload> {
  const now = Date.now();
  // A forced refresh reads the sheet again, but several presses within 5 seconds share one read.
  const ttl = mode === 'refresh' ? REFRESH_TTL : mode === 'open' ? OPEN_TTL : STOCK_TTL;
  if (stockCache && now - stockCache.timestamp < ttl) return stockCache.data;
  const [littlenap, lazboy, motion] = await Promise.all([loadStockTab('littlenap'), loadStockTab('lazboy'), loadStockTab('motion')]);
  const data: StockPayload = { tabs: { littlenap, lazboy, motion }, loadedAt: now };
  // do not keep a result where every tab failed, so the next try reads the sheet again
  if ([littlenap, lazboy, motion].some(t => !t.error)) stockCache = { data, timestamp: now };
  return data;
}

// ---------- Order processing status (operations sheet, Salesman Dashboard tab) ----------
const ORDERS_SHEET_ID = process.env.ORDERS_SHEET_ID || '1ylXuhjwnuCKbDPm_rzZmufojQ0ZxatFc8pn8leS0qF8';
let orderCache: { data: Record<string, OrderHistory>; timestamp: number } | null = null;

async function getOrderStatuses(mode: 'refresh' | 'open' | 'cached'): Promise<Record<string, OrderHistory>> {
  const now = Date.now();
  const ttl = mode === 'refresh' ? REFRESH_TTL : mode === 'open' ? OPEN_TTL : STOCK_TTL;
  if (orderCache && now - orderCache.timestamp < ttl) return orderCache.data;
  // only the six columns we need: OPF Number, Timestamp, Planning, Actual, Status, Remarks
  const q = encodeURIComponent('select D,B,G,H,I,J,K,M,N,O,P');
  const url = `https://docs.google.com/spreadsheets/d/${ORDERS_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent('Salesman Dashboard')}&tq=${q}`;
  const r = await fetch(url);
  const text = await r.text();
  if (!r.ok || /^\s*</.test(text)) throw new Error('The operations sheet could not be read. Its sharing must be "Anyone with the link can view".');
  const data = parseOrderRows(parseQuotedCSV(text));
  orderCache = { data, timestamp: now };
  return data;
}

async function getCachedPriceList(force = false) {
  const now = Date.now();
  if (!force && priceListCache && now - priceListCache.timestamp < PRICE_TTL) return priceListCache.data;
  const data = await loadPriceList();
  priceListCache = { data, timestamp: now };
  return data;
}

function getQuotationScriptUrl(): string {
  let url = process.env.QUOTATION_SCRIPT_URL || '';
  if (
    !url ||
    url.includes('AKfycbxEj3dWorwbqPT4c7EAKUSA-sXIRXEBrhl3bDk29td45-GwZDOGRgbNSTas-DJwN8Wx') ||
    url.includes('AKfycbwtkrRO_UT6U4555HtORFB3noGWEY3RsKQ1mIRYT41qnvyNrT6Uhj8F51opKdv1gxsn') ||
    url.includes('AKfycbzrgcDNHI9QtJjyBOPpgwpuITuw20JU65Xb7VhgsUNgtnvPIIpfGxEfUPzPZ9rzdg')
  ) {
    url = 'https://script.google.com/macros/s/AKfycbybp6LfVhfkzXT18-LxrQdjSeyamms-JgZsEjHfaz8Z89BM4wpDBSJaYrQ7ANkV0z8I/exec';
  }
  return url;
}

// Authentication interceptor
async function authenticate(req: express.Request): Promise<any | null> {
  const userId = req.headers['x-user-id'] as string;
  const password = req.headers['x-user-password'] as string;
  
  if (!userId || !password) return null;
  
  const list = await getCachedSalespersons();
  const found = list.find(s => s.id.trim() === userId.trim() && s.password === password);
  if (found && found.active === false) return null;
  return found || null;
}

// Generate names of people managed by this user
function getManagedSalespeople(u: any, allSalespersons: any[]): any[] {
  if (!u.isManager) {
    return [u];
  }
  const targetManagerName = u.name.trim().toLowerCase();
  
  const isMatchingManager = (managerAccessVal: string | undefined, name: string) => {
    if (!managerAccessVal) return false;
    const parts = managerAccessVal.split(/[;,]/).map(x => x.trim().toLowerCase());
    return parts.includes(name);
  };

  return allSalespersons.filter(s => {
    return s.id === u.id || isMatchingManager(s.managerAccess, targetManagerName);
  });
}

function getManagerShowrooms(u: any, allSalespersons: any[]): Set<string> {
  const rooms = new Set<string>();
  const userShowroom = (u.showroom || '').trim();
  const userRegion = (u.region || '').trim();

  // Add the manager's own assigned showroom/region
  if (userShowroom && userShowroom.toLowerCase() !== 'all' && userShowroom.toLowerCase() !== 'all regions') {
    rooms.add(userShowroom);
  }

  if (userRegion && userRegion.toLowerCase() !== 'all' && userRegion.toLowerCase() !== 'all regions') {
    rooms.add(userRegion);
  }

  // Also collect showrooms and regions from all managed staff (e.g., for multi-store / area managers)
  const managed = getManagedSalespeople(u, allSalespersons);
  for (const s of managed) {
    if (s.showroom && s.showroom.trim().toLowerCase() !== 'all') {
      rooms.add(s.showroom.trim());
    }
    if (s.region && s.region.trim().toLowerCase() !== 'all') {
      rooms.add(s.region.trim());
    }
  }
  return rooms;
}


// ---------------------------------------------------------------- CRM
// All lead data lives in the "Little Nap CRM" Google Sheet, reached only through its Apps Script (crm-script.gs).
const CRM_TTL = 15000;
let crmCache: CacheEntry<any> | null = null;

function crmAdmins(): string[] {
  return (process.env.CRM_ADMIN_IDS || '').split(',').map(x => x.trim()).filter(Boolean);
}
function isCrmAdmin(u: any): boolean { return crmAdmins().includes((u.id || '').trim()); }
function crmTeam(u: any): string { return (u.team || '').trim(); }
function canUseCrm(u: any): boolean {
  return isCrmAdmin(u) || ['NBD', 'Sales', 'Manager'].includes(crmTeam(u)) || !!u.isManager;
}

async function callCrm(body: any): Promise<any> {
  const url = process.env.CRM_SCRIPT_URL || '';
  const key = process.env.CRM_SCRIPT_KEY || '';
  if (!url || !key) throw Object.assign(new Error('The CRM is not set up yet.'), { status: 503 });
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...body, key }),
    redirect: 'follow',
  });
  const text = await resp.text();
  let data: any;
  try { data = JSON.parse(text); } catch { throw new Error('The CRM did not answer. Try again in a moment.'); }
  if (!data.ok) throw Object.assign(new Error(data.error || 'CRM error'), { status: 400 });
  return data;
}

async function getCrmData(force = false): Promise<any> {
  const now = Date.now();
  if (!force && crmCache && now - crmCache.timestamp < CRM_TTL) return crmCache.data;
  const data = await callCrm({ action: 'list' });
  crmCache = { data, timestamp: now };
  return data;
}

/** Which leads this person may see. */
function crmScope(u: any, leads: any[], all: any[]): any[] {
  if (isCrmAdmin(u)) return leads;
  const team = crmTeam(u);
  const managedIds = new Set(getManagedSalespeople(u, all).map((s: any) => s.id));
  return leads.filter(l => {
    if (l.ownerId === u.id) return true;
    if (team === 'NBD' && (l.nbdId === u.id || (!l.ownerId && l.group === 'NBD'))) return true;
    if ((u.isManager || team === 'Manager') && (managedIds.has(l.ownerId) || managedIds.has(l.nbdId))) return true;
    return false;
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(compression());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.post('/api/order-status', async (req, res) => {
    try {
      const currentUser = await authenticate(req);
      if (!currentUser) return res.status(401).json({ error: 'Unauthorized credentials.' });
      const all = await getOrderStatuses(req.body?.refresh === true ? 'refresh' : req.body?.open === true ? 'open' : 'cached');
      const wanted: string[] = Array.isArray(req.body?.opfs) ? req.body.opfs.slice(0, 3000) : [];
      const statuses: Record<string, OrderHistory> = {};
      for (const o of wanted) { const k = normOpf(String(o)); if (all[k]) statuses[k] = all[k]; }
      res.json({ statuses, loadedAt: Date.now() });
    } catch (err: any) {
      console.error('API /api/order-status error:', err);
      res.status(502).json({ error: err?.message || 'Could not read the order status.' });
    }
  });

  app.get('/api/ready-stock', async (req, res) => {
    try {
      const currentUser = await authenticate(req);
      if (!currentUser) return res.status(401).json({ error: 'Unauthorized credentials.' });
      const q = req.query;
      res.json(await getStock(String(q.refresh || '') === '1' ? 'refresh' : String(q.open || '') === '1' ? 'open' : 'cached'));
    } catch (err: any) {
      console.error('API /api/ready-stock error:', err);
      res.status(500).json({ error: 'Could not load the ready stock.' });
    }
  });

  // Manual refresh of the display-only caches. Ignored if refreshed in the last 10 seconds.
  let lastManualRefresh = 0;
  app.post('/api/refresh-data', async (req, res) => {
    const currentUser = await authenticate(req);
    if (!currentUser) return res.status(401).json({ error: 'Unauthorized credentials.' });
    const now = Date.now();
    if (now - lastManualRefresh > 10000) {
      lastManualRefresh = now;
      salespersonsCache = null; validationCache = null; targetsCache = null; opfViewCache = null;
    }
    res.json({ ok: true });
  });

  // API 1: Login
  app.post('/api/login', async (req, res) => {
    try {
      const { id, password } = req.body;
      if (!id || !password) {
        return res.status(400).json({ error: 'ID and Password are required' });
      }
      const list = await getCachedSalespersons();
      const found = list.find(s => s.id.trim() === id.trim() && s.password === password);
      if (!found) {
        return res.status(401).json({ error: 'Invalid ID or Password' });
      }
      if (found.active === false) {
        return res.status(401).json({ error: 'This account is no longer active.' });
      }
      // Return user details without password
      const { password: _, ...safeUser } = found;
      res.json({ ...safeUser, crmAdmin: isCrmAdmin(found) });
    } catch (err: any) {
      console.error('API /api/login error:', err);
      res.status(500).json({ error: 'Failed to authenticate user.' });
    }
  });

  // API 2: Salespersons listing (scoped & sanitized)
  app.get('/api/salespersons', async (req, res) => {
    try {
      const currentUser = await authenticate(req);
      if (!currentUser) {
        return res.status(401).json({ error: 'Unauthorized credentials.' });
      }

      const all = await getCachedSalespersons();
      if (!currentUser.isManager) {
        const sanitized = [currentUser].map(({ password, ...rest }) => rest);
        return res.json(sanitized);
      }

      const managed = getManagedSalespeople(currentUser, all);
      const managedIds = new Set(managed.map(s => s.id));
      const managerRooms = getManagerShowrooms(currentUser, all);
      const allRows = await getCachedOPFDataForViews();

      const peopleWithSalesInRoom = new Set(
        allRows
          .filter(r => isRowInManagerRooms(r.showroom || r.region, managerRooms))
          .map(r => r.salesperson?.trim().toLowerCase())
          .filter(Boolean)
      );

      const combined = all.filter(s => {
        if (managedIds.has(s.id)) return true;
        const sRoom = s.showroom || s.region;
        if (sRoom && isRowInManagerRooms(sRoom, managerRooms)) return true;
        if (peopleWithSalesInRoom.has(s.name.trim().toLowerCase())) return true;
        return false;
      });

      // Strip password completely for all salespeople!
      const sanitized = combined.map(({ password, ...rest }) => rest);
      res.json(sanitized);
    } catch (err: any) {
      console.error('API /api/salespersons error:', err);
      res.status(500).json({ error: 'Failed to access salesperson list.' });
    }
  });

  // API 3: Targets listing (scoped)
  app.get('/api/targets', async (req, res) => {
    try {
      const currentUser = await authenticate(req);
      if (!currentUser) {
        return res.status(401).json({ error: 'Unauthorized credentials.' });
      }

      const all = await getCachedSalespersons();
      if (!currentUser.isManager) {
        const myName = currentUser.name.trim().toLowerCase();
        const allTargets = await getCachedTargets();
        const filtered = allTargets.filter(t => t.salesperson && t.salesperson.trim().toLowerCase() === myName);
        return res.json(filtered);
      }

      const managed = getManagedSalespeople(currentUser, all);
      const managerRooms = getManagerShowrooms(currentUser, all);
      const allRows = await getCachedOPFDataForViews();

      const relevantNames = new Set([
        ...managed.map(s => s.name.trim().toLowerCase()),
        ...all.filter(s => {
          const sRoom = s.showroom || s.region;
          return sRoom && isRowInManagerRooms(sRoom, managerRooms);
        }).map(s => s.name.trim().toLowerCase()),
        ...allRows
          .filter(r => isRowInManagerRooms(r.showroom || r.region, managerRooms))
          .map(r => r.salesperson?.trim().toLowerCase()).filter(Boolean)
      ]);

      const allTargets = await getCachedTargets();
      const filtered = allTargets.filter(t => {
        if (!t.salesperson) return false;
        const nameLower = t.salesperson.trim().toLowerCase();
        if (t.showroom) return isRowInManagerRooms(t.showroom, managerRooms);
        return relevantNames.has(nameLower);
      });
      res.json(filtered);
    } catch (err: any) {
      console.error('API /api/targets error:', err);
      res.status(500).json({ error: 'Failed to access targets.' });
    }
  });

  // API 4: OPF sales reports (scoped)
  app.get('/api/opf-data', async (req, res) => {
    try {
      const currentUser = await authenticate(req);
      if (!currentUser) {
        return res.status(401).json({ error: 'Unauthorized credentials.' });
      }

      const all = await getCachedSalespersons();
      const allRows = await getCachedOPFDataForViews();

      if (!currentUser.isManager) {
        const myName = currentUser.name.trim().toLowerCase();
        const filtered = allRows.filter(o => o.salesperson && o.salesperson.trim().toLowerCase() === myName);
        return res.json(filtered);
      }

      const managed = getManagedSalespeople(currentUser, all);
      const managedNames = new Set(managed.map(s => s.name.trim().toLowerCase()));
      const managerRooms = getManagerShowrooms(currentUser, all);

      const filtered = allRows.filter(o => {
        if (!o.salesperson) return false;
        const rowRoom = o.showroom || o.region;
        if (rowRoom && isRowInManagerRooms(rowRoom, managerRooms)) return true;
        if (managedNames.has(o.salesperson.trim().toLowerCase())) return true;
        return false;
      });
      res.json(filtered);
    } catch (err: any) {
      console.error('API /api/opf-data error:', err);
      res.status(500).json({ error: 'Failed to access report data.' });
    }
  });

  // API 5: Validation constants
  app.get('/api/validation', async (req, res) => {
    try {
      const currentUser = await authenticate(req);
      if (!currentUser) {
        return res.status(401).json({ error: 'Unauthorized credentials.' });
      }
      const val = await getCachedValidation();
      res.json(val);
    } catch (err: any) {
      console.error('API /api/validation error:', err);
      res.status(500).json({ error: 'Failed to access validation categories.' });
    }
  });

  // API 6: Unique OPF Code Mapping
  app.get('/api/code-map', async (req, res) => {
    try {
      const currentUser = await authenticate(req);
      if (!currentUser) {
        return res.status(401).json({ error: 'Unauthorized credentials.' });
      }
      const map = await getCachedCodeMap();
      res.json(map);
    } catch (err: any) {
      console.error('API /api/code-map error:', err);
      res.status(500).json({ error: 'Failed to access code map.' });
    }
  });

  // API 7: Submit Report (Secure Proxy)
  app.post('/api/submit-report', async (req, res) => {
    try {
      const currentUser = await authenticate(req);
      if (!currentUser) {
        return res.status(401).json({ error: 'Unauthorized credentials.' });
      }

      const SCRIPT_URL = process.env.REPORT_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbxEj3dWorwbqPT4c7EAKUSA-sXIRXEBrhl3bDk29td45-GwZDOGRgbNSTas-DJwN8Wx/exec';
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify({ ...req.body, showroom: currentUser.showroom || '', employeeId: currentUser.id || '', manager: currentUser.isManager ? currentUser.name : (currentUser.manager || ''), linkedDocument: String(req.body?.linkedDocument || '').trim().slice(0, 60), enquiryNo: String(req.body?.enquiryNo || '').trim().slice(0, 40) })
      });

      const raw = await response.text();
      let out: any = null;
      try { out = JSON.parse(raw); } catch { out = null; }
      if (!response.ok || !out || out.status !== 'success') {
        console.error('Report script did not accept the report:', response.status, raw.slice(0, 300));
        return res.status(502).json({ error: out?.message ? `The sale report sheet said: ${out.message}` : 'The sale report sheet did not accept the report. Check the sale report script deployment.' });
      }

      // Clear the OPF Data cache so that next polling request fetches fresh reports
      opfDataCache = null;

      res.json({ success: true });
    } catch (err: any) {
      console.error('API /api/submit-report error:', err);
      res.status(500).json({ error: err.message || 'Report submission failed internally.' });
    }
  });

  // API 8: Next OPF Number (calculated securely via unfiltered cached OPF data)
  app.get('/api/next-opf-sequence', async (req, res) => {
    try {
      const currentUser = await authenticate(req);
      if (!currentUser) {
        return res.status(401).json({ error: 'Unauthorized credentials.' });
      }

      const salespersonName = req.query.salespersonName as string;
      const visitType = req.query.visitType as string;

      if (!salespersonName || !visitType) {
        return res.status(400).json({ error: 'Salesperson name and Visit Type are required.' });
      }

      const codeMap = await getCachedCodeMap();
      const opfData = await getCachedOPFData();

      const now = new Date();
      const month = (now.getMonth() + 1).toString();
      const fy = '2627';

      const key = `${visitType.trim().toLowerCase()}-${salespersonName.trim().toLowerCase()}`;
      const salespersonCode = codeMap[key] || 'AR';

      const searchPattern = `${fy}${salespersonCode}`;

      const allSalespersonEntries = opfData.filter(o => {
        return o.opf && o.opf.includes(searchPattern);
      });

      let maxSequence = 0;
      if (allSalespersonEntries.length > 0) {
        const sequences = allSalespersonEntries.map(o => {
          const match = o.opf.match(/(\d+)$/);
          return match ? parseInt(match[1], 10) : 0;
        });
        maxSequence = Math.max(...sequences, 0);
      }

      const nextSeq = maxSequence + 1;
      const mm = month.padStart(2, '0');
      const nn = nextSeq.toString().padStart(2, '0');
      const opfNumber = `LND${mm}${fy}${salespersonCode}${nn}`;

      res.json({ opfNumber });
    } catch (err: any) {
      console.error('API /api/next-opf-sequence error:', err);
      res.status(500).json({ error: 'Failed to access sequence calculation.' });
    }
  });

  // API 9: Fetch Quotation Product Options
  app.get('/api/quotation-options', async (req, res) => {
    try {
      const currentUser = await authenticate(req);
      if (!currentUser) {
        return res.status(401).json({ error: 'Unauthorized credentials.' });
      }
      const data = await getCachedQuotationOptions();
      res.json(data);
    } catch (err: any) {
      console.error('API /api/quotation-options error:', err);
      res.status(500).json({ error: 'Failed to load quotation products and charges.' });
    }
  });

  // API 10: Fetch Quotation History (scoped to current user/manager)
  app.get('/api/quotation-history', async (req, res) => {
    try {
      const currentUser = await authenticate(req);
      if (!currentUser) {
        return res.status(401).json({ error: 'Unauthorized credentials.' });
      }

      const all = await getCachedSalespersons();
      const managed = getManagedSalespeople(currentUser, all);
      const allowedNames = managed.map(s => s.name.trim().toLowerCase());
      const allowedIds = managed.map(s => s.id.trim().toLowerCase());

      const data = await getCachedQuotationHistory();
      
      const filtered = data.filter(q => {
        const qName = (q.salespersonName || '').trim().toLowerCase();
        const qId = (q.salespersonId || '').trim().toLowerCase();
        
        // Match either by registered ID or registered user name
        const matchId = qId && allowedIds.includes(qId);
        const matchName = qName && allowedNames.includes(qName);
        return matchId || matchName || qId === currentUser.id.trim().toLowerCase() || qName === currentUser.name.trim().toLowerCase();
      });

      // A quotation counts as converted once a PI row points back to it.
      const convertedMap: Record<string, string> = {};
      data.forEach(q => {
        if (q.docType === 'PI' && q.linkedQuotation) convertedMap[q.linkedQuotation.trim().toLowerCase()] = q.quotationNumber;
      });
      res.json(filtered.map(q => ({
        ...q,
        convertedTo: q.docType === 'Quotation' ? (convertedMap[(q.quotationNumber || '').trim().toLowerCase()] || '') : ''
      })));
    } catch (err: any) {
      console.error('API /api/quotation-history error:', err);
      res.status(500).json({ error: 'Failed to access quotation tracking logs.' });
    }
  });

  // API 11: Calculate Next Quotation Sequence
  app.get('/api/next-quotation-sequence', async (req, res) => {
    try {
      const currentUser = await authenticate(req);
      if (!currentUser) {
        return res.status(401).json({ error: 'Unauthorized credentials.' });
      }

      // Each brand and document type has its own series: LNQ/LNPI, LZQ/LZPI, SCQ/SCPI.
      // With no parameters this still returns the Little Nap quotation number, as before.
      const brandParam = asBrand(String(req.query.brand || 'Little Nap')) || 'Little Nap';
      const docTypeParam: DocType = String(req.query.docType || 'Quotation').toUpperCase() === 'PI' ? 'PI' : 'Quotation';

      // Strict read: if the sheet cannot be read we fail instead of restarting the series.
      const history = await getCachedQuotationHistory();
      if (!history.length) {
        await getQuotationHistoryStrict();
      }
      const quotationNumber = nextNumber(brandParam, docTypeParam, history.map(h => h.quotationNumber));
      res.json({ quotationNumber });
    } catch (err: any) {
      console.error('API /api/next-quotation-sequence error:', err);
      res.status(500).json({ error: 'Failed to calculate next sequence.' });
    }
  });

  // API: Price list + terms (from the "PriceList" and "Terms" sheet tabs)
  app.get('/api/price-list', async (req, res) => {
    try {
      const currentUser = await authenticate(req);
      if (!currentUser) return res.status(401).json({ error: 'Unauthorized credentials.' });
      const force = req.query.refresh === '1';
      const data = await getCachedPriceList(force);
      res.json({ rows: data.rows, terms: data.terms, loadedAt: priceListCache?.timestamp || Date.now() });
    } catch (err: any) {
      console.error('API /api/price-list error:', err);
      res.status(500).json({ error: err.message || 'Failed to load the price list.' });
    }
  });

  // API: Save a Quotation or a Proforma Invoice (validated and re-totalled on the server)
  app.post('/api/quotations', async (req, res) => {
    try {
      const currentUser = await authenticate(req);
      if (!currentUser) return res.status(401).json({ error: 'Unauthorized credentials.' });

      const body = req.body || {};
      const payload = body.payload as QuotePayload;
      if (!payload || payload.v !== 2 || !Array.isArray(payload.lines)) {
        return res.status(400).json({ error: 'Invalid quotation data.' });
      }
      const brand = asBrand(String(payload.brand || ''));
      const docType: DocType = payload.docType === 'PI' ? 'PI' : 'Quotation';
      if (!brand) return res.status(400).json({ error: 'Unknown brand.' });
      payload.brand = brand;
      payload.docType = docType;

      const clientName = String(body.clientName || '').trim();
      const mobile = String(body.mobileNumber || '').trim();
      if (!clientName) return res.status(400).json({ error: 'Client name is required.' });
      if (mobile.replace(/\D/g, '').length < 10) return res.status(400).json({ error: 'A valid mobile number is required.' });

      // 1. Brand rules + prices against the live price list
      const priceList = await getCachedPriceList();
      const problems = validatePayload(payload, priceList.rows);
      if (problems.length) return res.status(400).json({ error: problems[0], problems });

      // 2. Number must belong to this brand / document series and must not exist already
      const quotationNumber = String(body.quotationNumber || '').trim();
      const prefix = docPrefix(brand, docType);
      if (!new RegExp(`^${prefix}-\\d{4}-\\d+$`, 'i').test(quotationNumber)) {
        return res.status(400).json({ error: `Number must start with ${prefix}-.` });
      }
      const history = await getQuotationHistoryStrict();
      if (history.some(h => (h.quotationNumber || '').trim().toLowerCase() === quotationNumber.toLowerCase())) {
        return res.status(409).json({ error: `${quotationNumber} was just used by someone else. The next number is loading, please try again.` });
      }

      // 2b. Optional link to a CRM lead. Only the person who has the lead may make documents for it
      //     (a PI inherits the lead of its quotation)
      let enquiryNo = String(body.enquiryNo || '').trim();
      let leadCheck: 'none' | 'ok' | 'skipped' = 'none';
      let ownsLead = false;
      const sourceNo = String(body.linkedQuotation || '').trim();
      try {
        if ((enquiryNo || docType === 'PI') && process.env.CRM_SCRIPT_URL && process.env.CRM_SCRIPT_KEY && canUseCrm(currentUser)) {
          const crm = await getCrmData(true);
          if (!enquiryNo && docType === 'PI') enquiryNo = ((crm.quotes || []).find((q: any) => String(q.quoteNo).toLowerCase() === sourceNo.toLowerCase()) || {}).enquiryNo || '';
          if (enquiryNo) {
            const theLead = (crm.leads || []).find((l: any) => l.enquiryNo === enquiryNo);
            if (!theLead) return res.status(404).json({ error: 'That lead was not found.' });
            if (theLead.outcome !== 'Open') return res.status(400).json({ error: 'That lead is no longer open.' });
            if ((theLead.ownerId || '') !== currentUser.id) {
              return res.status(403).json({ error: `Only ${theLead.ownerName || 'the person who has this lead'} can make quotations for it.` });
            }
            leadCheck = 'ok';
            ownsLead = true;
          }
        } else if (enquiryNo) leadCheck = 'skipped';
      } catch (e: any) {
        console.error('Quotation lead check failed:', e.message);
        if (enquiryNo) leadCheck = 'skipped';
      }

      // 3. A PI must be made from an existing, unconverted quotation of the same brand
      let linkedQuotation = '';
      if (docType === 'PI') {
        linkedQuotation = String(body.linkedQuotation || '').trim();
        const source = history.find(h => h.docType === 'Quotation' && (h.quotationNumber || '').trim().toLowerCase() === linkedQuotation.toLowerCase());
        if (!source) return res.status(400).json({ error: 'The quotation for this PI was not found. Save the quotation first.' });
        if ((source.brandName || '').trim().toLowerCase() !== brand.toLowerCase()) {
          return res.status(400).json({ error: 'A PI must be in the same brand as its quotation.' });
        }
        const all = await getCachedSalespersons();
        const managed = getManagedSalespeople(currentUser, all);
        const allowed = managed.some(s =>
          s.id.trim().toLowerCase() === (source.salespersonId || '').trim().toLowerCase() ||
          s.name.trim().toLowerCase() === (source.salespersonName || '').trim().toLowerCase());
        if (!allowed && !ownsLead) return res.status(403).json({ error: 'You cannot convert this quotation.' });
        const existingPi = history.find(h => h.docType === 'PI' && (h.linkedQuotation || '').trim().toLowerCase() === linkedQuotation.toLowerCase());
        if (existingPi) return res.status(409).json({ error: `This quotation was already converted to ${existingPi.quotationNumber}.` });
      }

      // 4. Totals are always recalculated here; the browser's totals are ignored
      const totals = calcTotals(payload);
      const edited = payloadHasEditedPrices(payload);
      const safe = (s: unknown) => {
        const t = String(s ?? '').trim();
        // stop a spreadsheet from running text that starts like a formula
        return /^[=+\-@]/.test(t) ? `'${t}` : t;
      };
      const seq = (quotationNumber.match(/(\d+)$/) || [])[1] || '';

      const sheetPayload = {
        action: 'create-quotation-fast',
        date: safe(body.date),
        quotationNumber,
        opfCode: `OPF-${seq}`,
        brandName: brand,
        clientName: safe(clientName),
        mobileNumber: safe(mobile),
        emailId: safe(body.emailId),
        billingAddress: safe(body.billingAddress),
        shippingAddress: safe(body.shippingAddress),
        subtotal: totals.taxable,
        gstIncluded: totals.gstIncluded || totals.gstExtra,
        freight: totals.freightExtra,
        grandTotal: totals.grandTotal,
        amountInWords: numberToWords(totals.grandTotal),
        productsJson: JSON.stringify({ ...payload, totals, customPricing: edited }),
        salespersonId: currentUser.id,
        salespersonName: currentUser.name,
        // new columns U, V, W in the quotation sheet
        docType,
        linkedQuotation,
        status: docType === 'PI' ? 'PI' : 'Quotation'
      };

      const scriptUrl = getQuotationScriptUrl();
      const response = await fetch(scriptUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(sheetPayload) });
      const text = await response.text();
      let result: any;
      try { result = JSON.parse(text); } catch {
        console.error('Apps Script returned non-JSON:', text.slice(0, 300));
        return res.status(502).json({ error: 'The Google Apps Script did not return a valid response.' });
      }
      quotationHistoryCache = null;
      if (!result || result.status !== 'success') {
        return res.status(502).json({ error: result?.message || 'The sheet did not accept the record.' });
      }

      let linked = '';
      if (enquiryNo && leadCheck === 'ok') {
        try {
          await callCrm({ action: 'link-quote', enquiryNo, quoteNo: quotationNumber, docType, brand, amount: totals.grandTotal, linkedQuote: linkedQuotation, byId: currentUser.id, byName: currentUser.name });
          crmCache = null;
          linked = enquiryNo;
        } catch (e: any) {
          console.error(`Could not link ${quotationNumber} to ${enquiryNo}:`, e.message);
        }
      }

      res.json({ status: 'success', quotationNumber, docType, totals, customPricing: edited, linkedLead: linked, linkFailed: !!enquiryNo && !linked });

      // Optional: upload the PDF to Drive in the background (same as before)
      if (body.pdfBase64) {
        (async () => {
          try {
            await fetch(scriptUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain' },
              body: JSON.stringify({ action: 'upload-pdf-back', quotationNumber, clientName, pdfBase64: body.pdfBase64 })
            });
            quotationHistoryCache = null;
          } catch (bgErr) {
            console.error(`[Background Job] PDF upload failed for ${quotationNumber}:`, bgErr);
          }
        })();
      }
    } catch (err: any) {
      console.error('API /api/quotations error:', err);
      res.status(500).json({ error: err.message || 'Failed to save.' });
    }
  });

  // API 12: Fetch Banking Details
  app.get('/api/bank-details', async (req, res) => {
    try {
      const currentUser = await authenticate(req);
      if (!currentUser) {
        return res.status(401).json({ error: 'Unauthorized credentials.' });
      }
      const data = await getCachedBankDetails();
      res.json(data);
    } catch (err: any) {
      console.error('API /api/bank-details error:', err);
      res.status(500).json({ error: 'Failed to load banking details.' });
    }
  });

  // API 11: Create & Submit Quotation
  app.get('/api/logo', async (req, res) => {
    try {
      const url = 'https://lh3.googleusercontent.com/d/1O6Sr-ArBZCTG-XnfNUlWnHprbUoNXyqu';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch logo from drive: ${response.statusText}`);
      }
      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 'image/png';
      const base64 = Buffer.from(buffer).toString('base64');
      res.json({ base64: `data:${contentType};base64,${base64}` });
    } catch (err: any) {
      console.error('API /api/logo error:', err);
      res.json({ error: err.message, base64: null });
    }
  });

  let brochureCache: string | null = null;
  app.get('/api/brand-brochure', async (req, res) => {
    try {
      if (brochureCache) {
        return res.json({ base64: brochureCache });
      }
      const url = 'https://docs.google.com/uc?export=download&id=1riNY0xpAE0RDJ5oDlpiaqo0HrqKvjrdt';
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch brochure from drive: ${response.statusText}`);
      }
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      brochureCache = base64;
      res.json({ base64 });
    } catch (err: any) {
      console.error('API /api/brand-brochure error:', err);
      res.json({ error: err.message, base64: null });
    }
  });

  app.post('/api/submit-quotation', async (req, res) => {
    try {
      const currentUser = await authenticate(req);
      if (!currentUser) {
        return res.status(401).json({ error: 'Unauthorized credentials.' });
      }

      let SCRIPT_URL = process.env.QUOTATION_SCRIPT_URL || '';
      if (
        !SCRIPT_URL || 
        SCRIPT_URL.includes('AKfycbxEj3dWorwbqPT4c7EAKUSA-sXIRXEBrhl3bDk29td45-GwZDOGRgbNSTas-DJwN8Wx') || 
        SCRIPT_URL.includes('AKfycbwtkrRO_UT6U4555HtORFB3noGWEY3RsKQ1mIRYT41qnvyNrT6Uhj8F51opKdv1gxsn') ||
        SCRIPT_URL.includes('AKfycbzrgcDNHI9QtJjyBOPpgwpuITuw20JU65Xb7VhgsUNgtnvPIIpfGxEfUPzPZ9rzdg')
      ) {
        SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbybp6LfVhfkzXT18-LxrQdjSeyamms-JgZsEjHfaz8Z89BM4wpDBSJaYrQ7ANkV0z8I/exec';
      }

      // Optimize: Submit text data first to Google Sheet (ultra-fast, response returned instantly)
      const payloadFast = {
        action: 'create-quotation-fast',
        date: req.body.date,
        quotationNumber: req.body.quotationNumber,
        opfCode: req.body.opfCode,
        brandName: req.body.brandName,
        clientName: req.body.clientName,
        mobileNumber: req.body.mobileNumber,
        emailId: req.body.emailId,
        billingAddress: req.body.billingAddress,
        shippingAddress: req.body.shippingAddress,
        subtotal: req.body.subtotal,
        gstIncluded: req.body.gstIncluded,
        freight: req.body.freight,
        grandTotal: req.body.grandTotal,
        amountInWords: req.body.amountInWords,
        productsJson: req.body.productsJson,
        salespersonId: currentUser.id,
        salespersonName: currentUser.name
      };

      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify(payloadFast)
      });

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (parseErr: any) {
        console.error('Failed to parse Apps Script response as JSON. Raw response from Apps Script:', responseText);
        return res.status(502).json({
          error: 'Google Apps Script did not return a valid JSON format. Verify your script is deployed as "Web App" with access set to "Anyone", even anonymous.',
          rawResponse: responseText.slice(0, 500)
        });
      }

      // Invalidate the tracking cache so the next retrieve fetches fresh list
      quotationHistoryCache = null;

      if (responseData && responseData.status === 'success') {
        // Return success instantly to client
        res.json({
          status: 'success',
          docUrl: '',
          pdfUrl: 'Pending Upload...',
          message: 'Saved quotation data in real-time. PDF upload has started in the background.'
        });

        // Trigger background PDF upload to Google Drive without holding up the express request
        if (req.body.pdfBase64) {
          (async () => {
            try {
              console.log(`[Background Job] Saving and uploading PDF to Google Drive for invoice: ${req.body.quotationNumber}`);
              const payloadPdf = {
                action: 'upload-pdf-back',
                quotationNumber: req.body.quotationNumber,
                clientName: req.body.clientName,
                pdfBase64: req.body.pdfBase64
              };

              const responsePdf = await fetch(SCRIPT_URL, {
                method: 'POST',
                headers: {
                  'Content-Type': 'text/plain'
                },
                body: JSON.stringify(payloadPdf)
              });
              const pdfResText = await responsePdf.text();
              console.log(`[Background Job] Success response for invoice: ${req.body.quotationNumber}:`, pdfResText);
              // Invalidate cache again so once PDF is fully done it has the latest link in history
              quotationHistoryCache = null;
            } catch (bgErr: any) {
              console.error(`[Background Job] PDF upload failed for invoice: ${req.body.quotationNumber}. Error:`, bgErr);
            }
          })();
        }
      } else {
        res.status(400).json({ error: responseData.message || 'Failed to submit quotation sequence.' });
      }
    } catch (err: any) {
      console.error('API /api/submit-quotation error:', err);
      res.status(500).json({ error: err.message || 'Failed to save quotation and sync with database.' });
    }
  });

  // API 14: Background PDF Upload Proxy
  app.post('/api/upload-pdf-back', async (req, res) => {
    try {
      const currentUser = await authenticate(req);
      if (!currentUser) {
        return res.status(401).json({ error: 'Unauthorized credentials.' });
      }

      let SCRIPT_URL = process.env.QUOTATION_SCRIPT_URL || '';
      if (
        !SCRIPT_URL || 
        SCRIPT_URL.includes('AKfycbxEj3dWorwbqPT4c7EAKUSA-sXIRXEBrhl3bDk29td45-GwZDOGRgbNSTas-DJwN8Wx') || 
        SCRIPT_URL.includes('AKfycbwtkrRO_UT6U4555HtORFB3noGWEY3RsKQ1mIRYT41qnvyNrT6Uhj8F51opKdv1gxsn') ||
        SCRIPT_URL.includes('AKfycbzrgcDNHI9QtJjyBOPpgwpuITuw20JU65Xb7VhgsUNgtnvPIIpfGxEfUPzPZ9rzdg')
      ) {
        SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbybp6LfVhfkzXT18-LxrQdjSeyamms-JgZsEjHfaz8Z89BM4wpDBSJaYrQ7ANkV0z8I/exec';
      }

      const payloadPdf = {
        action: 'upload-pdf-back',
        quotationNumber: req.body.quotationNumber,
        clientName: req.body.clientName,
        pdfBase64: req.body.pdfBase64
      };

      const responsePdf = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: JSON.stringify(payloadPdf)
      });

      const pdfResText = await responsePdf.text();
      let pdfResData;
      try {
        pdfResData = JSON.parse(pdfResText);
      } catch (e) {
        pdfResData = { status: 'error', message: pdfResText };
      }

      // Invalidate cache so that history retrieval has the fresh Drive link
      quotationHistoryCache = null;

      res.json(pdfResData);
    } catch (err: any) {
      console.error('API /api/upload-pdf-back error:', err);
      res.status(500).json({ error: err.message || 'Failed to upload PDF in background.' });
    }
  });


  // ---- CRM: leads list (scoped), people lists, and availability in one call
  app.get('/api/crm/leads', async (req, res) => {
    try {
      const u = await authenticate(req);
      if (!u) return res.status(401).json({ error: 'Unauthorized' });
      if (!canUseCrm(u)) return res.status(403).json({ error: 'The CRM is not available for your role.' });
      const [data, all] = await Promise.all([getCrmData(req.query.refresh === '1'), getCachedSalespersons()]);
      const active = all.filter((s: any) => s.active !== false);
      const scoped = crmScope(u, data.leads, all);
      const seen = new Set(scoped.map((l: any) => l.enquiryNo));
      let hist: any[] = [];
      try { hist = await getCachedQuotationHistory(); } catch { /* links are optional */ }
      const byNo = new Map(hist.map((h: any) => [String(h.quotationNumber || '').trim().toLowerCase(), h]));
      const converted = new Map<string, string>();
      (data.quotes || []).forEach((q: any) => { if (q.docType === 'PI' && q.linkedQuote) converted.set(String(q.linkedQuote).toLowerCase(), q.quoteNo); });
      res.json({
        leads: scoped,
        quotes: (data.quotes || []).filter((q: any) => seen.has(q.enquiryNo)).map((q: any) => {
          const h: any = byNo.get(String(q.quoteNo).toLowerCase()) || {};
          return { ...q, pdfUrl: h.pdfUrl || '', convertedTo: q.docType === 'Quotation' ? (converted.get(String(q.quoteNo).toLowerCase()) || '') : '' };
        }),
        me: { id: u.id, name: u.name, team: crmTeam(u), isManager: !!u.isManager, admin: isCrmAdmin(u) },
        sales: active.filter((s: any) => s.team === 'Sales').map((s: any) => ({ id: s.id, name: s.name, showroom: s.showroom, region: s.region })),
        nbd: active.filter((s: any) => s.team === 'NBD').map((s: any) => ({ id: s.id, name: s.name, present: data.availability?.[s.id] !== false })),
        lists: data.lists,
        now: data.now,
      });
    } catch (err: any) {
      console.error('API /api/crm/leads error:', err);
      res.status(err.status || 500).json({ error: err.message || 'Could not load leads.' });
    }
  });

  app.get('/api/crm/quote', async (req, res) => {
    try {
      const u = await authenticate(req);
      if (!u) return res.status(401).json({ error: 'Unauthorized' });
      if (!canUseCrm(u)) return res.status(403).json({ error: 'The CRM is not available for your role.' });
      const no = String(req.query.no || '').trim().toLowerCase();
      const [data, all] = await Promise.all([getCrmData(true), getCachedSalespersons()]);
      const link = (data.quotes || []).find((q: any) => String(q.quoteNo).toLowerCase() === no);
      if (!link || !crmScope(u, data.leads, all).some((l: any) => l.enquiryNo === link.enquiryNo)) return res.status(404).json({ error: 'Quotation not found.' });
      const rec = (await getCachedQuotationHistory()).find((h: any) => String(h.quotationNumber || '').trim().toLowerCase() === no);
      if (!rec) return res.status(404).json({ error: 'Quotation details not found.' });
      res.json(rec);
    } catch (err: any) {
      console.error('API /api/crm/quote error:', err);
      res.status(err.status || 500).json({ error: err.message || 'Could not load the quotation.' });
    }
  });

  app.get('/api/crm/timeline', async (req, res) => {
    try {
      const u = await authenticate(req);
      if (!u) return res.status(401).json({ error: 'Unauthorized' });
      if (!canUseCrm(u)) return res.status(403).json({ error: 'The CRM is not available for your role.' });
      const enq = String(req.query.enq || '');
      const [data, all] = await Promise.all([getCrmData(), getCachedSalespersons()]);
      if (!crmScope(u, data.leads, all).some((l: any) => l.enquiryNo === enq)) return res.status(403).json({ error: 'Not your lead.' });
      const t = await callCrm({ action: 'timeline', enquiryNo: enq });
      res.json({ timeline: t.timeline });
    } catch (err: any) {
      console.error('API /api/crm/timeline error:', err);
      res.status(err.status || 500).json({ error: err.message || 'Could not load the timeline.' });
    }
  });

  // ---- CRM: every change goes through here so the rules are checked on the server
  app.post('/api/crm/action', async (req, res) => {
    try {
      const u = await authenticate(req);
      if (!u) return res.status(401).json({ error: 'Unauthorized' });
      if (!canUseCrm(u)) return res.status(403).json({ error: 'The CRM is not available for your role.' });
      const b = req.body || {};
      const team = crmTeam(u);
      const admin = isCrmAdmin(u);
      const all = await getCachedSalespersons();
      const by = { byId: u.id, byName: u.name };

      if (b.action === 'set-available') {
        const target = b.id || u.id;
        const managedIds = new Set(getManagedSalespeople(u, all).map((s: any) => s.id));
        if (target !== u.id && !admin && !managedIds.has(target)) return res.status(403).json({ error: 'Not allowed.' });
        await callCrm({ action: 'set-available', id: target, present: !!b.present });
        crmCache = null;
        return res.json({ ok: true });
      }

      if (b.action === 'add-enquiry') {
        if (!admin && !['NBD', 'Sales', 'Manager'].includes(team)) return res.status(403).json({ error: 'You cannot add enquiries.' });
        const f = b.fields || {};
        const out = await callCrm({ action: 'add-enquiry', ...by, decision: b.decision, fields: f });
        crmCache = null;
        return res.json(out);
      }

      // everything below works on one existing lead the person may see
      const data = await getCrmData(true);
      const lead = data.leads.find((l: any) => l.enquiryNo === b.enquiryNo);
      if (!lead) return res.status(404).json({ error: 'Lead not found.' });
      const managedIds = new Set(getManagedSalespeople(u, all).map((s: any) => s.id));
      const isOwner = lead.ownerId === u.id;
      const isMine = isOwner || (team === 'NBD' && !lead.ownerId);
      const isBoss = admin || managedIds.has(lead.ownerId);

      switch (b.action) {
        case 'log-activity':
        case 'mark-invalid':
        case 'mark-lost':
        case 'close-lead':
        case 'reopen':
          if (!isMine && !isBoss) return res.status(403).json({ error: 'This lead is not with you.' });
          break;
        case 'align':
          if (!admin && !(isOwner && team === 'NBD')) return res.status(403).json({ error: 'Only the NBD owner can align a lead.' });
          break;
        case 'send-back':
          if (!admin && !(isOwner && team === 'Sales')) return res.status(403).json({ error: 'Only the salesperson who has the lead can send it back.' });
          break;
        case 'reassign':
          if (!isBoss) return res.status(403).json({ error: 'Only a manager can reassign.' });
          break;
        case 'edit-contact':
          if (!isMine && !isBoss) return res.status(403).json({ error: 'This lead is not with you.' });
          break;
        default:
          return res.status(400).json({ error: 'Unknown action.' });
      }
      const out = await callCrm({
        action: b.action, ...by, enquiryNo: lead.enquiryNo, type: b.type, text: b.text, stage: b.stage,
        nextFollowUp: b.nextFollowUp, reason: b.reason, toId: b.toId, meetingDate: b.meetingDate, meetingTime: b.meetingTime, opf: b.opf, orderValue: b.orderValue,
        firstName: b.firstName, lastName: b.lastName, phone: b.phone, altPhone: b.altPhone,
      });
      crmCache = null;
      res.json(out);
    } catch (err: any) {
      console.error('API /api/crm/action error:', err);
      res.status(err.status || 500).json({ error: err.message || 'Could not save.' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SECURE GATEWAY] Server running on http://localhost:${PORT}`);
  });
}

startServer();
