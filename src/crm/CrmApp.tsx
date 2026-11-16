import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, CalendarCheck, List, PlusCircle } from 'lucide-react';
import { fetchCrm, crmAction, CrmData } from './api';
import { Lead, normStage, plannedOf, isOverdue, isDueToday, stepLabel, STAGES } from './constants';
import { LeadRow, Section, Combo, opts, inputCls, btnGhost, todayStr, fullName } from './ui';
import { LeadPanel } from './LeadPanel';
import { AddEnquiry } from './AddEnquiry';

type Tab = 'today' | 'leads' | 'add';

export function CrmApp() {
  const [data, setData] = useState<CrmData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('today');
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [step, setStep] = useState('');
  const [fOwner, setFOwner] = useState('');
  const [fSource, setFSource] = useState('');
  const loadedAt = useRef(0);

  const load = useCallback(async (refresh = false) => {
    setLoading(true); setError('');
    try {
      const d = await fetchCrm(refresh);
      d.leads.forEach(l => { l.stage = normStage(l.stage); });
      setData(d); loadedAt.current = Date.now();
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
    const byPlan = (a: Lead, b: Lead) => plannedOf(a).localeCompare(plannedOf(b));
    const newest = (a: Lead, b: Lead) => (b.createdAt || '').localeCompare(a.createdAt || '');
    return {
      waiting: open.filter(l => !l.ownerId).sort(newest),
      fresh: mine.filter(l => l.stage === 'New').sort(newest),
      overdue: mine.filter(l => l.stage !== 'New' && isOverdue(l)).sort(byPlan),
      dueToday: mine.filter(l => l.stage !== 'New' && isDueToday(l)).sort(byPlan),
      meetings: mine.filter(l => l.stage === '1st meeting' && l.meetingDate && l.meetingDate >= today).sort((a, b) => a.meetingDate.localeCompare(b.meetingDate)),
      watching: me.team === 'NBD' ? open.filter(l => l.nbdId === me.id && l.ownerId && l.ownerId !== me.id).sort(byPlan) : [],
      teamOverdue: boss ? open.filter(l => l.ownerId && l.ownerId !== me.id && isOverdue(l)).sort(byPlan) : [],
    };
  }, [data, me, today]);

  const base = useMemo(() => {
    if (!data) return [];
    const s = q.trim().toLowerCase();
    return data.leads.filter(l =>
      (!fOwner || l.ownerId === fOwner) && (!fSource || l.source === fSource) &&
      (!s || [fullName(l), l.phone, l.enquiryNo, l.city, l.company, l.email].join(' ').toLowerCase().includes(s))
    ).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }, [data, q, fOwner, fSource]);

  const steps = useMemo(() => {
    const openSteps = STAGES.filter(x => x !== 'Converted').map(st => ({ id: st, label: stepLabel(st), count: base.filter(l => l.outcome === 'Open' && l.stage === st).length }));
    return [
      { id: '', label: 'All open', count: base.filter(l => l.outcome === 'Open').length },
      ...openSteps,
      ...['Closed', 'Lost', 'Invalid'].map(o => ({ id: o, label: o, count: base.filter(l => l.outcome === o).length })),
    ];
  }, [base]);

  const filtered = useMemo(() => base.filter(l =>
    step === '' ? l.outcome === 'Open' : ['Closed', 'Lost', 'Invalid'].includes(step) ? l.outcome === step : l.outcome === 'Open' && l.stage === step
  ), [base, step]);

  const owners = useMemo(() => {
    const m = new Map<string, string>();
    data?.leads.forEach(l => { if (l.ownerId) m.set(l.ownerId, l.ownerName); });
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
  const empty = <div className="px-4 py-5 text-sm text-slate-500">Nothing here.</div>;
  const nothing = !Object.values(groups).some(g => g.length);

  const todayView = (
    <div>
      {myNbd && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-slate-900">{myNbd.present ? 'You are getting new leads' : 'You are not getting new leads'}</div>
            <div className="text-xs text-slate-500">Turn off when you are on leave or not at work.</div>
          </div>
          <button role="switch" aria-checked={myNbd.present} onClick={() => toggleAvail(!myNbd.present)}
            className={`h-8 w-14 rounded-full relative shrink-0 transition-colors ${myNbd.present ? 'bg-emerald-600' : 'bg-slate-300'}`}>
            <span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${myNbd.present ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
      )}
      {nothing && <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-600 mb-5">No follow-ups today. New leads will appear here.</div>}
      {groups.waiting.length > 0 && <Section title="Waiting for an NBD person" count={groups.waiting.length} tone="alert">{list(groups.waiting)}</Section>}
      {groups.fresh.length > 0 && <Section title="New leads to call" count={groups.fresh.length}>{list(groups.fresh)}</Section>}
      {groups.overdue.length > 0 && <Section title="Overdue follow-ups" count={groups.overdue.length} tone="alert">{list(groups.overdue)}</Section>}
      {groups.dueToday.length > 0 && <Section title="Due today" count={groups.dueToday.length}>{list(groups.dueToday)}</Section>}
      {groups.meetings.length > 0 && <Section title="Upcoming meetings" count={groups.meetings.length}>{list(groups.meetings)}</Section>}
      {groups.watching.length > 0 && <Section title="Aligned to Sales" count={groups.watching.length}>{list(groups.watching, true)}</Section>}
      {groups.teamOverdue.length > 0 && <Section title="Team overdue" count={groups.teamOverdue.length} tone="alert">{list(groups.teamOverdue, true)}</Section>}
    </div>
  );

  const leadsView = (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap">
        {steps.map(t => (
          <button key={t.id || 'all'} onClick={() => setStep(t.id)}
            className={`shrink-0 min-w-[104px] text-left rounded-lg border px-3 py-2 ${step === t.id ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'}`}>
            <div className="text-lg font-extrabold leading-tight">{t.count}</div>
            <div className={`text-[11px] font-bold ${step === t.id ? 'text-slate-200' : 'text-slate-500'}`}>{t.label}</div>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <input className={`${inputCls} col-span-2`} placeholder="Search name, phone, enquiry no" value={q} onChange={e => setQ(e.target.value)} />
        <Combo value={fOwner} onChange={setFOwner} placeholder="All owners" clearLabel="All owners" ariaLabel="Owner" options={owners.map(([id, n]) => ({ value: id, label: n }))} />
        <Combo value={fSource} onChange={setFSource} placeholder="All sources" clearLabel="All sources" ariaLabel="Source" options={opts(sources)} />
      </div>
      <div className="text-xs text-slate-500 mb-2 px-1">{filtered.length} leads · newest first</div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? empty : list(filtered.slice(0, 200), true)}
      </div>
      {filtered.length > 200 && <div className="text-xs text-slate-500 mt-2 px-1">Showing the latest 200. Use search or filters to narrow down.</div>}
    </div>
  );

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'today', label: 'Today', icon: <CalendarCheck size={20} /> },
    { id: 'leads', label: 'Leads', icon: <List size={20} /> },
    { id: 'add', label: 'Add enquiry', icon: <PlusCircle size={20} /> },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 pt-4 pb-24 md:pb-8">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="hidden md:flex gap-2">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`h-10 px-4 rounded-lg border text-sm font-bold ${tab === t.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-50'}`}>{t.label}</button>
          ))}
        </div>
        <h2 className="md:hidden text-lg font-extrabold text-slate-900">{tabs.find(t => t.id === tab)?.label}</h2>
        <button onClick={() => load(true)} disabled={loading} className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 inline-flex items-center gap-2 disabled:opacity-60">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm px-3 py-2 mb-3">{error}</div>}

      {tab === 'add' ? (
        <div className="max-w-2xl"><AddEnquiry data={data} onSaved={() => load(true)} onOpen={open} /></div>
      ) : (
        <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-5 items-start">
          <div className={lead ? 'hidden md:block' : ''}>{tab === 'today' ? todayView : leadsView}</div>
          <div className={`${lead ? '' : 'hidden md:block'} md:sticky md:top-44 md:max-h-[calc(100vh-12rem)] md:overflow-y-auto md:rounded-xl`}>
            {lead
              ? <LeadPanel lead={lead} data={data} onChanged={() => load(true)} onClose={() => setSelected(null)} />
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
