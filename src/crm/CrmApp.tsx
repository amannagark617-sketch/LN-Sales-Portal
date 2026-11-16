import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, CalendarCheck, List, PlusCircle, SlidersHorizontal, X } from 'lucide-react';
import { fetchCrm, crmAction, CrmData } from './api';
import { Lead, normStage, plannedOf, isOverdue, isDueToday, stepLabel, STAGES } from './constants';
import { LeadRow, Combo, opts, inputCls, btnGhost, todayStr, addDays, fullName } from './ui';
import { LeadPanel } from './LeadPanel';
import { AddEnquiry } from './AddEnquiry';

type Tab = 'today' | 'leads' | 'add';

export function CrmApp({ onQuote }: { onQuote?: (lead: Lead, reuse?: { no: string; asPI: boolean }) => void }) {
  const [data, setData] = useState<CrmData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('today');
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [step, setStep] = useState('');
  const [fNbd, setFNbd] = useState('');
  const [fSales, setFSales] = useState('');
  const [fSource, setFSource] = useState('');
  const [fKind, setFKind] = useState('');
  const [fAge, setFAge] = useState('');
  const [fMine, setFMine] = useState(false);
  const [fLate, setFLate] = useState(false);
  const [fWaiting, setFWaiting] = useState(false);
  const [sort, setSort] = useState<'due' | 'new' | 'old'>('due');
  const [showFilters, setShowFilters] = useState(false);
  const [shown, setShown] = useState(50);
  const [todayTab, setTodayTab] = useState('todo');
  const [todayShown, setTodayShown] = useState(10);
  const [stamp, setStamp] = useState<Date | null>(null);
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
  const lead = useMemo(() => data?.leads.find(l => l.enquiryNo === selected) || null, [data, selected]);

  const groups = useMemo(() => {
    if (!data || !me) return null;
    const open = data.leads.filter(l => l.outcome === 'Open');
    const mine = open.filter(l => l.ownerId === me.id);
    const boss = me.admin || me.isManager || me.team === 'Manager';
    const byPlan = (a: Lead, b: Lead) => (plannedOf(a) || '9').localeCompare(plannedOf(b) || '9');
    const newest = (a: Lead, b: Lead) => (b.createdAt || '').localeCompare(a.createdAt || '');
    return {
      todo: mine.filter(l => l.stage === 'New' || isOverdue(l) || isDueToday(l)).sort(byPlan),
      overdue: mine.filter(l => isOverdue(l)).sort(byPlan),
      meetings: mine.filter(l => l.stage === '1st meeting' && l.meetingDate && l.meetingDate >= today).sort((a, b) => a.meetingDate.localeCompare(b.meetingDate)),
      sales: me.team === 'NBD' ? open.filter(l => l.nbdId === me.id && l.ownerId && l.ownerId !== me.id).sort(byPlan) : [],
      team: boss ? open.filter(l => l.ownerId && l.ownerId !== me.id && isOverdue(l)).sort(byPlan) : [],
      waiting: open.filter(l => !l.ownerId).sort(newest),
    };
  }, [data, me, today]);

  const base = useMemo(() => {
    if (!data || !me) return [];
    const s = q.trim().toLowerCase();
    const since = fAge === 'today' ? today : fAge === '7' ? addDays(-7) : fAge === '30' ? addDays(-30) : '';
    return data.leads.filter(l =>
      (!fNbd || l.nbdId === fNbd) && (!fSales || l.salesId === fSales) && (!fSource || l.source === fSource) &&
      (!fKind || (fKind === 'Self generated') === (l.group === 'Direct')) &&
      (!since || (l.createdAt || '').slice(0, 10) >= since) &&
      (!fMine || l.ownerId === me.id) && (!fLate || (l.outcome === 'Open' && isOverdue(l))) && (!fWaiting || (l.outcome === 'Open' && !l.ownerId)) &&
      (!s || [fullName(l), l.phone, l.enquiryNo, l.city, l.company, l.email].join(' ').toLowerCase().includes(s))
    );
  }, [data, me, q, fNbd, fSales, fSource, fKind, fAge, fMine, fLate, fWaiting, today]);

  const archived = ['Closed', 'Lost', 'Invalid'].includes(step);
  const steps = useMemo(() => {
    const openSteps = STAGES.filter(x => x !== 'Converted').map(st => ({ id: st, label: stepLabel(st), count: base.filter(l => l.outcome === 'Open' && l.stage === st).length }));
    return [{ id: '', label: 'All open', count: base.filter(l => l.outcome === 'Open').length }, ...openSteps];
  }, [base]);
  const archiveSteps = useMemo(() => ['Closed', 'Lost', 'Invalid'].map(o => ({ id: o, label: o, count: base.filter(l => l.outcome === o).length })), [base]);

  const filtered = useMemo(() => {
    const rows = base.filter(l => step === '' ? l.outcome === 'Open' : archived ? l.outcome === step : l.outcome === 'Open' && l.stage === step);
    const byNew = (a: Lead, b: Lead) => (b.createdAt || '').localeCompare(a.createdAt || '');
    if (sort === 'new' || archived) return rows.sort(archived ? (a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '') : byNew);
    if (sort === 'old') return rows.sort((a, b) => byNew(b, a));
    return rows.sort((a, b) => (plannedOf(a) || '9').localeCompare(plannedOf(b) || '9') || byNew(a, b));
  }, [base, step, archived, sort]);

  useEffect(() => { setShown(50); }, [step, q, fNbd, fSales, fSource, fKind, fAge, fMine, fLate, fWaiting, sort]);
  useEffect(() => { setTodayShown(10); }, [todayTab]);

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

  const open = (enq: string) => { setSelected(enq); if (tab === 'add') setTab('leads'); };
  const toggleAvail = async (on: boolean) => {
    try { await crmAction({ action: 'set-available', present: on }); await load(true); } catch (e: any) { setError(e.message); }
  };

  if (!data && error) return <div className="p-6 max-w-md mx-auto"><div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm p-4">{error}</div><button className={`${btnGhost} mt-3`} onClick={() => load(true)}>Try again</button></div>;
  if (!data || !me || !groups) return <div className="p-10 text-center text-slate-500 text-sm">Loading leads…</div>;

  const myNbd = data.nbd.find(n => n.id === me.id);
  const list = (items: Lead[], showOwner = false) => items.map(l => <LeadRow key={l.enquiryNo} lead={l} showOwner={showOwner} selected={l.enquiryNo === selected} onOpen={() => open(l.enquiryNo)} />);

  const todayTabs = [
    { id: 'todo', label: 'To do', items: groups.todo, always: true },
    { id: 'overdue', label: 'Overdue', items: groups.overdue, always: true },
    { id: 'meetings', label: 'Meetings', items: groups.meetings, always: false },
    { id: 'sales', label: 'With salesperson', items: groups.sales, always: false },
    { id: 'team', label: 'Team late', items: groups.team, always: false },
    { id: 'waiting', label: 'Needs a caller', items: groups.waiting, always: false },
  ].filter(t => t.always || t.items.length > 0);
  const activeToday = todayTabs.find(t => t.id === todayTab) || todayTabs[0];
  const lateCount = groups.overdue.length;

  const UnderTabs = ({ items, value, onPick }: { items: { id: string; label: string; count: number }[]; value: string; onPick: (id: string) => void }) => (
    <div role="tablist" className="flex gap-5 overflow-x-auto border-b border-slate-200 -mx-4 px-4 md:mx-0 md:px-0 no-scrollbar">
      {items.map(t => (
        <button key={t.id || 'all'} role="tab" aria-selected={value === t.id} onClick={() => onPick(t.id)}
          className={`shrink-0 h-11 text-sm font-bold border-b-2 -mb-px whitespace-nowrap ${value === t.id ? 'border-teal-700 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
          {t.label}<span className={`ml-1.5 text-xs font-bold ${value === t.id ? 'text-teal-700' : 'text-slate-400'}`}>{t.count}</span>
        </button>
      ))}
    </div>
  );

  const MoreButton = ({ shownN, total, step: n, onMore }: { shownN: number; total: number; step: number; onMore: () => void }) => total > shownN ? (
    <button onClick={onMore} className="w-full h-12 border-t border-slate-100 text-sm font-bold text-teal-800 hover:bg-slate-50">Show {Math.min(n, total - shownN)} more <span className="font-normal text-slate-500">({total - shownN} left)</span></button>
  ) : null;

  const todayView = (
    <div>
      <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 leading-none">{groups.todo.length}</span>
            <span className="text-sm text-slate-600">to do now</span>
          </div>
          {lateCount > 0 && <div className="text-sm font-bold text-rose-700 mt-1">{lateCount} late</div>}
        </div>
        {myNbd && (
          <div className="flex items-center gap-3 text-right">
            <div className="text-xs">
              <div className="font-bold text-slate-900">{myNbd.present ? 'Getting new leads' : 'Not getting new leads'}</div>
              <div className="text-slate-500">Turn off on leave</div>
            </div>
            <button role="switch" aria-checked={myNbd.present} aria-label="Getting new leads" onClick={() => toggleAvail(!myNbd.present)}
              className={`h-8 w-14 rounded-full relative shrink-0 transition-colors ${myNbd.present ? 'bg-teal-700' : 'bg-slate-300'}`}>
              <span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${myNbd.present ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
        )}
      </div>
      <UnderTabs items={todayTabs.map(t => ({ id: t.id, label: t.label, count: t.items.length }))} value={activeToday.id} onPick={setTodayTab} />
      <div className="bg-white border border-slate-200 border-t-0 rounded-b-lg overflow-hidden">
        {activeToday.items.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="text-sm font-bold text-slate-800">{activeToday.id === 'todo' ? 'You are all caught up' : 'Nothing here'}</div>
            <div className="text-sm text-slate-500 mt-1">{activeToday.id === 'todo' ? 'New leads and follow-ups due today will show up here.' : 'Leads will appear here when they need attention.'}</div>
            <button className={`${btnGhost} mt-4`} onClick={() => setTab('leads')}>Open all leads</button>
          </div>
        ) : (
          <>
            {list(activeToday.items.slice(0, todayShown), ['sales', 'team', 'waiting'].includes(activeToday.id))}
            <MoreButton shownN={todayShown} total={activeToday.items.length} step={10} onMore={() => setTodayShown(n => n + 10)} />
          </>
        )}
      </div>
    </div>
  );

  const chips: { label: string; clear: () => void }[] = [];
  if (fNbd) chips.push({ label: `NBD: ${nbdPeople.find(x => x[0] === fNbd)?.[1] || fNbd}`, clear: () => setFNbd('') });
  if (fSales) chips.push({ label: `Salesperson: ${salesPeople.find(x => x[0] === fSales)?.[1] || fSales}`, clear: () => setFSales('') });
  if (fSource) chips.push({ label: `Source: ${fSource}`, clear: () => setFSource('') });
  if (fKind) chips.push({ label: fKind, clear: () => setFKind('') });
  if (fAge) chips.push({ label: { today: 'Added today', '7': 'Added in last 7 days', '30': 'Added in last 30 days' }[fAge] || '', clear: () => setFAge('') });
  const clearAll = () => { setFNbd(''); setFSales(''); setFSource(''); setFKind(''); setFAge(''); setFMine(false); setFLate(false); setFWaiting(false); setQ(''); };
  const anyFilter = chips.length > 0 || fMine || fLate || fWaiting || !!q;
  const toggle = (on: boolean, set: (v: boolean) => void, label: string) => (
    <button onClick={() => set(!on)} aria-pressed={on} className={`h-9 px-3 rounded-md border text-xs font-bold ${on ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}>{label}</button>
  );

  const leadsView = (
    <div>
      <UnderTabs items={[...steps, { id: archived ? step : 'Closed', label: 'Archived', count: archiveSteps.reduce((n, x) => n + x.count, 0) }]}
        value={archived ? (step) : step} onPick={id => setStep(id)} />
      {archived && (
        <div className="flex gap-2 mt-3">
          {archiveSteps.map(t => (
            <button key={t.id} onClick={() => setStep(t.id)} className={`h-9 px-3 rounded-md border text-xs font-bold ${step === t.id ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'}`}>{t.label} <span className="opacity-70">{t.count}</span></button>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <input className={`${inputCls} flex-1 min-w-0`} placeholder="Search name, phone, city" value={q} onChange={e => setQ(e.target.value)} />
        <button onClick={() => setShowFilters(v => !v)} aria-expanded={showFilters}
          className={`h-12 px-4 rounded-lg border text-sm font-bold inline-flex items-center gap-2 shrink-0 ${showFilters || chips.length ? 'border-slate-900 text-slate-900 bg-white' : 'border-slate-300 text-slate-700 bg-white hover:bg-slate-50'}`}>
          <SlidersHorizontal size={16} /> Filters{chips.length > 0 && <span className="text-teal-700">{chips.length}</span>}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        {toggle(fMine, setFMine, 'My leads')}
        {toggle(fLate, setFLate, 'Overdue only')}
        {toggle(fWaiting, setFWaiting, 'Needs a caller')}
      </div>

      {showFilters && (
        <div className="mt-3 bg-white border border-slate-200 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><div className="text-xs font-bold text-slate-600 mb-1.5">NBD (first caller)</div>
            <Combo value={fNbd} onChange={setFNbd} placeholder="All NBD" clearLabel="All NBD" ariaLabel="NBD" options={nbdPeople.map(([id, n]) => ({ value: id, label: n }))} /></div>
          <div><div className="text-xs font-bold text-slate-600 mb-1.5">Salesperson</div>
            <Combo value={fSales} onChange={setFSales} placeholder="All salespeople" clearLabel="All salespeople" ariaLabel="Salesperson" options={salesPeople.map(([id, n]) => ({ value: id, label: n }))} /></div>
          <div><div className="text-xs font-bold text-slate-600 mb-1.5">Source</div>
            <Combo value={fSource} onChange={setFSource} placeholder="All sources" clearLabel="All sources" ariaLabel="Source" options={opts(sources)} /></div>
          <div><div className="text-xs font-bold text-slate-600 mb-1.5">Type of lead</div>
            <Combo value={fKind} onChange={setFKind} placeholder="Online and self generated" clearLabel="Online and self generated" ariaLabel="Type of lead" options={opts(['Online', 'Self generated'])} /></div>
          <div><div className="text-xs font-bold text-slate-600 mb-1.5">Added</div>
            <Combo value={fAge} onChange={setFAge} placeholder="Any time" clearLabel="Any time" ariaLabel="Added"
              options={[{ value: 'today', label: 'Today' }, { value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }]} /></div>
          <div><div className="text-xs font-bold text-slate-600 mb-1.5">Sort by</div>
            <Combo value={sort} onChange={v => setSort((v || 'due') as any)} placeholder="Due first" ariaLabel="Sort by"
              options={[{ value: 'due', label: 'Due first' }, { value: 'new', label: 'Newest first' }, { value: 'old', label: 'Oldest first' }]} /></div>
        </div>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {chips.map(c => (
            <button key={c.label} onClick={c.clear} className="h-8 pl-2.5 pr-2 rounded-md border border-slate-300 bg-slate-50 text-xs font-bold text-slate-800 inline-flex items-center gap-1.5">{c.label}<X size={13} /></button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-slate-500 mt-4 mb-2 px-1">
        <span>Showing {Math.min(shown, filtered.length)} of {filtered.length}{archived || sort === 'new' ? ' · newest first' : sort === 'old' ? ' · oldest first' : ' · due first'}</span>
        {anyFilter && <button onClick={clearAll} className="font-bold text-teal-800">Clear all</button>}
      </div>
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="text-sm font-bold text-slate-800">No leads match</div>
            <div className="text-sm text-slate-500 mt-1">{anyFilter ? 'Try removing a filter.' : 'Leads will show up here as they come in.'}</div>
            {anyFilter && <button className={`${btnGhost} mt-4`} onClick={clearAll}>Clear all filters</button>}
          </div>
        ) : (
          <>
            {list(filtered.slice(0, shown), true)}
            <MoreButton shownN={shown} total={filtered.length} step={50} onMore={() => setShown(n => n + 50)} />
          </>
        )}
      </div>
    </div>
  );

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'today', label: 'Today', icon: <CalendarCheck size={20} /> },
    { id: 'leads', label: 'Leads', icon: <List size={20} /> },
    { id: 'add', label: 'Add enquiry', icon: <PlusCircle size={20} /> },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 pt-4 pb-24 md:pb-8">
      <div className="flex items-end justify-between gap-3 mb-4 border-b border-slate-200">
        <div className="hidden md:flex gap-6">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`h-11 text-sm font-bold border-b-2 -mb-px ${tab === t.id ? 'border-teal-700 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>{t.label}</button>
          ))}
        </div>
        <h2 className="md:hidden text-lg font-extrabold text-slate-900 pb-2">{tabs.find(t => t.id === tab)?.label}</h2>
        <div className="flex items-center gap-3 pb-1.5">
          {stamp && <span className="text-xs text-slate-500">Updated {stamp.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>}
          <button onClick={() => load(true)} disabled={loading} className="h-10 px-3 rounded-md border border-slate-300 bg-white text-xs font-bold text-slate-700 inline-flex items-center gap-2 disabled:opacity-60">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm px-3 py-2 mb-3">{error}</div>}

      {tab === 'add' ? (
        <div className="max-w-2xl"><AddEnquiry data={data} onSaved={() => load(true)} onOpen={open} /></div>
      ) : (
        <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-5 items-start">
          <div className={lead ? 'hidden md:block' : ''}>{tab === 'today' ? todayView : leadsView}</div>
          <div className={`${lead ? '' : 'hidden md:block'} md:sticky md:top-44 md:max-h-[calc(100vh-12rem)] md:overflow-y-auto md:rounded-xl`}>
            {lead
              ? <LeadPanel lead={lead} data={data} onChanged={() => load(true)} onClose={() => setSelected(null)} onQuote={onQuote} />
              : <div className="hidden md:block bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center text-sm text-slate-500">Select a lead to see details and update it.</div>}
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 grid grid-cols-3 z-30" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); if (t.id === 'add') setSelected(null); }}
            className={`h-16 flex flex-col items-center justify-center gap-1 text-[11px] font-bold ${tab === t.id ? 'text-slate-900' : 'text-slate-400'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
