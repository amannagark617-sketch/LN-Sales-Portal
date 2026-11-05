import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, X, AlertTriangle, Package } from 'lucide-react';
import { fetchReadyStock } from '../services/dataService';
import type { StockItem, StockPayload, StockTab } from '../stock/stock';

const GOLD = '#9B7C50';
const STALE_AFTER_MIN = 3;

const TABS: { key: StockTab; label: string; blurb: string }[] = [
  { key: 'littlenap', label: 'Little Nap', blurb: 'Recliners ready in our factory' },
  { key: 'lazboy', label: 'La-Z-Boy', blurb: 'Imported La-Z-Boy at Manesar' },
  { key: 'motion', label: 'Motion Sofas', blurb: 'Linea and Pulse motion sofas' }
];

const normQuery = (s: string) => s.toLowerCase().replace(/motorized/g, 'motorised').replace(/\s+/g, ' ').trim();

interface Group { model: string; items: StockItem[]; qty: number; image: string }

/** Same picture, asked from Google at a smaller size, so cards load fast and use little data. */
const sized = (url: string, w: number) => url.replace(/(sz=w|=w)\d+/, '$1' + w);

function PieceImage({ src, name, className, width = 400 }: { src: string; name: string; className?: string; width?: number }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) {
    return <div className={`${className} bg-slate-50 flex items-center justify-center text-slate-300`}><span className="text-3xl font-light" style={{ color: GOLD }}>{name.charAt(0)}</span></div>;
  }
  return <img src={sized(src, width)} alt={name} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBad(true)} className={`${className} object-cover bg-slate-50`} />;
}

// Kept for as long as the app stays open, so moving between tabs never reads the sheet again.
// Closing and reopening the app starts empty and loads fresh data.
let stockStore: StockPayload | null = null;

