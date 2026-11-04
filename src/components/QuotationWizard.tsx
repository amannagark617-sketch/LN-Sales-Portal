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
  BRAND_RULES, calcTotals, emptyDiscount, formatINR, lineIsEdited
} from '../quotation/pricing';
import { buildCorePdf, mergePdf, termsFor, Attachment, PdfMeta } from '../quotation/pdf';

const GOLD = '#9B7C50';
const uid = () => Math.random().toString(36).slice(2, 10);
const todayStr = () => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const field = 'w-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-slate-900';
const label = 'block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1';
const btnPrimary = 'inline-flex items-center justify-center gap-2 bg-slate-900 text-white px-5 py-3 text-sm font-semibold hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed';
const btnGhost = 'inline-flex items-center justify-center gap-2 border border-slate-300 bg-white text-slate-800 px-4 py-2.5 text-sm font-semibold hover:border-slate-900 disabled:opacity-40';

const STEPS = ['Brand', 'Customer', 'Items', 'Pricing', 'Review'] as const;

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
    const r = brandRows.find(x => `${x.category}|${x.item}|${x.variant}` === key);
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
    salespersonName: salesperson.name, salespersonId: salesperson.id, bank,
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
    <div className="max-w-xl mx-auto p-8 bg-white border border-slate-200 text-center">
      <AlertCircle className="mx-auto mb-3 text-red-600" />
      <p className="text-sm text-slate-800 mb-4">{loadErr}</p>
      <button className={btnPrimary} onClick={() => load(true)}><RefreshCw size={16} /> Try again</button>
    </div>
  );

  const addonOptions = brandRows.filter(r => addonCats.includes(r.category));

  return (
    <div className="max-w-4xl mx-auto bg-white text-slate-900">
      <div className="flex border-b border-slate-200 mb-6">
        {(['build', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm font-bold uppercase tracking-wider border-b-2 -mb-px ${tab === t ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400'}`}>
            {t === 'build' ? 'New' : 'History'}
          </button>
        ))}
        <div className="ml-auto flex items-center">
          <button className="text-xs text-slate-500 flex items-center gap-1 px-3" onClick={() => load(true)} title="Reload prices from the sheet"><RefreshCw size={13} /> Refresh prices</button>
        </div>
      </div>

      {tab === 'history' && (
        <div>
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
            <input className={`${field} pl-9`} placeholder="Search number, client, mobile" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          {histLoading && <p className="text-sm text-slate-500">Loading…</p>}
          <div className="divide-y divide-slate-200 border border-slate-200">
            {filteredHistory.map(h => {
              const isQ = (h.docType || 'Quotation') === 'Quotation';
              return (
                <div key={h.quotationNumber} className="p-4 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-bold text-sm">{h.quotationNumber} <span className="text-xs font-semibold" style={{ color: GOLD }}>{isQ ? 'Quotation' : 'PI'}</span></div>
                    <div className="text-xs text-slate-600">{h.clientName} · {h.brandName} · {h.date}</div>
                    {h.convertedTo && <div className="text-xs text-emerald-700">Converted to {h.convertedTo}</div>}
                    {!isQ && h.linkedQuotation && <div className="text-xs text-slate-500">From {h.linkedQuotation}</div>}
                  </div>
                  <div className="font-bold text-sm">{formatINR(Number(h.grandTotal) || 0)}</div>
                  {h.pdfUrl && <a className={btnGhost} href={h.pdfUrl} target="_blank" rel="noreferrer">PDF</a>}
                  {isQ && <button className={btnGhost} onClick={() => openRecord(h, false)}>Revise</button>}
                  {isQ && !h.convertedTo && <button className={btnPrimary} onClick={() => openRecord(h, true)}>Convert to PI</button>}
                </div>
              );
            })}
            {!filteredHistory.length && !histLoading && <p className="p-6 text-sm text-slate-500 text-center">Nothing found.</p>}
          </div>
        </div>
      )}

      {tab === 'build' && (
        <div>
          {/* progress */}
          <div className="flex mb-6">
            {STEPS.map((s, i) => (
              <div key={s} className={`flex-1 pb-2 border-b-2 text-center text-[11px] font-bold uppercase tracking-wider ${i === step ? 'border-slate-900 text-slate-900' : i < step ? 'border-slate-400 text-slate-500' : 'border-slate-200 text-slate-300'}`}>
                {i + 1}. {s}
              </div>
            ))}
          </div>

          {docType === 'PI' && (
            <div className="mb-5 border border-slate-300 bg-slate-50 p-3 text-sm">
              Proforma Invoice against <b>{linkedQuotation}</b>. The warehouse policy is attached automatically.
            </div>
          )}

          {saved ? (
            <div className="border border-emerald-300 bg-emerald-50 p-8 text-center">
              <FileCheck className="mx-auto mb-3 text-emerald-700" size={34} />
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
              {step === 0 && (
                <div>
                  <h3 className="text-base font-bold mb-1">Which brand is this for?</h3>
                  <p className="text-sm text-slate-500 mb-4">One brand per quotation. Brands cannot be mixed.</p>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {BRANDS.map(b => (
                      <button key={b} onClick={() => chooseBrand(b)} disabled={docType === 'PI'}
                        className={`text-left p-4 border-2 ${brand === b ? 'border-slate-900' : 'border-slate-200 hover:border-slate-400'} disabled:opacity-60`}>
                        <div className="font-bold">{b}</div>
                        <div className="text-xs text-slate-500 mt-1">{BRAND_RULES[b].customisation ? 'Fully customisable' : 'No customisation'} · {BRAND_RULES[b].freightDefault === 'included' ? 'Freight included' : 'Freight extra'}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div><label className={label}>Client name *</label><input className={field} value={clientName} onChange={e => setClientName(e.target.value)} autoFocus /></div>
                  <div><label className={label}>Company (optional)</label><input className={field} value={company} onChange={e => setCompany(e.target.value)} /></div>
                  <div><label className={label}>Mobile *</label><input className={field} inputMode="tel" value={mobile} onChange={e => setMobile(e.target.value)} /></div>
                  <div><label className={label}>Email</label><input className={field} type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
                  <div className="sm:col-span-2"><label className={label}>Billing address</label><textarea className={field} rows={3} value={billing} onChange={e => setBilling(e.target.value)} /></div>
                  <label className="sm:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={sameAddr} onChange={e => setSameAddr(e.target.checked)} /> Shipping address is the same</label>
                  {!sameAddr && <div className="sm:col-span-2"><label className={label}>Shipping address</label><textarea className={field} rows={3} value={shipping} onChange={e => setShipping(e.target.value)} /></div>}
                </div>
              )}

              {step === 2 && (
                <div>
                  <div className="border border-slate-200 p-4 mb-5">
                    <div className="grid sm:grid-cols-4 gap-3 items-end">
                      <div><label className={label}>Category</label>
                        <select className={field} value={pickCat} onChange={e => { setPickCat(e.target.value); setPickItem(''); setPickVariant(''); }}>
                          <option value="">Select</option>{mainCats.map(c => <option key={c}>{c}</option>)}
                        </select></div>
                      <div><label className={label}>Model</label>
                        <select className={field} value={pickItem} disabled={!pickCat} onChange={e => { setPickItem(e.target.value); const v = variantsOf(pickCat, e.target.value); setPickVariant(v.length === 1 ? v[0].variant : ''); }}>
                          <option value="">Select</option>{pickCat && itemsIn(pickCat).map(i => <option key={i}>{i}</option>)}
                        </select></div>
                      <div><label className={label}>Variant</label>
                        <select className={field} value={pickVariant} disabled={!pickItem} onChange={e => setPickVariant(e.target.value)}>
                          <option value="">Select</option>{pickItem && variantsOf(pickCat, pickItem).map(v => <option key={v.variant} value={v.variant}>{(v.variant || 'Standard')} · {formatINR(v.price)}</option>)}
                        </select></div>
                      <button className={btnPrimary} disabled={!pickItem || (variantsOf(pickCat, pickItem).length > 1 && !pickVariant)} onClick={addPicked}><Plus size={16} /> Add</button>
                    </div>
                    {rule.customisation && <button className="mt-3 text-xs font-semibold underline text-slate-600" onClick={addCustomLine}>Add a custom item not in the price list</button>}
                  </div>

                  {!lines.length && <p className="text-sm text-slate-500 text-center py-8">No items yet. Pick a model above.</p>}

                  {lines.map((l, idx) => {
                    const lt = totals.lines[idx];
                    return (
                      <div key={l.id} className="border border-slate-200 mb-4">
                        <div className="p-4 grid sm:grid-cols-12 gap-3 items-end">
                          <div className="sm:col-span-5">
                            <label className={label}>Item {idx + 1}{l.custom ? ' (custom)' : ''}</label>
                            {l.custom
                              ? <input className={field} placeholder="Item name" value={l.item} onChange={e => updateLine(l.id, { item: e.target.value })} />
                              : <div className="text-sm font-bold py-2">{l.item}{l.variant ? <span className="font-normal text-slate-500"> · {l.variant}</span> : null}</div>}
                          </div>
                          <div className="sm:col-span-2"><label className={label}>Qty</label>
                            <input className={field} type="number" min={1} value={l.qty} onChange={e => updateLine(l.id, { qty: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} /></div>
                          <div className="sm:col-span-3"><label className={label}>Price each (incl. GST)</label>
                            <input className={field} type="number" min={0} value={l.unitPrice} onChange={e => updateLine(l.id, { unitPrice: Math.max(0, Number(e.target.value) || 0) })} />
                            {lineIsEdited(l) && <div className="text-[11px] text-amber-700 mt-1">List price {formatINR(l.listPrice)}</div>}</div>
                          <div className="sm:col-span-2 text-right">
                            <button className="text-red-600 p-2" aria-label="Remove item" onClick={() => setLines(ls => ls.filter(x => x.id !== l.id))}><Trash2 size={18} /></button>
                          </div>
                        </div>

                        {rule.customisation && (
                          <div className="px-4 pb-3">
                            {l.options.map(o => (
                              <div key={o.id} className="grid grid-cols-12 gap-2 items-center py-1.5 border-t border-slate-100">
                                <div className="col-span-5 text-sm">
                                  {o.custom
                                    ? <input className={field} placeholder="Customisation name" value={o.item} onChange={e => updateOption(l.id, o.id, { item: e.target.value })} />
                                    : <>{o.item}{o.variant && o.variant !== 'Per seat' ? <span className="text-slate-500"> · {o.variant}</span> : null}</>}
                                </div>
                                <input className={`${field} col-span-2`} type="number" min={1} value={o.qty} onChange={e => updateOption(l.id, o.id, { qty: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} title="Quantity per piece" />
                                <input className={`${field} col-span-4`} type="number" min={0} value={o.unitPrice} onChange={e => updateOption(l.id, o.id, { unitPrice: Math.max(0, Number(e.target.value) || 0) })} title="Price each" />
                                <button className="col-span-1 text-red-600" aria-label="Remove" onClick={() => setLines(ls => ls.map(x => x.id === l.id ? { ...x, options: x.options.filter(y => y.id !== o.id) } : x))}><Trash2 size={16} /></button>
                              </div>
                            ))}
                            <div className="flex flex-wrap gap-2 mt-2">
                              <select className={`${field} sm:w-auto sm:min-w-[260px]`} value="" onChange={e => { if (e.target.value) addOption(l.id, e.target.value); }}>
                                <option value="">+ Add customisation (leather, motor, veneer…)</option>
                                {addonCats.map(c => (
                                  <optgroup key={c} label={c}>
                                    {addonOptions.filter(r => r.category === c).map(r => (
                                      <option key={`${r.category}|${r.item}|${r.variant}`} value={`${r.category}|${r.item}|${r.variant}`}>
                                        {r.item}{r.variant ? ` (${r.variant})` : ''} · {formatINR(r.price)}
                                      </option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                              <button className={btnGhost} onClick={() => addCustomOption(l.id)}>Custom customisation</button>
                            </div>
                          </div>
                        )}

                        <div className="px-4 pb-4 grid sm:grid-cols-12 gap-3 items-end">
                          <div className="sm:col-span-6"><label className={label}>Note on this item</label>
                            <input className={field} value={l.note || ''} onChange={e => updateLine(l.id, { note: e.target.value })} /></div>
                          <div className="sm:col-span-3"><label className={label}>Discount</label>
                            <div className="flex">
                              <select className="border border-slate-300 border-r-0 bg-white px-2 text-sm" value={l.discount.mode} onChange={e => updateLine(l.id, { discount: { ...l.discount, mode: e.target.value as 'pct' | 'amt' } })}>
                                <option value="pct">%</option><option value="amt">Rs.</option>
                              </select>
                              <input className={field} type="number" min={0} value={l.discount.value || ''} onChange={e => updateLine(l.id, { discount: { ...l.discount, value: Math.max(0, Number(e.target.value) || 0) } })} />
                            </div></div>
                          <div className="sm:col-span-3 text-right text-sm"><div className="text-[11px] uppercase tracking-wider text-slate-500">Line total</div><div className="font-bold">{formatINR(lt.net)}</div></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {step === 3 && (
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="border border-slate-200 p-4">
                    <h3 className="font-bold mb-3 text-sm">Overall discount</h3>
                    <div className="flex">
                      <select className="border border-slate-300 border-r-0 bg-white px-3 text-sm" value={discount.mode} onChange={e => setDiscount({ ...discount, mode: e.target.value as 'pct' | 'amt' })}>
                        <option value="pct">%</option><option value="amt">Rs.</option>
                      </select>
                      <input className={field} type="number" min={0} value={discount.value || ''} onChange={e => setDiscount({ ...discount, value: Math.max(0, Number(e.target.value) || 0) })} />
                    </div>
                  </div>
                  <div className="border border-slate-200 p-4">
                    <h3 className="font-bold mb-3 text-sm">Freight</h3>
                    <div className="flex gap-4 mb-3 text-sm">
                      <label className="flex items-center gap-2"><input type="radio" checked={freight.mode === 'included'} onChange={() => setFreight({ mode: 'included', amount: 0 })} /> Included in price</label>
                      <label className="flex items-center gap-2"><input type="radio" checked={freight.mode === 'extra'} onChange={() => setFreight({ ...freight, mode: 'extra' })} /> Added as extra</label>
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
                <div>
                  <div className="border border-slate-200 mb-5">
                    <div className="p-4 border-b border-slate-200 text-sm">
                      <div className="font-bold">{company ? `${clientName} (${company})` : clientName}</div>
                      <div className="text-slate-600">{mobile}{email ? ` · ${email}` : ''}</div>
                      <div className="text-slate-500 text-xs mt-1">{brand} · {docType === 'PI' ? 'Proforma Invoice' : 'Quotation'}</div>
                    </div>
                    {lines.map((l, i) => (
                      <div key={l.id} className="px-4 py-2 border-b border-slate-100 text-sm flex justify-between gap-3">
                        <div>{l.qty} × {l.item}{l.variant ? ` (${l.variant})` : ''}{l.options.length ? <div className="text-xs text-slate-500">{l.options.map(o => o.item).join(', ')}</div> : null}</div>
                        <div className="font-semibold whitespace-nowrap">{formatINR(totals.lines[i].net)}</div>
                      </div>
                    ))}
                    <div className="p-4 text-sm space-y-1">
                      <div className="flex justify-between"><span>Sub total</span><span>{formatINR(totals.subtotal)}</span></div>
                      {totals.overallDiscount > 0 && <div className="flex justify-between"><span>Overall discount</span><span>- {formatINR(totals.overallDiscount)}</span></div>}
                      <div className="flex justify-between text-slate-500"><span>GST included</span><span>{formatINR(totals.gstIncluded)}</span></div>
                      <div className="flex justify-between"><span>Freight</span><span>{freight.mode === 'extra' ? formatINR(totals.freightExtra) : 'Included'}</span></div>
                      <div className="flex justify-between font-bold text-base pt-2 border-t border-slate-200"><span>Grand total</span><span>{formatINR(totals.grandTotal)}</span></div>
                    </div>
                  </div>

                  {docType === 'PI' && (
                    <div className="border border-slate-200 p-4 mb-5">
                      <h3 className="font-bold text-sm mb-1">Attach other documents (optional)</h3>
                      <p className="text-xs text-slate-500 mb-3">PDF or images. They are added after the warehouse policy.</p>
                      <input ref={fileRef} type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={e => onFiles(e.target.files)} />
                      <button className={btnGhost} onClick={() => fileRef.current?.click()}><Upload size={16} /> Add files</button>
                      {attachments.map(f => (
                        <div key={f.id} className="flex justify-between text-sm mt-2 border-t border-slate-100 pt-2">
                          <span>{f.name}</span>
                          <button className="text-red-600" onClick={() => setAttachments(a => a.filter(x => x.id !== f.id))}><Trash2 size={15} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {error && <div className="mt-4 flex gap-2 items-start text-sm text-red-700 border border-red-200 bg-red-50 p-3"><AlertCircle size={16} className="mt-0.5 shrink-0" />{error}</div>}

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
