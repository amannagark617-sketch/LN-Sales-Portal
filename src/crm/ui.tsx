import React from 'react';
import type { Lead } from './constants';

export const todayStr = (): string => new Date().toLocaleDateString('en-CA');
export const addDays = (n: number): string => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };

export const inputCls = 'w-full h-12 rounded-lg border border-slate-300 bg-white px-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-slate-800 disabled:bg-slate-50';
export const areaCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-800 focus:border-slate-800';
export const btnPrimary = 'h-12 px-5 rounded-lg bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 active:bg-slate-950 disabled:opacity-50 inline-flex items-center justify-center gap-2';
export const btnGhost = 'h-12 px-4 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-bold hover:bg-slate-50 disabled:opacity-50 inline-flex items-center justify-center gap-2';

export function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-slate-600 mb-1.5">{label}{required && <span className="text-rose-600"> *</span>}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500 mt-1">{hint}</span>}
    </label>
  );
}

const STAGE_TONE: Record<string, string> = {
  New: 'bg-slate-100 text-slate-700 border-slate-200',
  Contacted: 'bg-sky-50 text-sky-800 border-sky-200',
  Valid: 'bg-teal-50 text-teal-800 border-teal-200',
  Meeting: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  Proposal: 'bg-amber-50 text-amber-800 border-amber-200',
  Negotiation: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  Converted: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Invalid: 'bg-slate-100 text-slate-600 border-slate-300',
  Lost: 'bg-rose-50 text-rose-800 border-rose-200',
  Closed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};

export function Tag({ text }: { text: string }) {
  return <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-bold border ${STAGE_TONE[text] || STAGE_TONE.New}`}>{text}</span>;
}

export const fullName = (l: Lead) => `${l.firstName} ${l.lastName}`.trim() || l.phone;

export function shortDate(d: string): string {
  if (!d) return '';
  const dt = new Date(d.slice(0, 10) + 'T00:00:00');
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function DateField({ value, onChange, min }: { value: string; onChange: (v: string) => void; min?: string }) {
  const quick: [string, number][] = [['Today', 0], ['Tomorrow', 1], ['3 days', 3], ['1 week', 7]];
  return (
    <div>
      <input type="date" className={inputCls} value={value} min={min || todayStr()} onChange={e => onChange(e.target.value)} />
      <div className="flex gap-2 mt-2">
        {quick.map(([label, n]) => (
          <button key={label} type="button" onClick={() => onChange(addDays(n))}
            className={`flex-1 h-9 rounded-md border text-xs font-bold ${value === addDays(n) ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** One lead as a row: works as a tap target on a phone and as a table-like row on a desktop. */
export function LeadRow({ lead, selected, onOpen, showOwner }: { lead: Lead; selected?: boolean; onOpen: () => void; showOwner?: boolean }) {
  const overdue = lead.outcome === 'Open' && lead.nextFollowUp && lead.nextFollowUp < todayStr();
  return (
    <button onClick={onOpen}
      className={`w-full text-left px-4 py-3 border-b border-slate-100 last:border-b-0 flex items-start gap-3 ${selected ? 'bg-slate-100' : 'bg-white hover:bg-slate-50'}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900 truncate">{fullName(lead)}</span>
          <span className="text-[11px] text-slate-400 shrink-0">{lead.enquiryNo}</span>
        </div>
        <div className="text-xs text-slate-500 mt-0.5 truncate">
          {[lead.source, lead.city, lead.requirement].filter(Boolean).join(' · ')}
        </div>
        {showOwner && <div className="text-xs text-slate-500 mt-0.5 truncate">{lead.ownerName ? `With ${lead.ownerName}` : 'Waiting for an NBD person'}</div>}
      </div>
      <div className="text-right shrink-0 space-y-1">
        <Tag text={lead.outcome === 'Open' ? lead.stage : lead.outcome} />
        {lead.outcome === 'Open' && lead.nextFollowUp && (
          <div className={`text-[11px] font-bold ${overdue ? 'text-rose-600' : 'text-slate-500'}`}>{overdue ? 'Overdue ' : ''}{shortDate(lead.nextFollowUp)}</div>
        )}
      </div>
    </button>
  );
}

export function Section({ title, count, children, tone }: { title: string; count?: number; children: React.ReactNode; tone?: 'alert' }) {
  return (
    <section className="mb-5">
      <div className="flex items-baseline gap-2 px-1 mb-2">
        <h3 className={`text-sm font-bold ${tone === 'alert' ? 'text-rose-700' : 'text-slate-800'}`}>{title}</h3>
        {count !== undefined && <span className="text-xs text-slate-500">{count}</span>}
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">{children}</div>
    </section>
  );
}