export function ReadyStock({ salespersonName }: { salespersonName: string }) {
  const [data, setData] = useState<StockPayload | null>(stockStore);
  const [loading, setLoading] = useState(!stockStore);
  const [err, setErr] = useState('');
  const [now, setNow] = useState(Date.now());
  const [tab, setTab] = useState<StockTab>('littlenap');
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [material, setMaterial] = useState('');
  const [sort, setSort] = useState<'stock' | 'az'>('stock');
  const [open, setOpen] = useState<Group | null>(null);
  const [viewer, setViewer] = useState<{ id: string; title: string } | null>(null);

  const load = useCallback(async (force: boolean) => {
    setLoading(true); setErr('');
    try { const d = await fetchReadyStock(force); stockStore = d; setData(d); } catch (e: any) { setErr(e.message || 'Could not load the stock'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (!stockStore) load(false); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  useEffect(() => { setKind(''); setMaterial(''); setQ(''); }, [tab]);

  const minutesOld = data ? Math.floor((now - data.loadedAt) / 60000) : 0;
  const stale = !!data && minutesOld >= STALE_AFTER_MIN;
  const ageText = !data ? '' : minutesOld < 1 ? 'just now' : `${minutesOld} min ago`;
  const clock = data ? new Date(data.loadedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';

  const tabData = data?.tabs[tab];
  const items = tabData?.items || [];
  const kinds = useMemo(() => [...new Set(items.map(i => i.kind).filter(Boolean))], [items]);
  const materials = useMemo(() => [...new Set(items.map(i => i.material).filter(Boolean))].slice(0, 5), [items]);

  const groups: Group[] = useMemo(() => {
    const tokens = normQuery(q).split(' ').filter(Boolean);
    const filtered = items.filter(i => {
      if (kind && i.kind !== kind) return false;
      if (material && i.material !== material) return false;
      if (!tokens.length) return true;
      const hay = normQuery([i.model, i.title, i.functionality, i.upholstery, i.shade, i.code, i.details.join(' '), i.note, i.material].join(' '));
      return tokens.every(t => hay.includes(t));
    });
    const m = new Map<string, StockItem[]>();
    filtered.forEach(i => m.set(i.model, [...(m.get(i.model) || []), i]));
    const out = [...m.entries()].map(([model, its]) => ({ model, items: its, qty: its.reduce((s, x) => s + x.qty, 0), image: its.find(x => x.image)?.image || '' }));
    out.sort((a, b) => sort === 'az' ? a.model.localeCompare(b.model) : b.qty - a.qty || a.model.localeCompare(b.model));
    return out;
  }, [items, q, kind, material, sort]);

  const total = (t: StockTab) => (data?.tabs[t].items || []).reduce((s, x) => s + x.qty, 0);
  const firstName = salespersonName.split(' ')[0];
  const seg = (active: boolean) => `h-10 px-4 text-sm font-semibold border ${active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'}`;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Refresh notice: impossible to miss */}
      <div className={`rounded-xl border-2 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 ${stale || err ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'}`}>
        <div className="flex gap-3 flex-1">
          <AlertTriangle className={`shrink-0 mt-0.5 ${stale || err ? 'text-red-600' : 'text-amber-600'}`} size={24} />
          <div>
            <div className="text-base sm:text-lg font-bold text-slate-900">Refresh before you check the stock</div>
            <p className="text-sm text-slate-700 mt-1">
              Pieces get sold through the day. Press Refresh first, so you never promise a customer a piece that has already gone.
            </p>
            {data && (
              <p className={`text-sm font-semibold mt-2 ${stale ? 'text-red-700' : 'text-slate-600'}`}>
                {stale ? `This list is ${minutesOld} minutes old. Refresh now.` : `Last refreshed at ${clock} (${ageText}).`}
              </p>
            )}
          </div>
        </div>
        <button onClick={() => load(true)} disabled={loading}
          className={`h-14 px-8 rounded-xl bg-slate-900 text-white text-base font-bold flex items-center justify-center gap-3 shrink-0 hover:bg-slate-800 disabled:opacity-60 ${stale && !loading ? 'ring-4 ring-red-300' : 'ring-4 ring-amber-200'}`}>
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Refreshing…' : 'Refresh stock'}
        </button>
      </div>

      {err && <div className="text-sm text-red-700 border border-red-200 bg-white rounded-xl p-4">{err}</div>}

      <div>
        <h2 className="text-2xl font-bold text-slate-900">Ready to deliver, {firstName}</h2>
        <p className="text-slate-600 mt-1">Ready pieces skip the factory queue, so you can promise your customer a quick delivery. Find what they want below.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`text-left rounded-xl border p-4 ${tab === t.key ? 'border-slate-900 bg-white shadow-md' : 'border-slate-200 bg-white hover:border-slate-400'}`}
            style={tab === t.key ? { borderTopWidth: 4, borderTopColor: GOLD } : undefined}>
            <div className="text-base font-bold text-slate-900">{t.label}</div>
            <div className="text-xs text-slate-500 mt-0.5">{t.blurb}</div>
            <div className="mt-3 text-sm text-slate-700">
              {data ? <><span className="text-2xl font-bold text-slate-900">{total(t.key)}</span> pieces ready</> : '…'}
            </div>
          </button>
        ))}
      </div>

      {tabData?.error && <div className="text-sm text-red-700 border border-red-200 bg-white rounded-xl p-4">{tabData.error}</div>}

      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="What is your customer looking for? Try “leather motorised”, a model or a colour"
            className="w-full h-14 rounded-xl border border-slate-200 pl-12 pr-4 text-base placeholder:text-slate-400 focus:outline-none focus:border-slate-900" />
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3 items-center">
          {kinds.length > 1 && (
            <div className="flex">
              <button className={`${seg(!kind)} rounded-l-xl`} onClick={() => setKind('')}>All</button>
              {kinds.map((k, i) => <button key={k} className={`${seg(kind === k)} border-l-0 ${i === kinds.length - 1 ? 'rounded-r-xl' : ''}`} onClick={() => setKind(k)}>{k}</button>)}
            </div>
          )}
          {materials.length > 1 && (
            <div className="flex">
              <button className={`${seg(!material)} rounded-l-xl`} onClick={() => setMaterial('')}>Any cover</button>
              {materials.map((k, i) => <button key={k} className={`${seg(material === k)} border-l-0 ${i === materials.length - 1 ? 'rounded-r-xl' : ''}`} onClick={() => setMaterial(k)}>{k}</button>)}
            </div>
          )}
          <select value={sort} onChange={e => setSort(e.target.value as 'stock' | 'az')} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 sm:ml-auto">
            <option value="stock">Most pieces first</option>
            <option value="az">Model A to Z</option>
          </select>
        </div>
      </div>

      {loading && !data && <div className="text-center text-slate-500 py-16">Loading the stock…</div>}

      {data && !groups.length && !tabData?.error && (
        <div className="text-center py-16 text-slate-500">
          <Package className="mx-auto mb-3 text-slate-300" size={40} />
          {items.length ? 'Nothing matches this search. Clear a filter or try another word.' : 'No ready pieces in this list right now.'}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {groups.map(g => {
          const last = g.qty === 1;
          return (
            <button key={g.model} onClick={() => setOpen(g)} className="text-left bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-400 hover:shadow-md transition">
              <div className="relative">
                <PieceImage src={g.image} name={g.model} className="w-full aspect-[4/3]" />
                {last && <div className="absolute top-2 left-2 bg-amber-600 text-white text-[11px] font-bold px-2 py-1 rounded-md">Last piece</div>}
              </div>
              <div className="p-3 sm:p-4">
                <div className="text-base font-bold text-slate-900 leading-tight">{g.model}</div>
                <div className="text-sm text-slate-500 mt-1">{g.items.length} {g.items.length === 1 ? 'finish' : 'finishes'}</div>
                <div className="mt-3 text-sm"><span className="text-xl font-bold text-slate-900">{g.qty}</span> <span className="text-slate-600">ready</span></div>
                {g.items.some(x => x.note) && (
                  <div className="mt-2 text-xs font-semibold text-red-700 border-l-2 border-red-400 pl-2">
                    {g.items.filter(x => x.note).slice(0, 2).map(x => <div key={x.id}>{x.note}</div>)}
                    {g.items.filter(x => x.note).length > 2 && <div>+{g.items.filter(x => x.note).length - 2} more remarks</div>}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {viewer && (
        <div className="fixed inset-0 z-[60] bg-white flex flex-col">
          <div className="flex items-center justify-between gap-3 p-3 border-b border-slate-200">
            <div className="min-w-0 text-sm font-bold text-slate-900 truncate">{viewer.title}</div>
            <div className="flex items-center gap-2 shrink-0">
              <a href={`https://drive.google.com/file/d/${viewer.id}/view`} target="_blank" rel="noreferrer" className="h-10 px-3 rounded-xl border border-slate-300 text-sm font-bold text-slate-800 flex items-center">Open in Drive</a>
              <button aria-label="Close" onClick={() => setViewer(null)} className="h-10 w-10 flex items-center justify-center text-slate-600 hover:text-slate-900"><X size={22} /></button>
            </div>
          </div>
          <iframe title="Details" src={`https://drive.google.com/file/d/${viewer.id}/preview`} className="flex-1 w-full border-0" allow="autoplay" />
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-6" onClick={() => setOpen(null)}>
          <div className="bg-white w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-100 p-5 flex items-start justify-between">
              <div>
                <div className="text-xl font-bold text-slate-900">{open.model}</div>
                <div className="text-sm text-slate-600">{open.qty} ready to deliver · {TABS.find(t => t.key === tab)?.label}</div>
              </div>
              <button aria-label="Close" onClick={() => setOpen(null)} className="p-2 text-slate-500 hover:text-slate-900"><X size={22} /></button>
            </div>
            <div className="p-5 space-y-5">
              {open.items.map(i => (
                <div key={i.id} className="flex gap-4 border border-slate-100 rounded-xl p-3">
                  {i.image
                    ? <a href={i.image.replace(/(sz=w|=w)\d+/, '$1' + '1600')} target="_blank" rel="noreferrer" className="shrink-0"><PieceImage src={i.image} name={i.model} width={600} className="w-28 h-28 sm:w-36 sm:h-36 rounded-lg" /></a>
                    : <PieceImage src="" name={i.model} className="w-28 h-28 sm:w-36 sm:h-36 rounded-lg shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-bold text-slate-900">{i.title}</div>
                    <div className="text-sm text-slate-700 mt-1">
                      {[i.upholstery, i.shade].filter(Boolean).join(' · ')}
                    </div>
                    {i.details.map((d, k) => <div key={k} className="text-xs text-slate-500 mt-1">{d}</div>)}
                    {i.code && <div className="text-xs text-slate-400 mt-1">{i.code}</div>}
                    {i.fileId && (
                      <button onClick={() => setViewer({ id: i.fileId, title: `${i.model} · ${[i.upholstery, i.shade].filter(Boolean).join(' · ')}` })}
                        className="mt-3 h-10 px-4 rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-800 hover:border-slate-900">
                        View all pages and details
                      </button>
                    )}
                    <div className="mt-3 flex items-center gap-3 flex-wrap">
                      <span className="text-sm"><span className="text-xl font-bold text-slate-900">{i.qty}</span> ready</span>
                      {i.qty === 1 && <span className="text-xs font-bold text-amber-700">Last piece</span>}
                    </div>
                    {i.note && <div className="mt-2 text-sm font-semibold text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{i.note}</div>}
                  </div>
                </div>
              ))}
              <p className="text-xs text-slate-500">Before you promise this piece, press Refresh stock on the main page to be sure it is still available.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
