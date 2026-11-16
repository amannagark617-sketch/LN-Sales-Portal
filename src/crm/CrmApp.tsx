import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, ListChecks, Users, Plus, SlidersHorizontal, X, Search, ChevronDown, Check } from 'lucide-react';
import { fetchCrm, crmAction, CrmData } from './api';
import { Lead, normStage, plannedOf, isOverdue, isDueToday, stepLabel, STAGES } from './constants';
import { LeadRow, Combo, opts, StageDot, btnPrimary, btnGhost, todayStr, addDays, fullName } from './ui';
import { LeadPanel } from './LeadPanel';
import { AddEnquiry } from './AddEnquiry';

const TODAY_VIEWS = ['todo', 'overdue', 'meetings', 'sales', 'team', 'waiting'];
const ARCHIVE = ['Closed', 'Lost', 'Invalid'];
const PAGE = 20;

interface NavItem { id: string; label: string; count: number; dot?: string; alert?: boolean }
interface NavGroup { title: string; items: NavItem[] }

function NavList({ groups, value, onPick }: { groups: NavGroup[]; value: string; onPick: (id: string) => void }) {
  return (
    <nav aria-label="Lead views">
      {groups.map(g => (
        <div key={g.title} className="mb-4 last:mb-0">
          <div className="px-2.5 mb-1 text-xs font-bold text-slate-400">{g.title}</div>
          {g.items.map(it => {
            const on = it.id === value;
            return (
              <button key={it.id} onClick={() => onPick(it.id)} aria-current={on ? 'page' : undefined}
                className={`w-full h-10 lg:h-8 px-2.5 rounded-md flex items-center gap-2 text-sm text-left ${on ? 'bg-teal-100/70 text-teal-900 font-bold' : 'text-slate-700 font-medium hover:bg-slate-100'}`}>
                {it.dot && <StageDot name={it.dot} />}
                <span className="flex-1 truncate">{it.label}</span>
                <span className={`text-xs tabular-nums font-bold ${it.count === 0 ? 'text-slate-300' : it.alert ? 'text-rose-700' : on ? 'text-teal-800' : 'text-slate-500'}`}>{it.count}</span>
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <span className={`h-6 w-11 rounded-md relative shrink-0 transition-colors ${on ? 'bg-teal-700' : 'bg-slate-300'}`} aria-hidden>
      <span className={`absolute top-0.5 h-5 w-5 rounded-[4px] bg-white transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </span>
  );
}

/** Where side panes should stick (just under the portal's sticky header) and how tall they may be. */
function usePaneMetrics(ready: boolean) {
  const root = useRef<HTMLDivElement>(null);
  const [m, setM] = useState({ top: 12, start: 12 });
  useEffect(() => {
    const calc = () => {
      const h = document.querySelector('header');
      const cs = h ? getComputedStyle(h) : null;
      const top = h && cs && cs.position === 'sticky' ? Math.round(h.getBoundingClientRect().height + (parseFloat(cs.top) || 0) + 12) : 12;
      const start = root.current ? Math.round(root.current.getBoundingClientRect().top + window.scrollY) : top;
      setM(p => (p.top === top && p.start === start ? p : { top, start }));
    };
    calc();
    const h = document.querySelector('header');
    const ro = new ResizeObserver(calc);
    if (h) ro.observe(h);
    window.addEventListener('resize', calc);
    return () => { ro.disconnect(); window.removeEventListener('resize', calc); };
  }, [ready]);
  return { root, top: m.top, max: `calc(100vh - ${Math.max(m.top, m.start) + 12}px)` };
}

export function CrmApp({ onQuote }: { onQuote?: (lead: Lead, reuse?: { no: string; asPI: boolean }) => void }) {
  const [data, setData] = useState<CrmData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('todo');
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [fNbd, setFNbd] = useState('');
  const [fSales, setFSales] = useState('');
  const [fSource, setFSource] = useState('');
  const [fKind, setFKind] = useState('');
  const [fAge, setFAge] = useState('');
  const [fMine, setFMine] = useState(false);
  const [fLate, setFLate] = useState(false);
  const [sort, setSort] = useState<'due' | 'new' | 'old'>('due');
  const [showFilters, setShowFilters] = useState(false);
  const [picker, setPicker] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [stamp, setStamp] = useState<Date | null>(null);
  const [availBusy, setAvailBusy] = useState(false);
  const loadedAt = useRef(0);

  const load = useCallback(async (refresh = false) => {
    setLoading(true); setError('');
    try {
      const d = await fetchCrm(refresh);
      d.leads.forEach(l => { l.stage = normStage(l.stage); });
      setData(d); loadedAt.current = Date.now(); setStamp(new Date());
    }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible' && Date.now() - loadedAt.current > 60000) load(true); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [load]);

  const today = todayStr();
  const me = data?.me;
  const pane = usePaneMetrics(!!data);
  const lead = useMemo(() => data?.leads.find(l => l.enquiryNo === selected) || null, [data, selected]);

  const pool = useMemo(() => {
    if (!data || !me) return [];
    const s = q.trim().toLowerCase();
    const since = fAge === 'today' ? today : fAge === '7' ? addDays(-7) : fAge === '30' ? addDays(-30) : '';
    return data.leads.filter(l =>
      (!fNbd || l.nbdId === fNbd) && (!fSales || l.salesId === fSales) && (!fSource || l.source === fSource) &&
      (!fKind || (fKind === 'Self generated') === (l.group === 'Direct')) &&
      (!since || (l.createdAt || '').slice(0, 10) >= since) &&
      (!fMine || l.ownerId === me.id) && (!fLate || (l.outcome === 'Open' && isOverdue(l))) &&
      (!s || [fullName(l), l.phone, l.enquiryNo, l.city, l.company, l.email, l.requirement].join(' ').toLowerCase().includes(s))
    );
  }, [data, me, q, fNbd, fSales, fSource, fKind, fAge, fMine, fLate, today]);

  const lists = useMemo(() => {
    const out: Record<string, Lead[]> = {};
    if (!me) return out;
    const open = pool.filter(l => l.outcome === 'Open');
    const mine = open.filter(l => l.ownerId === me.id);
    const boss = me.admin || me.isManager || me.team === 'Manager';
    out.todo = mine.filter(l => l.stage === 'New' || isOverdue(l) || isDueToday(l));
    out.overdue = mine.filter(l => isOverdue(l));
    out.meetings = mine.filter(l => l.stage === '1st meeting' && l.meetingDate && l.meetingDate >= today);
    out.sales = me.team === 'NBD' ? open.filter(l => l.nbdId === me.id && l.ownerId && l.ownerId !== me.id) : [];
    out.team = boss ? open.filter(l => l.ownerId && l.ownerId !== me.id && isOverdue(l)) : [];
    out.waiting = open.filter(l => !l.ownerId);
    out.all = open;
    STAGES.filter(x => x !== 'Converted').forEach(st => { out[st] = open.filter(l => l.stage === st); });
    ARCHIVE.forEach(o => { out[o] = pool.filter(l => l.outcome === o); });
    return out;
  }, [pool, me, today]);

  const isArchive = ARCHIVE.includes(view);
  const rows = useMemo(() => {
    const items = [...(lists[view] || [])];
    const byNew = (a: Lead, b: Lead) => (b.createdAt || '').localeCompare(a.createdAt || '');
    if (isArchive) return items.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    if (sort === 'new' || (sort === 'due' && view === 'waiting')) return items.sort(byNew);
    if (sort === 'old') return items.sort((a, b) => byNew(b, a));
    if (view === 'meetings') return items.sort((a, b) => `${a.meetingDate} ${a.meetingTime}`.localeCompare(`${b.meetingDate} ${b.meetingTime}`));
    return items.sort((a, b) => (plannedOf(a) || '9').localeCompare(plannedOf(b) || '9') || byNew(a, b));
  }, [lists, view, sort, isArchive]);

  useEffect(() => { setShown(PAGE); }, [view, q, fNbd, fSales, fSource, fKind, fAge, fMine, fLate, sort]);

  const nbdPeople = useMemo(() => {
    const m = new Map<string, string>();
    data?.nbd.forEach(n => m.set(n.id, n.name));
    data?.leads.forEach(l => { if (l.nbdId && !m.has(l.nbdId)) m.set(l.nbdId, l.nbdName || l.nbdId); });
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);
  const salesPeople = useMemo(() => {
    const m = new Map<string, string>();
    data?.sales.forEach(n => m.set(n.id, n.name));
    data?.leads.forEach(l => { if (l.salesId && !m.has(l.salesId)) m.set(l.salesId, l.salesName || l.salesId); });
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);
  const sources = useMemo(() => [...new Set(data?.leads.map(l => l.source).filter(Boolean))].sort(), [data]);

  const go = (id: string) => { setView(id); setAdding(false); setPicker(false); setSelected(null); };
  const openLead = (enq: string) => { setSelected(enq); setAdding(false); };
  const toggleAvail = async (on: boolean) => {
    setAvailBusy(true);
    try { await crmAction({ action: 'set-available', present: on }); await load(true); } catch (e: any) { setError(e.message); } finally { setAvailBusy(false); }
  };

  if (!data && error) return <div className="p-6 max-w-md mx-auto"><div className="rounded-md border border-rose-200 bg-rose-50 text-rose-800 text-sm p-4">{error}</div><button className={`${btnGhost} mt-3`} onClick={() => load(true)}>Try again</button></div>;
  if (!data || !me) return <div className="p-10 text-center text-slate-500 text-sm">Loading leads…</div>;

  const count = (id: string) => (lists[id] || []).length;
  const myNbd = data.nbd.find(n => n.id === me.id);
  const extraToday: [string, string][] = [['meetings', 'Meetings'], ['sales', 'With salesperson'], ['team', 'Team late'], ['waiting', 'Needs a caller']];
  const groups: NavGroup[] = [
    { title: 'Today', items: [
      { id: 'todo', label: 'To do', count: count('todo') },
      { id: 'overdue', label: 'Overdue', count: count('overdue'), alert: true },
      ...extraToday.filter(([id]) => count(id) > 0 || view === id).map(([id, label]) => ({ id, label, count: count(id), alert: id === 'team' || id === 'waiting' })),
    ] },
    { title: 'Leads', items: [
      { id: 'all', label: 'All open', count: count('all') },
      ...STAGES.filter(x => x !== 'Converted').map(st => ({ id: st, label: stepLabel(st), count: count(st), dot: stepLabel(st) })),
    ] },
    { title: 'Archive', items: ARCHIVE.map(o => ({ id: o, label: o, count: count(o), dot: o })) },
  ];
  const current = groups.flatMap(g => g.items).find(i => i.id === view) || groups[0].items[0];
  const inToday = TODAY_VIEWS.includes(view);

  const chips: { label: string; clear: () => void }[] = [];
  if (fMine) chips.push({ label: 'Only my leads', clear: () => setFMine(false) });
  if (fLate) chips.push({ label: 'Only overdue', clear: () => setFLate(false) });
  if (fNbd) chips.push({ label: `NBD: ${nbdPeople.find(x => x[0] === fNbd)?.[1] || fNbd}`, clear: () => setFNbd('') });
  if (fSales) chips.push({ label: `Salesperson: ${salesPeople.find(x => x[0] === fSales)?.[1] || fSales}`, clear: () => setFSales('') });
  if (fSource) chips.push({ label: `Source: ${fSource}`, clear: () => setFSource('') });
  if (fKind) chips.push({ label: fKind, clear: () => setFKind('') });
  if (fAge) chips.push({ label: { today: 'Added today', '7': 'Added in last 7 days', '30': 'Added in last 30 days' }[fAge] || '', clear: () => setFAge('') });
  const clearAll = () => { setFNbd(''); setFSales(''); setFSource(''); setFKind(''); setFAge(''); setFMine(false); setFLate(false); setQ(''); };
  const anyFilter = chips.length > 0 || !!q;
  const sortWord = isArchive ? 'latest first' : sort === 'new' ? 'newest first' : sort === 'old' ? 'oldest first' : view === 'meetings' ? 'by meeting time' : view === 'waiting' ? 'newest first' : 'due first';

  const check = (on: boolean, set: (v: boolean) => void, label: string) => (
    <button onClick={() => set(!on)} role="checkbox" aria-checked={on} className="h-10 flex items-center gap-2 text-sm font-medium text-slate-800">
      <span className={`h-5 w-5 rounded-[4px] border flex items-center justify-center ${on ? 'bg-teal-700 border-teal-700 text-white' : 'bg-white border-slate-400'}`}>{on && <Check size={14} strokeWidth={3} />}</span>{label}
    </button>
  );
  const filterField = (label: string, node: React.ReactNode) => <div><div className="text-xs font-bold text-slate-600 mb-1">{label}</div>{node}</div>;

  const availRow = myNbd && (
    <button onClick={() => toggleAvail(!myNbd.present)} disabled={availBusy} role="switch" aria-checked={myNbd.present}
      className="w-full flex items-center justify-between gap-3 text-left disabled:opacity-60">
      <span className="min-w-0">
        <span className="block text-sm font-bold text-slate-900">{myNbd.present ? 'Getting new leads' : 'Not getting new leads'}</span>
        <span className="block text-xs text-slate-500">Turn off when you are on leave</span>
      </span>
      <Switch on={myNbd.present} />
    </button>
  );

  const emptyText: Record<string, [string, string]> = {
    todo: ['You are all caught up', 'New leads and follow-ups due today will show up here.'],
    overdue: ['Nothing is late', 'Follow-ups that pass their planned time will show up here.'],
  };
  const [emptyTitle, emptyBody] = anyFilter ? ['No leads match', 'Try removing a filter or changing the search.'] : (emptyText[view] || ['No leads here', 'Leads will show up here as they reach this step.']);

  const listPane = (
    <section className="bg-white border border-slate-200 rounded-lg" aria-label={current.label}>
      <div className="p-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <h2 className="hidden lg:flex items-baseline gap-2 flex-1 min-w-0 px-1">
            <span className="text-lg font-extrabold text-slate-900 truncate">{current.label}</span>
            <span className={`text-sm font-bold tabular-nums ${current.alert && current.count ? 'text-rose-700' : 'text-slate-400'}`}>{current.count}</span>
          </h2>
          <div className="lg:hidden relative flex-1 min-w-0">
            <button onClick={() => setPicker(v => !v)} aria-expanded={picker} aria-haspopup="true"
              className="w-full h-11 px-3 rounded-md border border-slate-300 bg-white flex items-center gap-2 text-left">
              {current.dot && <StageDot name={current.dot} />}
              <span className="text-base font-extrabold text-slate-900 truncate">{current.label}</span>
              <span className={`text-sm font-bold tabular-nums ${current.alert && current.count ? 'text-rose-700' : 'text-slate-400'}`}>{current.count}</span>
              <ChevronDown size={18} className={`ml-auto text-slate-500 shrink-0 transition-transform ${picker ? 'rotate-180' : ''}`} />
            </button>
            {picker && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setPicker(false)} aria-hidden />
                <div className="absolute z-40 left-0 right-0 mt-1 max-h-[65vh] overflow-y-auto thin-scroll rounded-md border border-slate-300 bg-white shadow-xl p-2">
                  <NavList groups={groups} value={view} onPick={go} />
                </div>
              </>
            )}
          </div>
          <button onClick={() => load(true)} disabled={loading} aria-label="Refresh" title="Refresh"
            className="h-11 w-11 lg:h-9 lg:w-9 shrink-0 rounded-md border border-slate-300 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-50 disabled:opacity-60">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="flex gap-2 mt-2.5">
          <div className="relative flex-1 min-w-0">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input className="w-full h-10 rounded-md border border-slate-300 bg-white pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/25 focus:border-teal-700"
              placeholder="Search leads" aria-label="Search by name, phone or city" value={q} onChange={e => setQ(e.target.value)} />
            {q && <button onClick={() => setQ('')} aria-label="Clear search" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-slate-500"><X size={15} /></button>}
          </div>
          <button onClick={() => setShowFilters(v => !v)} aria-expanded={showFilters}
            className={`h-10 px-3 rounded-md border text-sm font-bold inline-flex items-center gap-2 shrink-0 ${showFilters || chips.length ? 'border-teal-700 text-teal-800 bg-teal-50' : 'border-slate-300 text-slate-700 bg-white hover:bg-slate-50'}`}>
            <SlidersHorizontal size={15} /> Filters{chips.length > 0 && <span className="tabular-nums">{chips.length}</span>}
          </button>
        </div>

        {showFilters && (
          <div className="mt-2.5 pt-2.5 border-t border-slate-100">
            <div className="flex flex-wrap gap-x-5">
              {check(fMine, setFMine, 'Only my leads')}
              {check(fLate, setFLate, 'Only overdue')}
            </div>
            <div className="grid grid-cols-2 gap-2.5 mt-1">
              {filterField('NBD (first caller)', <Combo dense value={fNbd} onChange={setFNbd} placeholder="All" clearLabel="All NBD" ariaLabel="NBD" options={nbdPeople.map(([id, n]) => ({ value: id, label: n }))} />)}
              {filterField('Salesperson', <Combo dense value={fSales} onChange={setFSales} placeholder="All" clearLabel="All salespeople" ariaLabel="Salesperson" options={salesPeople.map(([id, n]) => ({ value: id, label: n }))} />)}
              {filterField('Source', <Combo dense value={fSource} onChange={setFSource} placeholder="All" clearLabel="All sources" ariaLabel="Source" options={opts(sources)} />)}
              {filterField('Type of lead', <Combo dense value={fKind} onChange={setFKind} placeholder="All" clearLabel="Online and self generated" ariaLabel="Type of lead" options={opts(['Online', 'Self generated'])} />)}
              {filterField('Added', <Combo dense value={fAge} onChange={setFAge} placeholder="Any time" clearLabel="Any time" ariaLabel="Added"
                options={[{ value: 'today', label: 'Today' }, { value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }]} />)}
              {filterField('Sort by', <Combo dense value={sort} onChange={v => setSort((v || 'due') as any)} placeholder="Due first" ariaLabel="Sort by"
                options={[{ value: 'due', label: 'Due first' }, { value: 'new', label: 'Newest first' }, { value: 'old', label: 'Oldest first' }]} />)}
            </div>
          </div>
        )}

        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
            {chips.map(c => (
              <button key={c.label} onClick={c.clear} className="h-7 pl-2 pr-1.5 rounded-[4px] bg-slate-100 text-xs font-bold text-slate-800 inline-flex items-center gap-1 hover:bg-slate-200">{c.label}<X size={12} /></button>
            ))}
            <button onClick={clearAll} className="h-7 px-1.5 text-xs font-bold text-teal-800">Clear all</button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 px-4 h-9 text-xs text-slate-500 border-b border-slate-100">
        <span>{rows.length === 0 ? 'No leads' : `${Math.min(shown, rows.length)} of ${rows.length} · ${sortWord}`}</span>
        {stamp && <span>Updated {stamp.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>}
      </div>

      <div className="rounded-b-lg overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="text-sm font-bold text-slate-800">{emptyTitle}</div>
            <div className="text-sm text-slate-500 mt-1">{emptyBody}</div>
            {anyFilter
              ? <button className={`${btnGhost} !h-10 mt-4`} onClick={clearAll}>Clear all filters</button>
              : inToday && <button className={`${btnGhost} !h-10 mt-4`} onClick={() => go('all')}>See all open leads</button>}
          </div>
        ) : (
          <>
            {rows.slice(0, shown).map(l => <LeadRow key={l.enquiryNo} lead={l} meId={me.id} selected={l.enquiryNo === selected} onOpen={() => openLead(l.enquiryNo)} />)}
            {rows.length > shown && (
              <button onClick={() => setShown(n => n + PAGE)} className="w-full h-12 border-t border-slate-100 text-sm font-bold text-teal-800 hover:bg-slate-50">
                Show {Math.min(PAGE, rows.length - shown)} more <span className="font-normal text-slate-500">({rows.length - shown} left)</span>
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );

  const rail = (
    <aside className="hidden lg:block lg:sticky lg:top-(--crm-top) lg:max-h-(--crm-max) lg:overflow-y-auto thin-scroll bg-white border border-slate-200 rounded-lg p-3">
      <button onClick={() => { setAdding(true); setSelected(null); }} className={`${btnPrimary} !h-10 w-full mb-4`}><Plus size={16} /> Add enquiry</button>
      <NavList groups={groups} value={adding ? '' : view} onPick={go} />
      {availRow && <div className="mt-4 pt-3 border-t border-slate-200 px-1">{availRow}</div>}
    </aside>
  );

  const detailPane = (
    <div className={`${lead ? '' : 'hidden md:block'} md:sticky md:top-(--crm-top) md:max-h-[calc(var(--crm-max)-64px)] lg:max-h-(--crm-max) md:overflow-y-auto thin-scroll md:bg-white md:border md:border-slate-200 md:rounded-lg`}>
      {lead
        ? <LeadPanel lead={lead} data={data} onChanged={() => load(true)} onClose={() => setSelected(null)} onQuote={onQuote} />
        : (
          <div className="hidden md:flex flex-col items-center justify-center text-center px-8 py-20">
            <div className="text-base font-extrabold text-slate-900">Pick a lead from the list</div>
            <div className="text-sm text-slate-500 mt-1 max-w-xs">You will see the customer's details, what has happened so far, and the next step to update.</div>
          </div>
        )}
    </div>
  );

  return (
    <div ref={pane.root} className="pb-24 lg:pb-8" style={{ ['--crm-top' as any]: `${pane.top}px`, ['--crm-max' as any]: pane.max }}>
      {error && <div className="rounded-md border border-rose-200 bg-rose-50 text-rose-800 text-sm px-3 py-2 mb-3">{error}</div>}

      <div className="lg:grid lg:grid-cols-[212px_minmax(0,1fr)] lg:gap-5 lg:items-start">
        {rail}
        {adding ? (
          <div>
            <AddEnquiry data={data} onSaved={() => load(true)} onOpen={openLead} onCancel={() => setAdding(false)} />
          </div>
        ) : (
          <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] md:gap-5 md:items-start">
            <div className={lead ? 'hidden md:block' : ''}>
              {availRow && inToday && <div className="lg:hidden bg-white border border-slate-200 rounded-lg px-4 py-3 mb-3">{availRow}</div>}
              {listPane}
            </div>
            {detailPane}
          </div>
        )}
      </div>

      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 grid grid-cols-3 z-30" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} aria-label="CRM">
        {([
          { id: 'todo', label: 'To do', icon: <ListChecks size={20} />, on: !adding && inToday, badge: count('overdue') },
          { id: 'all', label: 'Leads', icon: <Users size={20} />, on: !adding && !inToday, badge: 0 },
          { id: 'add', label: 'Add enquiry', icon: <Plus size={20} />, on: adding, badge: 0 },
        ]).map(t => (
          <button key={t.id} onClick={() => { if (t.id === 'add') { setAdding(true); setSelected(null); setPicker(false); } else go(t.id); }}
            aria-current={t.on ? 'page' : undefined}
            className={`h-16 flex flex-col items-center justify-center gap-1 text-[11px] font-bold ${t.on ? 'text-teal-800' : 'text-slate-500'}`}>
            <span className="relative">{t.icon}{t.badge > 0 && <span className="absolute -top-1.5 left-4 min-w-[18px] h-[18px] px-1 rounded-[4px] bg-rose-600 text-white text-[10px] leading-[18px] text-center tabular-nums">{t.badge > 99 ? '99+' : t.badge}</span>}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
