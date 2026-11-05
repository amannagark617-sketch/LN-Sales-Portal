import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Plus, Minus, Trash2, Upload, Download, FileCheck, ArrowLeft, ArrowRight, AlertCircle, RefreshCw, Search, SlidersHorizontal, Truck, Receipt } from 'lucide-react';
import { Salesperson, BankDetails } from '../types';
import {
  fetchPriceList, fetchNextNumber, saveQuotation, fetchBankDetails, fetchQuotationHistory, QuotationData
} from '../services/dataService';
import {
  Brand, BRANDS, DocType, PriceListPayload, PriceRow, QuoteLine, LineOption, QuotePayload, SpecLine
} from '../quotation/types';
import {
  BRAND_RULES, allowedBrands, isMetreOption, calcTotals, emptyDiscount, formatINR, lineIsEdited, rowKey
} from '../quotation/pricing';
import { buildCorePdf, mergePdf, termsFor, Attachment, PdfMeta } from '../quotation/pdf';
import { ItemPicker, ItemGroup } from './ItemPicker';

const GOLD = '#9B7C50';
const SPEC_PRESETS = ['Functionality', 'Dimensions (seat / arm)', 'Upholstery', 'Colour shade', 'Accessories', 'Cup holder', 'Switch', 'Side pocket / magazine holder', 'Head cushion', 'Wheels', 'IVR rod', 'AUX input', 'Concept', 'Metal finishing', 'Fire retardant', 'Logo / embroidery', 'Seat numbering', 'Motor make', 'Seating layout'];
const specFilled = (specs?: SpecLine[]) => (specs || []).filter(x => x.label.trim() && x.value.trim());

function SpecEditor({ specs, onChange }: { specs: SpecLine[]; onChange: (s: SpecLine[]) => void }) {
  const [open, setOpen] = useState(false);
  const valueOf = (lab: string) => specs.find(x => x.label === lab)?.value || '';
  const setPreset = (lab: string, value: string) => {
    const has = specs.some(x => x.label === lab);
    onChange(has ? specs.map(x => x.label === lab ? { ...x, value } : x) : [...specs, { label: lab, value }]);
  };
  const customs = specs.filter(x => !SPEC_PRESETS.includes(x.label));
  const setCustom = (i: number, patch: Partial<SpecLine>) => {
    const target = customs[i];
    onChange(specs.map(x => x === target ? { ...x, ...patch } : x));
  };
  const n = specFilled(specs).length;
  return (
    <div>
      <button type="button" className="w-full flex items-center justify-between text-sm font-semibold text-slate-900" onClick={() => setOpen(o => !o)}>
        <span>Specifications <span className="font-normal text-slate-400">(optional, blank lines are not shown)</span></span>
        <span className="text-xs font-medium text-slate-500">{n ? `${n} filled` : open ? 'Hide' : 'Add'}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {SPEC_PRESETS.map(lab => (
            <div key={lab}><label className={label}>{lab}</label><input className={field} value={valueOf(lab)} onChange={e => setPreset(lab, e.target.value)} /></div>
          ))}
          {customs.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] gap-2 items-end">
              <div className="grid sm:grid-cols-2 gap-2">
                <input className={field} placeholder="Detail name" value={c.label} onChange={e => setCustom(i, { label: e.target.value })} />
                <input className={field} placeholder="Detail" value={c.value} onChange={e => setCustom(i, { value: e.target.value })} />
              </div>
              <button type="button" className="text-red-600 p-2" aria-label="Remove detail" onClick={() => onChange(specs.filter(x => x !== c))}><Trash2 size={18} /></button>
            </div>
          ))}
          <button type="button" className={ADD_BTN} onClick={() => onChange([...specs, { label: '', value: '' }])}><Plus size={16} /> Add another detail</button>
        </div>
      )}
    </div>
  );
}
const uid = () => Math.random().toString(36).slice(2, 10);
const todayStr = () => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const field = 'w-full h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:border-slate-900';
const area = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 hover:border-slate-400 focus:outline-none focus:border-slate-900';
const label = 'block text-[13px] font-medium text-slate-600 mb-1.5';
const card = 'bg-white border border-slate-200 rounded-xl shadow-sm p-5 sm:p-6';
const btnPrimary = 'inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-slate-900 text-white px-6 text-sm font-bold hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9B7C50] focus-visible:ring-offset-2';
const btnGhost = 'inline-flex items-center justify-center gap-2 h-12 rounded-xl border border-slate-200 bg-white text-slate-800 px-5 text-sm font-bold hover:border-slate-400 disabled:opacity-40';
const ADD_BTN = 'inline-flex items-center justify-start gap-2 h-12 w-full rounded-xl border border-dashed border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:border-slate-500';
const fmt0 = (n: number) => 'Rs. ' + Math.round(n).toLocaleString('en-IN');

