import React from 'react';
import { stepLabel, plannedOf, isOverdue } from './constants';
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

export interface ComboOption { value: string; label: string; group?: string }

/** Searchable dropdown. Type to filter, tap or press Enter to pick. */
export function Combo({ value, onChange, options, placeholder = 'Select', clearLabel, ariaLabel }: {
  value: string; onChange: (v: string) => void; options: ComboOption[]; placeholder?: string; clearLabel?: string; ariaLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [hi, setHi] = React.useState(0);
  const box = React.useRef<HTMLDivElement>(null);
  const selected = options.find(o => o.value === value);

  React.useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => { if (box.current && !box.current.contains(e.target as Node)) { setOpen(false); setQ(''); } };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('touchstart', close); };
  }, [open]);

  const term = q.trim().toLowerCase();
  const shown = term ? options.filter(o => (o.label + ' ' + (o.group || '')).toLowerCase().includes(term)) : options;
  const rows: ComboOption[] = clearLabel && !term ? [{ value: '', label: clearLabel }, ...shown] : shown;

  const pick = (v: string) => { onChange(v); setOpen(false); setQ(''); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi(h => Math.min(h + 1, rows.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { if (open && rows[hi]) { e.preventDefault(); pick(rows[hi].value); } }
    else if (e.key === 'Escape') { setOpen(false); setQ(''); }
  };

  let lastGroup: string | undefined;
  return (
    <div ref={box} className="relative">
      <input
        className={inputCls + ' pr-9'}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={open}
        autoComplete="off"
        placeholder={selected && !open ? '' : (open && selected ? selected.label : placeholder)}
        value={open ? q : (selected?.label || '')}
        onFocus={() => { setOpen(true); setHi(0); }}
        onClick={() => setOpen(true)}
        onChange={e => { setQ(e.target.value); setOpen(true); setHi(0); }}
        onKeyDown={onKey}
      />
      <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg>
      {open && (
        <ul role="listbox" className="absolute z-40 left-0 right-0 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-300 bg-white shadow-lg">
          {rows.length === 0 && <li className="px-3 py-3 text-sm text-slate-500">No match</li>}
          {rows.map((o, i) => {
            const head = o.group && o.group !== lastGroup && !term ? o.group : '';
            lastGroup = o.group;
            return (
              <React.Fragment key={o.value + i}>
                {head && <li className="px-3 pt-2 pb-1 text-[11px] font-bold text-slate-500 bg-slate-50">{head}</li>}
                <li role="option" aria-selected={o.value === value}
                  onMouseDown={e => e.preventDefault()}
                  onClick={e => { e.preventDefault(); e.stopPropagation(); pick(o.value); }}
                  onMouseEnter={() => setHi(i)}
                  className={`px-3 min-h-[44px] flex items-center text-[15px] cursor-pointer ${i === hi ? 'bg-slate-100' : ''} ${o.value === value ? 'font-bold text-slate-900' : 'text-slate-800'} ${o.value === '' ? 'text-slate-500' : ''}`}>
                  {o.label}
                </li>
              </React.Fragment>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export const opts = (arr: string[]): ComboOption[] => arr.map(v => ({ value: v, label: v }));

const STAGE_TONE: Record<string, string> = {
  'First call': 'bg-slate-100 text-slate-700 border-slate-200',
  'Not connected': 'bg-orange-50 text-orange-800 border-orange-200',
  'Follow-up': 'bg-sky-50 text-sky-800 border-sky-200',
  '1st meeting': 'bg-indigo-50 text-indigo-800 border-indigo-200',
  'Send proposal': 'bg-amber-50 text-amber-800 border-amber-200',
  Negotiation: 'bg-lime-50 text-lime-800 border-lime-200',
  Converted: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Invalid: 'bg-slate-100 text-slate-600 border-slate-300',
  Lost: 'bg-rose-50 text-rose-800 border-rose-200',
  Closed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
};

export function Tag({ text }: { text: string }) {
  const t = stepLabel(text);
  return <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-bold border whitespace-nowrap ${STAGE_TONE[t] || STAGE_TONE['First call']}`}>{t}</span>;
}

export const isSelfGenerated = (l: Lead): boolean => l.group === 'Direct';

export function KindTag({ lead }: { lead: Lead }) {
  const self = isSelfGenerated(lead);
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold border whitespace-nowrap ${self ? 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200' : 'bg-blue-50 text-blue-800 border-blue-200'}`}>
      {self ? 'Self generated' : 'Online'}
    </span>
  );
}

export const fullName =(l: Lead) => `${l.firstName} ${l.lastName}`.trim() || l.phone;

export function shortDate(d: string): string {
  if (!d) return '';
  const dt = new Date(d.slice(0, 10) + 'T00:00:00');
  if (isNaN(dt.getTime())) return d;
  const day = dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const tm = d.length >= 16 ? d.slice(11, 16) : '';
  if (!tm) return day;
  const [h, m] = tm.split(':').map(Number);
  return `${day}, ${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
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
  const open = lead.outcome === 'Open';
  const planned = plannedOf(lead);
  const overdue = isOverdue(lead);
  return (
    <button onClick={onOpen}
      className={`w-full text-left px-4 py-3 border-b border-slate-100 last:border-b-0 flex items-start gap-3 ${selected ? 'bg-slate-100' : 'bg-white hover:bg-slate-50'}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900 truncate">{fullName(lead)}</span>
          <span className="text-[11px] text-slate-400 shrink-0">{lead.enquiryNo}</span>
          <KindTag lead={lead} />
        </div>
        <div className="text-xs text-slate-500 mt-0.5 truncate">
          {[lead.source, lead.city, lead.requirement].filter(Boolean).join(' · ')}
        </div>
        {showOwner && <div className="text-xs text-slate-500 mt-0.5 truncate">{lead.ownerName ? `With ${lead.ownerName}` : 'Waiting for an NBD person'}</div>}
      </div>
      <div className="text-right shrink-0 space-y-1">
        <Tag text={open ? lead.stage : lead.outcome} />
        {open && planned && (
          <div className={`text-[11px] font-bold ${overdue ? 'text-rose-600' : 'text-slate-500'}`}>{overdue ? 'Overdue · ' : ''}{shortDate(planned)}</div>
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
