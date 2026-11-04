import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Plus, Trash2, Upload, Download, FileCheck, ArrowLeft, ArrowRight, AlertCircle, RefreshCw, Search } from 'lucide-react';
import { Salesperson, BankDetails } from '../types';
import {
  fetchPriceList, fetchNextNumber, saveQuotation, fetchBankDetails, fetchQuotationHistory, QuotationData
} from '../services/dataService';
import {
  Brand, BRANDS, DocType, PriceListPayload, PriceRow, QuoteLine, LineOption, QuotePayload
} from '../quotation/types';
import {
  BRAND_RULES, calcTotals, emptyDiscount, formatINR, lineIsEdited, rowKey
} from '../quotation/pricing';
import { buildCorePdf, mergePdf, termsFor, Attachment, PdfMeta } from '../quotation/pdf';
import { SearchSelect, SelectOption } from './SearchSelect';

const GOLD = '#9B7C50';
const uid = () => Math.random().toString(36).slice(2, 10);
const todayStr = () => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const field = 'w-full h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:border-slate-900';
const area = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:border-slate-900';
const label = 'block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5';
const card = 'bg-white border border-slate-200 rounded-2xl shadow-[0_8px_30px_rgba(15,23,42,0.05)] p-5 sm:p-6';
const btnPrimary = 'inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-slate-900 text-white px-6 text-sm font-bold hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed';
const btnGhost = 'inline-flex items-center justify-center gap-2 h-12 rounded-xl border border-slate-200 bg-white text-slate-800 px-5 text-sm font-bold hover:border-slate-400 disabled:opacity-40';
const fmt0 = (n: number) => 'Rs. ' + Math.round(n).toLocaleString('en-IN');

const STEPS = ['Brand', 'Customer', 'Items', 'Pricing', 'Review'] as const;
const STEP_HELP = [
  ['Choose the brand', 'One brand per quotation. Brands cannot be mixed.'],
  ['Customer details', 'Who is this quotation for?'],
  ['Add items', 'Pick the model, then add upholstery and add-ons for each item.'],
  ['Discount and freight', 'Optional discount, and how freight is charged.'],
  ['Review and save', 'Check everything before saving.']
] as const;

let brochureCache: ArrayBuffer | null = null;
async function getBrochure(): Promise<ArrayBuffer | null> {
  if (brochureCache) return brochureCache;
  try {
    const r = await fetch('/api/brand-brochure');
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.base64) return null;
    const bin = atob(d.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    brochureCache = bytes.buffer;
    return brochureCache;
  } catch { return null; }
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(s);
}

interface Props { salesperson: Salesperson }