const QUOTE_BRANDS: Brand[] = BRANDS;
// each brand keeps its own colour so the choice is recognised at a glance
const BRAND_LOOK: Record<string, { accent: string; tint: string; line: string }> = {
  'Little Nap': { accent: '#9B7C50', tint: '#FAF6EF', line: 'Little Nap Recliners, with customisation' },
  'La-Z-Boy': { accent: '#00314A', tint: '#F0F5F8', line: 'Exclusive partner of La-Z-Boy in India' },
  'Smart Comfort': { accent: '#2F6F73', tint: '#F0F6F6', line: 'A Little Nap range' }
};
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
    const r = await fetch('/warehouse-policy.pdf');
    if (!r.ok) return null;
    brochureCache = await r.arrayBuffer();
    return brochureCache;
  } catch { return null; }
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(s);
}

const Stepper = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => (
  <div className="inline-flex items-center h-10 rounded-xl border border-slate-200 bg-white">
    <button type="button" aria-label="Decrease" className="w-10 h-10 flex items-center justify-center text-slate-700 disabled:opacity-30" disabled={value <= 1} onClick={() => onChange(Math.max(1, value - 1))}><Minus size={15} /></button>
    <span className="w-8 text-center text-sm font-bold">{value}</span>
    <button type="button" aria-label="Increase" className="w-10 h-10 flex items-center justify-center text-slate-700" onClick={() => onChange(value + 1)}><Plus size={15} /></button>
  </div>
);

const MeterInput = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => {
  const [txt, setTxt] = useState(String(value));
  useEffect(() => { if (parseFloat(txt) !== value) setTxt(String(value)); }, [value]);
  return (
    <div className="inline-flex items-center h-10 rounded-xl border border-slate-200 bg-white px-3 gap-1.5">
      <input inputMode="decimal" aria-label="Metres" className="w-14 text-sm font-bold text-center focus:outline-none" value={txt}
        onChange={e => {
          const t = e.target.value.replace(',', '.');
          if (!/^\d*\.?\d{0,2}$/.test(t)) return;
          setTxt(t);
          const n = parseFloat(t);
          if (n > 0) onChange(n);
        }}
        onBlur={() => { if (!(parseFloat(txt) > 0)) setTxt(String(value)); }} />
      <span className="text-xs text-slate-500">metres</span>
    </div>
  );
};

const DiscountInput = ({ value, onChange }: { value: { mode: 'pct' | 'amt'; value: number }; onChange: (d: { mode: 'pct' | 'amt'; value: number }) => void }) => (
  <div className="flex gap-2">
    <select className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm" value={value.mode} onChange={e => onChange({ ...value, mode: e.target.value as 'pct' | 'amt' })}>
      <option value="pct">%</option><option value="amt">Rs.</option>
    </select>
    <input className={field} type="number" min={0} placeholder="0" value={value.value || ''} onChange={e => onChange({ ...value, value: Math.max(0, Number(e.target.value) || 0) })} />
  </div>
);

interface Props { salesperson: Salesperson }

/** The stored logo can be 1600px wide, which made every PDF about 6 MB. 600px is plenty for a 50 mm logo. */
const shrinkImage = (src: string, maxW = 600): Promise<string> => new Promise(resolve => {
  const img = new Image();
  img.onload = () => {
    if (img.width <= maxW) return resolve(src);
    const c = document.createElement('canvas');
    c.width = maxW; c.height = Math.round(img.height * maxW / img.width);
    const ctx = c.getContext('2d');
    if (!ctx) return resolve(src);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    resolve(c.toDataURL('image/png'));
  };
  img.onerror = () => resolve(src);
  img.src = src;
});