export function QuotationWizard({ salesperson }: Props) {
  const [tab, setTab] = useState<'build' | 'history'>('build');
  const [price, setPrice] = useState<PriceListPayload | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [bank, setBank] = useState('');
  const [logo, setLogo] = useState<string | null>(null);

  const [step, setStep] = useState(0);
  const [docType, setDocType] = useState<DocType>('Quotation');
  const [brand, setBrand] = useState<Brand>('Little Nap');
  const [company, setCompany] = useState('');
  const [employeeNo, setEmployeeNo] = useState(String(salesperson.id || ''));
  const [clientName, setClientName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [billing, setBilling] = useState('');
  const [shipping, setShipping] = useState('');
  const [sameAddr, setSameAddr] = useState(true);
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [discount, setDiscount] = useState(emptyDiscount());
  const [freight, setFreight] = useState<{ mode: 'included' | 'extra'; amount: number }>({ mode: 'extra', amount: 0 });
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [linkedQuotation, setLinkedQuotation] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<{ number: string; docType: DocType } | null>(null);

  // item picker
  const [pickCat, setPickCat] = useState('');
  const [pickItem, setPickItem] = useState('');
  const [pickVariant, setPickVariant] = useState('');

  const [history, setHistory] = useState<QuotationData[]>([]);
  const [histLoading, setHistLoading] = useState(false);
  const [q, setQ] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const rule = BRAND_RULES[brand];

  const load = async (force = false) => {
    setLoadErr('');
    try { setPrice(await fetchPriceList(force)); } catch (e: any) { setLoadErr(e.message || 'Could not load the price list'); }
  };

  useEffect(() => {
    load();
    (async () => {
      try {
        const banks: BankDetails[] = await fetchBankDetails();
        const sh = (salesperson.showroom || '').trim().toLowerCase();
        const rg = (salesperson.region || '').trim().toLowerCase();
        const k = (b: BankDetails) => b.showroomOrRegion.trim().toLowerCase();
        const m = banks.find(b => k(b) === sh) || banks.find(b => k(b) === rg)
          || (sh ? banks.find(b => k(b).includes(sh) || sh.includes(k(b))) : undefined)
          || (rg ? banks.find(b => k(b).includes(rg) || rg.includes(k(b))) : undefined) || banks[0];
        setBank(m?.bankingDetails || '');
      } catch { /* bank details are only needed on the PI */ }
    })();
    (async () => {
      try {
        const saved = localStorage.getItem('little_nap_custom_logo');
        if (saved) return setLogo(saved);
        const r = await fetch('/api/logo');
        if (r.ok) { const d = await r.json(); if (d.base64) setLogo(d.base64); }
      } catch { /* logo is optional */ }
    })();
  }, []);

  // changing brand clears items so brands can never mix
  const chooseBrand = (b: Brand) => {
    if (b === brand) return;
    if (lines.length && !window.confirm(`Changing to ${b} will remove the items already added. Continue?`)) return;
    setBrand(b);
    setLines([]);
    setFreight({ mode: BRAND_RULES[b].freightDefault, amount: 0 });
    setPickCat(''); setPickItem(''); setPickVariant('');
  };

  const brandRows = useMemo(() => (price?.rows || []).filter(r => r.brand === brand && r.active), [price, brand]);
  const categories = useMemo(() => {
    const seen: string[] = [];
    brandRows.slice().sort((a, b) => a.order - b.order).forEach(r => { if (!seen.includes(r.category)) seen.push(r.category); });
    return seen;
  }, [brandRows]);

  // categories shown for the main item vs add-ons (Little Nap only)
  const ADDON_CATS = ['Upholstery', 'Accessories', 'Single Motor Controls', 'Dual Motor Controls', 'Three Motor Controls', 'Other Accessories', 'Veneer Arm', 'Surcharges & Rules'];
  const mainCats = categories.filter(c => !(rule.customisation && ADDON_CATS.includes(c)));
  const addonCats = categories.filter(c => rule.customisation && ADDON_CATS.includes(c));

  const itemsIn = (cat: string) => {
    const seen: string[] = [];
    brandRows.filter(r => r.category === cat).sort((a, b) => a.order - b.order).forEach(r => { if (!seen.includes(r.item)) seen.push(r.item); });
    return seen;
  };
  const variantsOf = (cat: string, item: string) => brandRows.filter(r => r.category === cat && r.item === item).sort((a, b) => a.order - b.order);

  const rowToLine = (r: PriceRow): QuoteLine => ({
    id: uid(), brand: r.brand, category: r.category, item: r.item, variant: r.variant,
    qty: 1, unitPrice: r.price, listPrice: r.price, options: [], discount: emptyDiscount()
  });
  const rowToOption = (r: PriceRow): LineOption => ({
    id: uid(), brand: r.brand, category: r.category, item: r.item, variant: r.variant,
    unitPrice: r.price, listPrice: r.price, qty: 1
  });

  const rowMap = useMemo(() => {
    const m = new Map<string, PriceRow>();
    brandRows.forEach(r => m.set(rowKey(r.brand, r.category, r.item, r.variant), r));
    return m;
  }, [brandRows]);
  const keyOf = (r: PriceRow) => rowKey(r.brand, r.category, r.item, r.variant);

  const categoryOptions: SelectOption[] = mainCats.map(c => ({ value: c, label: c }));
  const modelOptions: SelectOption[] = pickCat ? itemsIn(pickCat).map(i => {
    const vs = variantsOf(pickCat, i);
    const min = Math.min(...vs.map(v => v.price));
    return { value: i, label: i, sub: `${vs.length} option${vs.length > 1 ? 's' : ''}`, right: `from ${fmt0(min)}` };
  }) : [];
  const variantOptions: SelectOption[] = pickItem ? variantsOf(pickCat, pickItem).map(v => ({
    value: v.variant, label: v.variant || 'Standard', sub: v.notes || undefined, right: fmt0(v.price)
  })) : [];
  const upholsteryOptions: SelectOption[] = brandRows.filter(r => r.category === 'Upholstery').sort((a, b) => a.order - b.order)
    .map(r => ({ value: keyOf(r), label: r.item, right: fmt0(r.price) + ' / seat' }));
  const addonSelectOptions: SelectOption[] = brandRows.filter(r => addonCats.includes(r.category) && r.category !== 'Upholstery').sort((a, b) => a.order - b.order)
    .map(r => ({ value: keyOf(r), label: r.variant && r.variant !== 'Per piece' ? `${r.item} (${r.variant})` : r.item, sub: r.category, right: fmt0(r.price) }));

  const addPicked = () => {
    const vs = variantsOf(pickCat, pickItem);
    const row = vs.find(v => v.variant === pickVariant) || (vs.length === 1 ? vs[0] : undefined);
    if (!row) return;
    setLines(l => [...l, rowToLine(row)]);
    setPickItem(''); setPickVariant('');
  };

  const updateLine = (id: string, patch: Partial<QuoteLine>) => setLines(ls => ls.map(l => l.id === id ? { ...l, ...patch } : l));
  const updateOption = (lid: string, oid: string, patch: Partial<LineOption>) =>
    setLines(ls => ls.map(l => l.id === lid ? { ...l, options: l.options.map(o => o.id === oid ? { ...o, ...patch } : o) } : l));
  const addOption = (lid: string, key: string) => {
    const r = rowMap.get(key);
    if (!r) return;
    setLines(ls => ls.map(l => l.id === lid ? { ...l, options: [...l.options, rowToOption(r)] } : l));
  };
  const addCustomOption = (lid: string) =>
    setLines(ls => ls.map(l => l.id === lid ? { ...l, options: [...l.options, { id: uid(), brand, category: 'Custom', item: '', variant: '', unitPrice: 0, listPrice: 0, qty: 1, custom: true }] } : l));
  const addCustomLine = () =>
    setLines(ls => [...ls, { id: uid(), brand, category: 'Custom', item: '', variant: '', qty: 1, unitPrice: 0, listPrice: 0, custom: true, options: [], discount: emptyDiscount() }]);

  const payload: QuotePayload = useMemo(() => ({ v: 2, brand, docType, lines, discount, freight }), [brand, docType, lines, discount, freight]);
  const totals = useMemo(() => calcTotals(payload), [payload]);

  const stepError = (s: number): string => {
    if (s === 1) {
      if (!clientName.trim()) return 'Enter the client name.';
      if (mobile.replace(/\D/g, '').length < 10) return 'Enter a valid 10-digit mobile number.';
    }
    if (s === 2) {
      if (!lines.length) return 'Add at least one item.';
      const bad = lines.find(l => !l.item.trim() || l.qty < 1);
      if (bad) return 'Every item needs a name and a quantity of at least 1.';
    }
    if (s === 3 && freight.mode === 'extra' && !(freight.amount > 0)) return 'Enter the freight amount, or choose "Included".';
    return '';
  };

  const next = () => { const e = stepError(step); if (e) return setError(e); setError(''); setStep(s => Math.min(4, s + 1)); };
  const back = () => { setError(''); setStep(s => Math.max(0, s - 1)); };

  const reset = () => {
    setStep(0); setDocType('Quotation'); setCompany(''); setClientName(''); setMobile(''); setEmail('');
    setBilling(''); setShipping(''); setLines([]); setDiscount(emptyDiscount()); setAttachments([]);
    setLinkedQuotation(''); setSaved(null); setError(''); setBrand('Little Nap'); setFreight({ mode: 'extra', amount: 0 });
  };

  const meta = (number: string): PdfMeta => ({
    number, linkedQuotation: docType === 'PI' ? linkedQuotation : undefined, date: todayStr(),
    clientName: company.trim() ? `${clientName.trim()} (${company.trim()})` : clientName.trim(),
    mobile: mobile.trim(), email: email.trim(),
    billing: billing.trim(), shipping: (sameAddr ? billing : shipping).trim(),
    salespersonName: salesperson.name, salespersonId: employeeNo.trim() || salesperson.id, bank,
    terms: termsFor(price?.terms || [], brand), logoBase64: logo
  });

  const buildBytes = async (number: string): Promise<Uint8Array> => {
    const core = buildCorePdf(payload, meta(number));
    // Warehouse policy / brochure goes only on the PI
    const brochure = docType === 'PI' ? await getBrochure() : null;
    return mergePdf(core, { brochure, attachments: docType === 'PI' ? attachments : [] });
  };

  const download = (bytes: Uint8Array, number: string) => {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${docType === 'PI' ? 'Proforma_Invoice' : 'Quotation'}_${number}_${clientName.trim().replace(/\s+/g, '_')}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };

  const save = async () => {
    setError('');
    for (const s of [1, 2, 3]) { const e = stepError(s); if (e) { setStep(s); return setError(e); } }
    setSaving(true);
    try {
      const { quotationNumber } = await fetchNextNumber(brand, docType);
      const bytes = await buildBytes(quotationNumber);
      const full = company.trim() ? `${clientName.trim()} (${company.trim()})` : clientName.trim();
      await saveQuotation({
        quotationNumber, linkedQuotation: docType === 'PI' ? linkedQuotation : undefined, date: todayStr(),
        clientName: full, mobileNumber: mobile.trim(), emailId: email.trim(),
        billingAddress: billing.trim(), shippingAddress: (sameAddr ? billing : shipping).trim(),
        payload, pdfBase64: toBase64(bytes)
      });
      download(bytes, quotationNumber);
      setSaved({ number: quotationNumber, docType });
    } catch (e: any) {
      setError(e.message || 'Saving failed.');
    } finally { setSaving(false); }
  };

  const loadHistory = async () => {
    setHistLoading(true);
    try { setHistory(await fetchQuotationHistory()); } catch { /* keep old list */ } finally { setHistLoading(false); }
  };
  useEffect(() => { if (tab === 'history') loadHistory(); }, [tab]);

  // load a saved quotation back into the wizard (as a new quotation, or as the PI)
  const openRecord = (r: QuotationData, asPI: boolean) => {
    let p: QuotePayload | null = null;
    try { const j = JSON.parse(r.productsJson); if (j && j.v === 2) p = j; } catch { /* legacy record */ }
    if (!p) { window.alert('This record was made with the old generator and cannot be reopened here.'); return; }
    const b = p.brand;
    setBrand(b); setLines(p.lines); setDiscount(p.discount); setFreight(p.freight);
    setClientName(r.clientName); setCompany(''); setMobile(String(r.mobileNumber || '')); setEmail(r.emailId || '');
    setBilling(r.billingAddress || ''); setShipping(r.shippingAddress || ''); setSameAddr(!r.shippingAddress || r.shippingAddress === r.billingAddress);
    setAttachments([]); setSaved(null); setError('');
    if (asPI) { setDocType('PI'); setLinkedQuotation(r.quotationNumber); setStep(4); }
    else { setDocType('Quotation'); setLinkedQuotation(''); setStep(2); }
    setTab('build');
  };

  const onFiles = (list: FileList | null) => {
    if (!list) return;
    Array.from(list).forEach(file => {
      const name = file.name.toLowerCase();
      const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf');
      const isImg = file.type.startsWith('image/');
      if (!isPdf && !isImg) return window.alert(`"${file.name}" is not a PDF or image.`);
      const rd = new FileReader();
      rd.onload = e => setAttachments(a => [...a, isPdf
        ? { id: uid(), name: file.name, type: 'pdf', arrayBuffer: e.target?.result as ArrayBuffer }
        : { id: uid(), name: file.name, type: 'image', base64Url: e.target?.result as string }]);
      isPdf ? rd.readAsArrayBuffer(file) : rd.readAsDataURL(file);
    });
    if (fileRef.current) fileRef.current.value = '';
  };

  // ---------- render ----------
  const filteredHistory = history.filter(h => {
    const s = q.trim().toLowerCase();
    return !s || [h.quotationNumber, h.clientName, String(h.mobileNumber), h.brandName].some(x => (x || '').toLowerCase().includes(s));
  });

  if (!price && !loadErr) return <div className="p-10 text-center text-sm text-slate-500">Loading price list…</div>;
  if (loadErr) return (
    <div className={`${card} max-w-xl mx-auto text-center`}>
      <AlertCircle className="mx-auto mb-3 text-red-600" />
      <p className="text-sm text-slate-800 mb-4">{loadErr}</p>
      <button className={btnPrimary} onClick={() => load(true)}><RefreshCw size={16} /> Try again</button>
    </div>
  );

  const canAddPicked = !!pickItem && (variantsOf(pickCat, pickItem).length === 1 || !!pickVariant);
  const variantLabel = (v: string) => (v && v !== 'Standard' ? v : '');

  return (
    <div className="max-w-3xl mx-auto text-slate-900">
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-6">
          {(['build', 'history'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`pb-2 text-sm font-bold tracking-wide border-b-2 ${tab === t ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
              {t === 'build' ? 'New quotation' : 'History'}
            </button>
          ))}
        </div>
        <button className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1.5" onClick={() => load(true)}>
          <RefreshCw size={13} /> Refresh prices
        </button>
      </div>

      {tab === 'history' && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-4 text-slate-400" />
            <input className={`${field} pl-10`} placeholder="Search number, client, mobile" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          {histLoading && <p className="text-sm text-slate-500">Loading…</p>}
          {filteredHistory.map(h => {
            const isQ = (h.docType || 'Quotation') === 'Quotation';
            return (
              <div key={h.quotationNumber} className={`${card} !p-4 flex flex-wrap items-center gap-3`}>
                <div className="flex-1 min-w-[200px]">
                  <div className="font-bold text-sm">{h.quotationNumber} <span className="text-xs font-semibold" style={{ color: GOLD }}>{isQ ? 'Quotation' : 'Proforma Invoice'}</span></div>
                  <div className="text-xs text-slate-600 mt-0.5">{h.clientName} · {h.brandName} · {h.date}</div>
                  {h.convertedTo && <div className="text-xs text-emerald-700 mt-0.5">Converted to {h.convertedTo}</div>}
                  {!isQ && h.linkedQuotation && <div className="text-xs text-slate-500 mt-0.5">From {h.linkedQuotation}</div>}
                </div>
                <div className="font-bold text-sm">{formatINR(Number(h.grandTotal) || 0)}</div>
                {h.pdfUrl && <a className={`${btnGhost} !h-10 !px-4`} href={h.pdfUrl} target="_blank" rel="noreferrer">PDF</a>}
                {isQ && <button className={`${btnGhost} !h-10 !px-4`} onClick={() => openRecord(h, false)}>Revise</button>}
                {isQ && !h.convertedTo && <button className={`${btnPrimary} !h-10 !px-4`} onClick={() => openRecord(h, true)}>Convert to PI</button>}
              </div>
            );
          })}
          {!filteredHistory.length && !histLoading && <p className="p-6 text-sm text-slate-500 text-center">Nothing found.</p>}
        </div>
      )}

      {tab === 'build' && (
        <div>
          {saved ? (
            <div className={`${card} text-center !py-10`}>
              <FileCheck className="mx-auto mb-3 text-emerald-700" size={36} />
              <h3 className="text-lg font-bold mb-1">{saved.docType === 'PI' ? 'Proforma Invoice' : 'Quotation'} {saved.number} saved</h3>
              <p className="text-sm text-slate-600 mb-6">It is recorded in the sheet and the PDF has been downloaded.</p>
              <div className="flex flex-wrap gap-3 justify-center">
                {saved.docType === 'Quotation' && (
                  <button className={btnPrimary} onClick={() => { setDocType('PI'); setLinkedQuotation(saved.number); setSaved(null); setStep(4); }}>
                    Convert to Proforma Invoice
                  </button>
                )}
                <button className={btnGhost} onClick={reset}>Start a new one</button>
              </div>
            </div>
          ) : (
            <>
              {/* progress */}
              <div className="flex items-center mb-6">
                {STEPS.map((s, i) => (
                  <React.Fragment key={s}>
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${i < step ? 'bg-slate-900 text-white' : i === step ? 'bg-slate-900 text-white ring-4 ring-slate-200' : 'bg-slate-100 text-slate-400'}`}>
                        {i < step ? <Check size={14} /> : i + 1}
                      </div>
                      <span className={`hidden sm:block text-xs font-bold ${i === step ? 'text-slate-900' : 'text-slate-400'}`}>{s}</span>
                    </div>
                    {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-3 ${i < step ? 'bg-slate-900' : 'bg-slate-200'}`} />}
                  </React.Fragment>
                ))}
              </div>

              <div className="mb-5">
                <h2 className="text-xl font-bold tracking-tight">{docType === 'PI' && step === 4 ? 'Proforma Invoice' : STEP_HELP[step][0]}</h2>
                <p className="text-sm text-slate-500 mt-1">{STEP_HELP[step][1]}</p>
              </div>

              {docType === 'PI' && (
                <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  Converting <b>{linkedQuotation}</b> to a Proforma Invoice. The warehouse policy is attached automatically.
                </div>
              )}

              {step === 0 && (
                <div className="grid sm:grid-cols-3 gap-3">
                  {BRANDS.map(b => (
                    <button key={b} onClick={() => chooseBrand(b)} disabled={docType === 'PI'}
                      className={`text-left p-5 rounded-2xl border-2 bg-white ${brand === b ? 'border-slate-900 shadow-[0_8px_30px_rgba(15,23,42,0.08)]' : 'border-slate-200 hover:border-slate-400'} disabled:opacity-60`}>
                      <div className="font-bold text-base">{b}</div>
                      <div className="text-xs text-slate-500 mt-2 leading-relaxed">
                        {BRAND_RULES[b].customisation ? 'Fully customisable' : 'No customisation'}<br />
                        {BRAND_RULES[b].freightDefault === 'included' ? 'Freight included' : 'Freight extra'}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {step === 1 && (
                <div className={`${card} grid sm:grid-cols-2 gap-4`}>
                  <div><label className={label}>Client name *</label><input className={field} value={clientName} onChange={e => setClientName(e.target.value)} autoFocus /></div>
                  <div><label className={label}>Company</label><input className={field} value={company} onChange={e => setCompany(e.target.value)} placeholder="Optional" /></div>
                  <div><label className={label}>Mobile *</label><input className={field} inputMode="tel" value={mobile} onChange={e => setMobile(e.target.value)} /></div>
                  <div><label className={label}>Email</label><input className={field} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Optional" /></div>
                  <div className="sm:col-span-2"><label className={label}>Billing address</label><textarea className={area} rows={3} value={billing} onChange={e => setBilling(e.target.value)} /></div>
                  <label className="sm:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={sameAddr} onChange={e => setSameAddr(e.target.checked)} /> Shipping address is the same as billing</label>
                  {!sameAddr && <div className="sm:col-span-2"><label className={label}>Shipping address</label><textarea className={area} rows={3} value={shipping} onChange={e => setShipping(e.target.value)} /></div>}
                  <div className="sm:col-span-2 border-t border-slate-100 pt-4 grid sm:grid-cols-2 gap-4">
                    <div><label className={label}>Prepared by</label><input className={`${field} bg-slate-50`} value={salesperson.name} readOnly /></div>
                    <div><label className={label}>Employee number</label><input className={field} value={employeeNo} onChange={e => setEmployeeNo(e.target.value)} /></div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div className={`${card} space-y-4`}>
                    <div className="grid sm:grid-cols-3 gap-4">
                      <SearchSelect label="Category" title="Category" value={pickCat} options={categoryOptions}
                        onChange={v => { setPickCat(v); setPickItem(''); setPickVariant(''); }} />
                      <SearchSelect label="Model" title="Model" value={pickItem} options={modelOptions} disabled={!pickCat}
                        onChange={v => { setPickItem(v); const vs = variantsOf(pickCat, v); setPickVariant(vs.length === 1 ? vs[0].variant : ''); }} />
                      <SearchSelect label="Seats and type" title="Seats and type" value={pickVariant} options={variantOptions} disabled={!pickItem}
                        placeholder={pickItem ? 'Select' : 'Pick a model first'} onChange={setPickVariant} />
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                      <button className={btnPrimary} disabled={!canAddPicked} onClick={addPicked}><Plus size={16} /> Add item</button>
                      {rule.customisation && <button className="text-xs font-semibold underline text-slate-600" onClick={addCustomLine}>Item not in the list? Add a custom item</button>}
                    </div>
                  </div>

                  {!lines.length && <p className="text-sm text-slate-500 text-center py-6">No items added yet.</p>}

                  {lines.map((l, idx) => {
                    const lt = totals.lines[idx];
                    const upholsteries = l.options.filter(o => o.category === 'Upholstery');
                    const addons = l.options.filter(o => o.category !== 'Upholstery');
                    const optionRow = (o: LineOption, qtyLabel: string) => (
                      <div key={o.id} className="grid grid-cols-12 gap-2 items-center py-2 border-t border-slate-100">
                        <div className="col-span-12 sm:col-span-5 text-sm font-medium">
                          {o.custom
                            ? <input className={field} placeholder="Name" value={o.item} onChange={e => updateOption(l.id, o.id, { item: e.target.value })} />
                            : <>{o.item}{o.variant && !['Per seat', 'Per piece'].includes(o.variant) ? <span className="text-slate-500 font-normal"> · {o.variant}</span> : null}</>}
                        </div>
                        <div className="col-span-4 sm:col-span-2">
                          <span className="block text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">{qtyLabel}</span>
                          <input className={`${field} !h-10`} type="number" min={1} value={o.qty} onChange={e => updateOption(l.id, o.id, { qty: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} />
                        </div>
                        <div className="col-span-6 sm:col-span-4">
                          <span className="block text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">Price each</span>
                          <input className={`${field} !h-10`} type="number" min={0} value={o.unitPrice} onChange={e => updateOption(l.id, o.id, { unitPrice: Math.max(0, Number(e.target.value) || 0) })} />
                        </div>
                        <button className="col-span-2 sm:col-span-1 flex justify-end text-red-600 self-end pb-2.5" aria-label="Remove"
                          onClick={() => setLines(ls => ls.map(x => x.id === l.id ? { ...x, options: x.options.filter(y => y.id !== o.id) } : x))}><Trash2 size={17} /></button>
                      </div>
                    );
                    return (
                      <div key={l.id} className={card}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Item {idx + 1}{l.custom ? ' · custom' : ''}</div>
                            {l.custom
                              ? <input className={`${field} mt-1`} placeholder="Item name" value={l.item} onChange={e => updateLine(l.id, { item: e.target.value })} />
                              : <div className="text-base font-bold mt-0.5">{l.item}</div>}
                            {!l.custom && variantLabel(l.variant) && <div className="text-sm text-slate-500">{l.variant}</div>}
                          </div>
                          <button className="text-red-600 p-1" aria-label="Remove item" onClick={() => setLines(ls => ls.filter(x => x.id !== l.id))}><Trash2 size={19} /></button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <div><label className={label}>Quantity</label>
                            <input className={field} type="number" min={1} value={l.qty} onChange={e => updateLine(l.id, { qty: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} /></div>
                          <div><label className={label}>Price each (incl. GST)</label>
                            <input className={field} type="number" min={0} value={l.unitPrice} onChange={e => updateLine(l.id, { unitPrice: Math.max(0, Number(e.target.value) || 0) })} />
                            {lineIsEdited(l) && <div className="text-[11px] text-amber-700 mt-1">List price {fmt0(l.listPrice)}</div>}</div>
                        </div>

                        {rule.customisation && (
                          <div className="mt-5 space-y-5">
                            <div>
                              <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Upholstery</div>
                              {upholsteries.map(o => optionRow(o, 'Seats'))}
                              <div className="mt-2">
                                <SearchSelect title="Add upholstery" value="" options={upholsteryOptions} placeholder="+ Add upholstery (leather, fabric…)" onChange={v => addOption(l.id, v)} />
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Add-ons</div>
                              {addons.map(o => optionRow(o, 'Qty'))}
                              <div className="mt-2 flex flex-col sm:flex-row gap-3 sm:items-center">
                                <div className="flex-1"><SearchSelect title="Add an add-on" value="" options={addonSelectOptions} placeholder="+ Add add-on (motor, switch, veneer…)" onChange={v => addOption(l.id, v)} /></div>
                                <button className="text-xs font-semibold underline text-slate-600 text-left" onClick={() => addCustomOption(l.id)}>Custom add-on</button>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="mt-5 pt-4 border-t border-slate-100 flex justify-between items-center">
                          <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">Item total</span>
                          <span className="text-base font-bold">{formatINR(lt.net)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {step === 3 && (
                <div className="grid sm:grid-cols-2 gap-5">
                  <div className={card}>
                    <h3 className="font-bold mb-3 text-sm">Discount</h3>
                    <div className="flex gap-2">
                      <select className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm" value={discount.mode} onChange={e => setDiscount({ ...discount, mode: e.target.value as 'pct' | 'amt' })}>
                        <option value="pct">%</option><option value="amt">Rs.</option>
                      </select>
                      <input className={field} type="number" min={0} placeholder="0" value={discount.value || ''} onChange={e => setDiscount({ ...discount, value: Math.max(0, Number(e.target.value) || 0) })} />
                    </div>
                    <p className="text-xs text-slate-500 mt-3">Applied on the total of all items.</p>
                  </div>
                  <div className={card}>
                    <h3 className="font-bold mb-3 text-sm">Freight</h3>
                    <div className="flex gap-5 mb-4 text-sm">
                      <label className="flex items-center gap-2"><input type="radio" checked={freight.mode === 'included'} onChange={() => setFreight({ mode: 'included', amount: 0 })} /> Included</label>
                      <label className="flex items-center gap-2"><input type="radio" checked={freight.mode === 'extra'} onChange={() => setFreight({ ...freight, mode: 'extra' })} /> Extra</label>
                    </div>
                    {freight.mode === 'extra' && (
                      <div><label className={label}>Freight amount (Rs.)</label>
                        <input className={field} type="number" min={0} value={freight.amount || ''} onChange={e => setFreight({ mode: 'extra', amount: Math.max(0, Number(e.target.value) || 0) })} /></div>
                    )}
                    <p className="text-xs text-slate-500 mt-3">{rule.freightNote}</p>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-5">
                  <div className={`${card} !p-0 overflow-hidden`}>
                    <div className="p-5 border-b border-slate-100 text-sm">
                      <div className="font-bold text-base">{company ? `${clientName} (${company})` : clientName}</div>
                      <div className="text-slate-600 mt-0.5">{mobile}{email ? ` · ${email}` : ''}</div>
                      <div className="text-slate-500 text-xs mt-1">{brand} · {docType === 'PI' ? 'Proforma Invoice' : 'Quotation'}</div>
                    </div>
                    {lines.map((l, i) => (
                      <div key={l.id} className="px-5 py-3 border-b border-slate-100 text-sm flex justify-between gap-3">
                        <div>
                          <div className="font-semibold">{l.qty} × {l.item}{variantLabel(l.variant) ? ` · ${l.variant}` : ''}</div>
                          {l.options.length > 0 && <div className="text-xs text-slate-500 mt-0.5">{l.options.map(o => o.item).join(', ')}</div>}
                        </div>
                        <div className="font-semibold whitespace-nowrap">{formatINR(totals.lines[i].net)}</div>
                      </div>
                    ))}
                    <div className="p-5 text-sm space-y-1.5 bg-slate-50">
                      <div className="flex justify-between"><span>Sub total</span><span>{formatINR(totals.subtotal)}</span></div>
                      {totals.overallDiscount > 0 && <div className="flex justify-between"><span>Discount</span><span>- {formatINR(totals.overallDiscount)}</span></div>}
                      <div className="flex justify-between text-slate-500"><span>GST included</span><span>{formatINR(totals.gstIncluded)}</span></div>
                      <div className="flex justify-between"><span>Freight</span><span>{freight.mode === 'extra' ? formatINR(totals.freightExtra) : 'Included'}</span></div>
                      <div className="flex justify-between font-bold text-base pt-2 border-t border-slate-200"><span>Grand total</span><span>{formatINR(totals.grandTotal)}</span></div>
                    </div>
                  </div>

                  {docType === 'PI' && (
                    <div className={card}>
                      <h3 className="font-bold text-sm mb-1">Attach other documents</h3>
                      <p className="text-xs text-slate-500 mb-3">Optional. PDF or images, added after the warehouse policy.</p>
                      <input ref={fileRef} type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={e => onFiles(e.target.files)} />
                      <button className={btnGhost} onClick={() => fileRef.current?.click()}><Upload size={16} /> Add files</button>
                      {attachments.map(f => (
                        <div key={f.id} className="flex justify-between text-sm mt-2 border-t border-slate-100 pt-2">
                          <span>{f.name}</span>
                          <button className="text-red-600" aria-label="Remove file" onClick={() => setAttachments(a => a.filter(x => x.id !== f.id))}><Trash2 size={15} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {error && <div className="mt-5 flex gap-2 items-start text-sm text-red-700 border border-red-200 bg-red-50 rounded-xl p-3"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</div>}

              <div className="flex justify-between mt-6">
                <button className={btnGhost} onClick={back} disabled={step === 0 || saving}><ArrowLeft size={16} /> Back</button>
                {step < 4
                  ? <button className={btnPrimary} onClick={next}>Next <ArrowRight size={16} /></button>
                  : <button className={btnPrimary} onClick={save} disabled={saving}>
                      {saving ? 'Saving…' : docType === 'PI' ? <><Check size={16} /> Save Proforma Invoice</> : <><Download size={16} /> Save quotation</>}
                    </button>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