export function QuotationWizard({ salesperson }: Props) {
  const [tab, setTab] = useState<'build' | 'history'>('build');
  const [price, setPrice] = useState<PriceListPayload | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [bank, setBank] = useState('');
  const [bankFor, setBankFor] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [lazboyLogo, setLazboyLogo] = useState<string | null>(null);

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
  const [site, setSite] = useState('');
  const [installation, setInstallation] = useState(0);
  const [advance, setAdvance] = useState(0);
  const [showBank, setShowBank] = useState(true);
  const [contactPhone, setContactPhone] = useState(() => { try { return salesperson.mobile || localStorage.getItem(`ln_contact_phone_${salesperson.id}`) || ''; } catch { return salesperson.mobile || ''; } });
  const [contactEmail, setContactEmail] = useState(() => { try { return salesperson.email || localStorage.getItem(`ln_contact_email_${salesperson.id}`) || ''; } catch { return ''; } });
  useEffect(() => { try { localStorage.setItem(`ln_contact_phone_${salesperson.id}`, contactPhone); localStorage.setItem(`ln_contact_email_${salesperson.id}`, contactEmail); } catch { /* ignore */ } }, [contactPhone, contactEmail, salesperson.id]);
  const [custGstin, setCustGstin] = useState('');
  const [discount, setDiscount] = useState(emptyDiscount());
  const [termsOverride, setTermsOverride] = useState<string[] | null>(null);
  const [gstRate, setGstRate] = useState(18);
  const [discMode, setDiscMode] = useState<'whole' | 'item'>('whole');
  const [freight, setFreight] = useState<{ mode: 'included' | 'extra'; amount: number }>({ mode: 'extra', amount: 0 });
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachPolicy, setAttachPolicy] = useState(true);
  const [linkedQuotation, setLinkedQuotation] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<{ number: string; docType: DocType } | null>(null);

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
        const banks = (await fetchBankDetails()).filter(x => x.showroomOrRegion.trim() && x.bankingDetails.trim());
        const norm = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        const sh = norm(salesperson.showroom || '');
        const rg = norm(salesperson.region || '');
        const k = (x: BankDetails) => norm(x.showroomOrRegion);
        // showroom first, then region; never fall back to another region's account
        const m = (sh ? banks.find(x => k(x) === sh) : undefined)
          || (rg ? banks.find(x => k(x) === rg) : undefined)
          || (sh ? banks.find(x => k(x).includes(sh) || sh.includes(k(x))) : undefined)
          || (rg ? banks.find(x => k(x).includes(rg) || rg.includes(k(x))) : undefined);
        setBank(m?.bankingDetails || '');
        setBankFor(m?.showroomOrRegion || '');
      } catch { /* bank details are only needed on the PI */ }
    })();
    (async () => {
      try {
        const r = await fetch('/assets/lazboy-logo.png');
        if (!r.ok) return;
        const blob = await r.blob();
        const fr = new FileReader();
        fr.onload = () => setLazboyLogo(String(fr.result));
        fr.readAsDataURL(blob);
      } catch { /* the La-Z-Boy logo is optional */ }
    })();
    (async () => {
      try {
        const saved = localStorage.getItem('little_nap_custom_logo');
        if (saved) return setLogo(await shrinkImage(saved));
        const r = await fetch('/api/logo');
        if (r.ok) { const d = await r.json(); if (d.base64) setLogo(await shrinkImage(d.base64)); }
      } catch { /* fall back to the logo bundled with the app */ }
      try {
        const r = await fetch('/assets/littlenap-logo.png');
        if (r.ok) { const blob = await r.blob(); const fr = new FileReader(); fr.onload = () => setLogo(cur => cur || String(fr.result)); fr.readAsDataURL(blob); }
      } catch { /* logo is optional */ }
    })();
  }, []);

  // changing brand clears items so brands can never mix
  const chooseBrand = (b: Brand) => {
    if (b === brand) return;
    if (lines.length && !window.confirm(`Changing to ${b} will remove the items already added. Continue?`)) return;
    setBrand(b);
    setLines([]);
    setTermsOverride(null);
    setFreight({ mode: BRAND_RULES[b].freightDefault, amount: 0 });
  };

  const brandRows = useMemo(() => (price?.rows || []).filter(r => allowedBrands(brand).includes(r.brand) && r.active), [price, brand]);
  const categories = useMemo(() => {
    const seen: string[] = [];
    brandRows.slice().sort((a, b) => a.order - b.order).forEach(r => { if (!seen.includes(r.category)) seen.push(r.category); });
    return seen;
  }, [brandRows]);

  // categories shown for the main item vs add-ons (Little Nap only)
  const ADDON_CATS = ['Upholstery', 'Accessories', 'Single Motor Controls', 'Dual Motor Controls', 'Three Motor Controls', 'Other Accessories', 'Veneer Arm', 'Surcharges & Rules'];
  const mainCats = categories.filter(c => !ADDON_CATS.includes(c));
  const addonCats = categories.filter(c => ADDON_CATS.includes(c));

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

  const groups: ItemGroup[] = useMemo(() => {
    const out: ItemGroup[] = [];
    brandRows.slice().sort((x, y) => x.order - y.order).filter(r => mainCats.includes(r.category)).forEach(r => {
      const key = `${r.category}|${r.item}`;
      let g = out.find(x => x.key === key);
      if (!g) { g = { key, item: r.item, category: r.category, rows: [] }; out.push(g); }
      g.rows.push(r);
    });
    return out;
  }, [brandRows, categories]);
  const makeGroups = (rows: PriceRow[]): ItemGroup[] => {
    const out: ItemGroup[] = [];
    rows.slice().sort((x, y) => x.order - y.order).forEach(r => {
      const key = `${r.category}|${r.item}`;
      let g = out.find(x => x.key === key);
      if (!g) { g = { key, item: r.item, category: r.category, rows: [] }; out.push(g); }
      g.rows.push(r);
    });
    return out;
  };
  const upholsteryGroups = useMemo(() => makeGroups(brandRows.filter(r => r.brand === 'Little Nap' && r.category === 'Upholstery')), [brandRows]);
  const addonGroups = useMemo(() => makeGroups(brandRows.filter(r => r.brand === 'Little Nap' && addonCats.includes(r.category) && r.category !== 'Upholstery')), [brandRows, categories]);

  const addPicked = (row: PriceRow) => setLines(l => [...l, rowToLine(row)]);

  const updateLine = (id: string, patch: Partial<QuoteLine>) => setLines(ls => ls.map(l => l.id === id ? { ...l, ...patch } : l));
  const updateOption = (lid: string, oid: string, patch: Partial<LineOption>) =>
    setLines(ls => ls.map(l => l.id === lid ? { ...l, options: l.options.map(o => o.id === oid ? { ...o, ...patch } : o) } : l));
  const addOption = (lid: string, r: PriceRow) => {
    setLines(ls => ls.map(l => l.id === lid ? { ...l, options: [...l.options, rowToOption(r)] } : l));
  };

  // Terms: Little Nap terms, plus the Smart Comfort terms when a Smart Comfort item is in the quotation
  const defaultTerms = useMemo(() => {
    const all = price?.terms || [];
    const out: string[] = [];
    const add = (b: string) => termsFor(all, b).forEach(t => { if (!out.includes(t)) out.push(t); });
    add(brand);
    return out;
  }, [price, brand]);
  const effectiveTerms = termsOverride ?? defaultTerms;

  const payload: QuotePayload = useMemo(() => {
    const customer = { site: site.trim(), gstin: custGstin.trim() };
    const hasCust = !!(customer.site || customer.gstin);
    const contact = { phone: contactPhone.trim(), email: contactEmail.trim() };
    return {
      v: 2, brand, docType,
      lines: lines.map(l => ({ ...l, specs: specFilled(l.specs).map(x => ({ label: x.label.trim(), value: x.value.trim() })) })),
      discount, freight, gstRate, terms: effectiveTerms.map(t => t.trim()).filter(Boolean),
      ...(hasCust ? { customer } : {}),
      ...(installation > 0 ? { installation } : {}),
      ...(advance > 0 ? { advance } : {}),
      showBank,
      ...(contact.phone || contact.email ? { contact } : {})
    };
  }, [brand, docType, lines, discount, freight, gstRate, effectiveTerms, site, custGstin, installation, advance, showBank, contactPhone, contactEmail]);
  const totals = useMemo(() => calcTotals(payload), [payload]);


  const stepError = (s: number): string => {
    if (s === 1) {
      if (!clientName.trim()) return 'Enter the client name.';
      if (mobile.replace(/\D/g, '').length < 10) return 'Enter a valid 10-digit mobile number.';
    }
    if (s === 2) {
      if (!lines.length) return 'Add at least one item.';
      const bad = lines.find(l => l.qty < 1);
      if (bad) return 'Every item needs a quantity of at least 1.';
    }
    if (s === 3 && !(gstRate >= 0 && gstRate <= 28)) return 'GST % must be between 0 and 28.';
    if (s === 3 && freight.mode === 'extra' && !(freight.amount > 0)) return 'Enter the freight amount, or choose "Included".';
    return '';
  };

  const next = () => { const e = stepError(step); if (e) return setError(e); setError(''); setStep(s => Math.min(4, s + 1)); };
  const back = () => { setError(''); setStep(s => Math.max(0, s - 1)); };

  const reset = () => {
    setStep(0); setDocType('Quotation'); setCompany(''); setClientName(''); setMobile(''); setEmail('');
    setBilling(''); setShipping(''); setSite(''); setCustGstin(''); setInstallation(0); setAdvance(0); setShowBank(true); setAttachPolicy(true); setLines([]); setDiscount(emptyDiscount()); setAttachments([]);
    setLinkedQuotation(''); setSaved(null); setError(''); setBrand('Little Nap'); setFreight({ mode: 'extra', amount: 0 }); setGstRate(18); setDiscMode('whole'); setTermsOverride(null);
  };

  const meta = (number: string): PdfMeta => ({
    number, linkedQuotation: docType === 'PI' ? linkedQuotation : undefined, date: todayStr(),
    clientName: company.trim() ? `${clientName.trim()} (${company.trim()})` : clientName.trim(),
    mobile: mobile.trim(), email: email.trim(),
    billing: billing.trim(), shipping: (sameAddr ? billing : shipping).trim(),
    salespersonName: salesperson.name, salespersonId: employeeNo.trim() || salesperson.id, bank,
    terms: effectiveTerms.map(t => t.trim()).filter(Boolean), logoBase64: logo, lazboyLogoBase64: brand === 'La-Z-Boy' ? lazboyLogo : null
  });

  const buildBytes = async (number: string): Promise<Uint8Array> => {
    const core = buildCorePdf(payload, meta(number));
    // Warehouse policy / brochure goes only on the PI
    const brochure = docType === 'PI' && attachPolicy ? await getBrochure() : null;
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
    setBrand(b); setLines(p.lines); setDiscount(p.discount); setFreight(p.freight); setGstRate(p.gstRate ?? 18); setTermsOverride(p.terms && p.terms.length ? p.terms : null); setDiscMode(p.lines.some(x => (x.discount?.value || 0) > 0) ? 'item' : 'whole');
    setClientName(r.clientName); setCompany(''); setMobile(String(r.mobileNumber || '')); setEmail(r.emailId || '');
    setBilling(r.billingAddress || ''); setShipping(r.shippingAddress || ''); setSameAddr(!r.shippingAddress || r.shippingAddress === r.billingAddress);
    setSite(p.customer?.site || ''); setCustGstin(p.customer?.gstin || ''); setInstallation(p.installation || 0); setAdvance(p.advance || 0); setShowBank(p.showBank !== false);
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
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${i < step ? 'bg-slate-900 text-white' : i === step ? 'bg-[#9B7C50] text-white ring-4 ring-[#9B7C50]/20' : 'bg-slate-100 text-slate-400'}`}>
                        {i < step ? <Check size={14} /> : i + 1}
                      </div>
                      <span className={`hidden sm:block text-xs font-bold ${i === step ? 'text-slate-900' : 'text-slate-400'}`}>{s}</span>
                    </div>
                    {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-3 ${i < step ? 'bg-slate-900' : 'bg-slate-200'}`} />}
                  </React.Fragment>
                ))}
              </div>

              <div key={step} className="step-in">
              <div className="mb-5">
                <h2 className="text-2xl font-semibold tracking-tight">{docType === 'PI' && step === 4 ? 'Proforma Invoice' : STEP_HELP[step][0]}</h2>
                <p className="text-sm text-slate-500 mt-1">{STEP_HELP[step][1]}</p>
              </div>

              {docType === 'PI' && (
                <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  Converting <b>{linkedQuotation}</b> to a Proforma Invoice. The warehouse policy is attached automatically.
                </div>
              )}

              {step === 0 && (
                <div>
                  <div className="grid sm:grid-cols-3 gap-4">
                    {QUOTE_BRANDS.map(b => {
                      const look = BRAND_LOOK[b] || BRAND_LOOK['Little Nap'];
                      const on = brand === b;
                      const rules = BRAND_RULES[b];
                      return (
                        <button key={b} onClick={() => chooseBrand(b)} disabled={docType === 'PI'} aria-pressed={on}
                          className="group relative flex flex-col h-full text-left rounded-xl bg-white overflow-hidden border transition-shadow hover:shadow-md disabled:opacity-60 disabled:hover:shadow-none"
                          style={{ borderColor: on ? look.accent : '#E2E8F0', boxShadow: on ? `0 0 0 1px ${look.accent}` : undefined }}>
                          <div className="h-1.5 shrink-0" style={{ background: look.accent }} />
                          <div className="h-24 shrink-0 flex items-center justify-center px-6" style={{ background: look.tint }}>
                            {b === 'La-Z-Boy' ? (
                              <img src="/assets/lazboy-logo.png" alt="La-Z-Boy" className="max-h-12 w-auto" />
                            ) : b === 'Little Nap' ? (
                              <img src="/assets/littlenap-logo.png" alt="Little Nap" className="max-h-16 w-auto" />
                            ) : (
                              <div className="flex items-center gap-4">
                                <img src="/assets/littlenap-logo.png" alt="Little Nap" className="h-14 w-auto" />
                                <span className="w-px h-10 bg-slate-300" />
                                <span className="text-lg font-bold leading-tight" style={{ color: look.accent }}>Smart<br />Comfort</span>
                              </div>
                            )}
                          </div>
                          {on && (
                            <span className="absolute top-4 right-3 w-6 h-6 rounded-md flex items-center justify-center text-white" style={{ background: look.accent }}><Check size={15} /></span>
                          )}
                          <div className="p-5">
                            <div className="font-bold text-lg text-slate-900">{b === 'Smart Comfort' ? 'Smart Comfort Range' : b}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{look.line}</div>
                            <ul className="mt-4 space-y-2.5 text-sm text-slate-700">
                              <li className="flex items-center gap-2.5"><SlidersHorizontal size={16} style={{ color: look.accent }} />{rules.customisation ? 'Fully customisable' : 'No customisation'}</li>
                              <li className="flex items-center gap-2.5"><Truck size={16} style={{ color: look.accent }} />{rules.freightDefault === 'included' ? 'Freight included' : 'Freight extra, on actual'}</li>
                              <li className="flex items-center gap-2.5"><Receipt size={16} style={{ color: look.accent }} />GST included in prices</li>
                            </ul>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {docType === 'PI' && <p className="mt-3 text-xs text-slate-500">The brand is fixed because this Proforma Invoice comes from a quotation.</p>}
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
                    <div className="sm:col-span-2 text-sm font-semibold text-slate-900">More details <span className="font-normal text-slate-400">(optional, shown only if filled)</span></div>
                    <div><label className={label}>Site / project</label><input className={field} value={site} onChange={e => setSite(e.target.value)} /></div>
                    <div><label className={label}>Customer GSTIN</label><input className={field} value={custGstin} onChange={e => setCustGstin(e.target.value)} /></div>
                  </div>
                  <div className="sm:col-span-2 border-t border-slate-100 pt-4 grid sm:grid-cols-2 gap-4">
                    <div><label className={label}>Prepared by</label><input className={`${field} bg-slate-50`} value={salesperson.name} readOnly /></div>
                    <div><label className={label}>Employee ID</label><input className={field} value={employeeNo} onChange={e => setEmployeeNo(e.target.value)} /></div>
                    <div><label className={label}>Your contact number</label><input className={field} inputMode="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="Shown in the header, optional" /></div>
                    <div><label className={label}>Your email</label><input className={field} type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="Shown in the header, optional" /></div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <ItemPicker groups={groups} title="Choose a model" variantTitle="Choose seats and type" buttonLabel={lines.length ? 'Add another item' : 'Add item'} onPick={addPicked} />

                  {!lines.length && <p className="text-sm text-slate-500 text-center py-6">Tap "Add item", then pick the model and its seats and type. The price comes from the price list.</p>}

                  {lines.map((l, idx) => {
                    const lt = totals.lines[idx];
                    const upholsteries = l.options.filter(o => o.category === 'Upholstery');
                    const addons = l.options.filter(o => o.category !== 'Upholstery');
                    const optionRow = (o: LineOption) => (
                      <div key={o.id} className="flex items-center justify-between gap-3 py-2.5 border-t border-slate-100">
                        <div className="min-w-0 text-sm">
                          <div className="font-medium">{o.item}{o.variant && !['Per seat', 'Per piece'].includes(o.variant) ? <span className="text-slate-500 font-normal"> · {o.variant}</span> : null}</div>
                          <div className="text-xs text-slate-500">{fmt0(o.unitPrice)} {isMetreOption(o) ? 'per metre' : o.category === 'Upholstery' ? 'per seat or metre' : 'each'}</div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {(isMetreOption(o) || o.category === 'Upholstery')
                            ? <MeterInput value={o.qty} onChange={v => updateOption(l.id, o.id, { qty: v })} />
                            : <Stepper value={o.qty} onChange={v => updateOption(l.id, o.id, { qty: v })} />}
                          <button className="text-red-600" aria-label="Remove" onClick={() => setLines(ls => ls.map(x => x.id === l.id ? { ...x, options: x.options.filter(y => y.id !== o.id) } : x))}><Trash2 size={17} /></button>
                        </div>
                      </div>
                    );
                    return (
                      <div key={l.id} className={card}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white" style={{ background: GOLD }}>{idx + 1}</span>
                              <span className="text-sm text-slate-500">{l.category}</span>
                            </div>
                            <div className="text-base font-bold mt-0.5">{l.item}</div>
                            {variantLabel(l.variant) && <div className="text-sm text-slate-500">{l.variant}</div>}
                          </div>
                          <button className="text-red-600 p-1" aria-label="Remove item" onClick={() => setLines(ls => ls.filter(x => x.id !== l.id))}><Trash2 size={19} /></button>
                        </div>

                        <div className="flex items-center justify-between mt-4">
                          <div><div className={label}>Price each (incl. GST)</div><div className="text-sm font-bold">{formatINR(l.unitPrice)}</div></div>
                          <div><div className={label}>Quantity</div><Stepper value={l.qty} onChange={v => updateLine(l.id, { qty: v })} /></div>
                        </div>

                        <div className="mt-5"><SpecEditor specs={l.specs || []} onChange={sp => updateLine(l.id, { specs: sp })} /></div>

                        {BRAND_RULES[l.brand].customisation && (
                          <div className="mt-5 space-y-5">
                            <div>
                              <div className="text-sm font-semibold text-slate-900 mb-1">Upholstery <span className="font-normal text-slate-400">(seats, or metres such as 1.7)</span></div>
                              {upholsteries.map(optionRow)}
                              <div className="mt-2"><ItemPicker groups={upholsteryGroups} title="Add upholstery" variantTitle="Choose an option" buttonLabel="Add upholstery (leather, fabric…)" onPick={r => addOption(l.id, r)} className={ADD_BTN} /></div>
                            </div>
                            <div>
                              <div className="text-sm font-semibold text-slate-900 mb-1">Add-ons</div>
                              {addons.map(optionRow)}
                              <div className="mt-2"><ItemPicker groups={addonGroups} title="Add an add-on" variantTitle="Choose an option" buttonLabel="Add add-on (motor, switch, veneer…)" onPick={r => addOption(l.id, r)} className={ADD_BTN} /></div>
                            </div>
                          </div>
                        )}

                        <div className="mt-5 pt-4 border-t border-slate-100 flex justify-between items-center">
                          <span className="text-sm font-medium text-slate-600">Item total</span>
                          <span className="text-base font-bold">{formatINR(lt.gross)}</span>
                        </div>
                      </div>
                    );
                  })}

                  {lines.length > 0 && (
                    <ItemPicker groups={groups} title="Choose a model" variantTitle="Choose seats and type" buttonLabel="Add another item" onPick={addPicked}
                      className="inline-flex items-center justify-center gap-2 h-12 w-full rounded-xl border border-slate-200 bg-white text-slate-800 px-6 text-sm font-bold hover:border-slate-400" />
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <div className={card}>
                    <h3 className="font-bold mb-3 text-sm">Discount</h3>
                    <div className="grid grid-cols-2 border border-slate-200 rounded-xl overflow-hidden mb-4 text-sm font-bold">
                      {([['whole', 'Whole quotation'], ['item', 'Each item']] as const).map(([k, t]) => (
                        <button key={k} type="button" onClick={() => {
                          if (k === discMode) return;
                          setDiscMode(k);
                          if (k === 'whole') setLines(ls => ls.map(x => ({ ...x, discount: emptyDiscount() })));
                          else setDiscount(emptyDiscount());
                        }} className={`h-11 ${discMode === k ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>{t}</button>
                      ))}
                    </div>
                    {discMode === 'whole' ? (
                      <DiscountInput value={discount} onChange={setDiscount} />
                    ) : (
                      <div className="space-y-4">
                        {lines.map((l, i) => (
                          <div key={l.id}>
                            <div className="text-sm font-semibold mb-1.5">{i + 1}. {l.item}{variantLabel(l.variant) ? ` · ${l.variant}` : ''} <span className="text-slate-400 font-normal">({formatINR(totals.lines[i].gross)})</span></div>
                            <DiscountInput value={l.discount} onChange={d => updateLine(l.id, { discount: d })} />
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-slate-500 mt-3">Prices come from the price list and cannot be edited. Use the discount instead.</p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-5">
                    <div className={card}>
                      <h3 className="font-bold mb-3 text-sm">GST</h3>
                      <label className={label}>GST %</label>
                      <input className={field} type="number" min={0} max={28} step="0.5" value={gstRate} onChange={e => setGstRate(Number(e.target.value))} />
                      <p className="text-xs text-slate-500 mt-3">Prices already include GST. This sets how much of the total is shown as GST. Default is 18%.</p>
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
                    <div className={card}>
                      <h3 className="font-bold mb-3 text-sm">Installation and advance <span className="font-normal text-slate-400">(optional)</span></h3>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div><label className={label}>Installation charge (Rs.)</label>
                          <input className={field} type="number" min={0} value={installation || ''} onChange={e => setInstallation(Math.max(0, Number(e.target.value) || 0))} /></div>
                        <div><label className={label}>Advance received (Rs.)</label>
                          <input className={field} type="number" min={0} value={advance || ''} onChange={e => setAdvance(Math.max(0, Number(e.target.value) || 0))} /></div>
                      </div>
                      <p className="text-xs text-slate-500 mt-3">Leave blank to hide these rows. Installation is added to the grand total; advance shows the balance due.</p>
                    </div>
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
                        <div className="text-right whitespace-nowrap"><div className="font-semibold">{formatINR(totals.lines[i].net)}</div>{totals.lines[i].discount > 0 && <div className="text-xs text-slate-500">after discount - {formatINR(totals.lines[i].discount)}</div>}</div>
                      </div>
                    ))}
                    <div className="p-5 text-sm space-y-1.5 bg-slate-50">
                      <div className="flex justify-between"><span>Sub total</span><span>{formatINR(totals.subtotal)}</span></div>
                      {totals.overallDiscount > 0 && <div className="flex justify-between"><span>Discount</span><span>- {formatINR(totals.overallDiscount)}</span></div>}
                      <div className="flex justify-between"><span>Taxable value (excl. GST)</span><span>{formatINR(totals.taxableExGst)}</span></div>
                      <div className="flex justify-between text-slate-500"><span>GST @ {totals.gstRate}% (included)</span><span>{formatINR(totals.gstIncluded)}</span></div>
                      <div className="flex justify-between"><span>Freight</span><span>{freight.mode === 'extra' ? formatINR(totals.freightExtra) : 'Included'}</span></div>
                      {totals.installation > 0 && <div className="flex justify-between"><span>Installation</span><span>{formatINR(totals.installation)}</span></div>}
                      <div className="flex justify-between items-baseline font-semibold pt-3 mt-1 border-t border-slate-200"><span className="text-base">Grand total</span><span className="text-2xl tabular-nums">{formatINR(totals.grandTotal)}</span></div>
                      {totals.advance > 0 && <div className="flex justify-between pt-2"><span>Advance received</span><span>{formatINR(totals.advance)}</span></div>}
                      {totals.advance > 0 && <div className="flex justify-between font-semibold"><span>Balance due</span><span>{formatINR(totals.balance)}</span></div>}
                    </div>
                  </div>

                  <div className={card}>
                    <h3 className="font-bold text-sm mb-2">Bank details{bankFor ? <span className="font-normal text-slate-500"> · {bankFor}</span> : null}</h3>
                    <label className="flex items-center gap-2 text-sm mb-2"><input type="checkbox" checked={showBank} onChange={e => setShowBank(e.target.checked)} /> Show bank details on the document</label>
                    {!showBank ? <p className="text-sm text-slate-500">Bank details will not be printed.</p> : bank ? <p className="text-sm text-slate-700 whitespace-pre-line">{bank}</p> : <p className="text-sm text-red-700">No bank details were found for {salesperson.region || salesperson.showroom || 'your region'}. Add a row for it in the bank details tab of the sheet.</p>}
                  </div>

                  <div className={card}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-sm">Terms and conditions</h3>
                      {termsOverride && <button className="text-xs font-semibold underline text-slate-600" onClick={() => setTermsOverride(null)}>Reset to default</button>}
                    </div>
                    <div className="space-y-3">
                      {effectiveTerms.map((t, i) => (
                        <div key={i} className="flex gap-2 items-start">
                          <span className="text-xs font-bold text-slate-400 pt-3.5 w-5 shrink-0">{i + 1}.</span>
                          <textarea className={`${area} flex-1`} rows={Math.max(2, Math.ceil(t.length / 42))} value={t}
                            onChange={e => setTermsOverride(effectiveTerms.map((x, j) => j === i ? e.target.value : x))} />
                          <button className="text-red-600 pt-3" aria-label="Remove term" onClick={() => setTermsOverride(effectiveTerms.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
                        </div>
                      ))}
                    </div>
                    <button className={`${btnGhost} !h-10 mt-3`} onClick={() => setTermsOverride([...effectiveTerms, ''])}><Plus size={15} /> Add a term</button>
                  </div>

                  {docType === 'PI' && (
                    <div className={card}>
                      <h3 className="font-bold text-sm mb-1">Attach other documents</h3>
                      <label className="flex items-center gap-2 text-sm mb-3"><input type="checkbox" checked={attachPolicy} onChange={e => setAttachPolicy(e.target.checked)} /> Attach the Warehouse Storage &amp; Dispatch Policy</label>
                      <p className="text-xs text-slate-500 mb-3">Add more PDFs or images from this device, Drive or Files. They are added after the policy.</p>
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

              </div>

              <div className="sticky bottom-0 z-30 mt-8 -mx-1 px-1 py-3 bg-white/95 backdrop-blur border-t border-slate-200">
                <div className="flex items-center gap-3">
                  <button className={btnGhost} onClick={back} disabled={step === 0 || saving}><ArrowLeft size={16} /> Back</button>
                  <div className="flex-1 min-w-0 text-right">
                    {lines.length > 0 && step >= 2 && (
                      <>
                        <div className="text-xs text-slate-500">{lines.length} item{lines.length > 1 ? 's' : ''}</div>
                        <div className="text-base font-semibold truncate tabular-nums">{formatINR(totals.grandTotal)}</div>
                      </>
                    )}
                  </div>
                  {step < 4
                    ? <button className={btnPrimary} onClick={next}>Next <ArrowRight size={16} /></button>
                    : <button className={btnPrimary} onClick={save} disabled={saving}>
                        {saving ? 'Saving…' : docType === 'PI' ? <><Check size={16} /> Save invoice</> : <><Download size={16} /> Save quotation</>}
                      </button>}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
