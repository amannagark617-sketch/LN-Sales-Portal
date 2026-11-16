import React from 'react';
import { Phone, MessageCircle } from 'lucide-react';
import { stepLabel, plannedOf, isOverdue, normStage } from './constants';
import type { Lead } from './constants';

export const todayStr = (): string => new Date().toLocaleDateString('en-CA');
export const addDays = (n: number): string => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };

const focusCls = 'focus:outline-none focus:ring-2 focus:ring-teal-700/25 focus:border-teal-700';
const focusBtn = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2';
export const inputCls = `w-full h-12 rounded-md border border-slate-300 bg-white px-3 text-[15px] text-slate-900 placeholder:text-slate-400 ${focusCls} disabled:bg-slate-50`;
export const areaCls = `w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-slate-900 placeholder:text-slate-400 ${focusCls}`;
export const btnPrimary = `h-12 px-5 rounded-md bg-teal-700 text-white text-sm font-bold hover:bg-teal-800 active:bg-teal-900 disabled:opacity-50 inline-flex items-center justify-center gap-2 ${focusBtn}`;
export const btnGhost = `h-12 px-4 rounded-md border border-slate-300 bg-white text-slate-800 text-sm font-bold hover:bg-slate-50 disabled:opacity-50 inline-flex items-center justify-center gap-2 ${focusBtn}`;
export const btnSm = `h-9 px-3 rounded-md border border-slate-300 bg-white text-slate-800 text-xs font-bold hover:bg-slate-50 disabled:opacity-50 inline-flex items-center justify-center gap-1.5 ${focusBtn}`;

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
export function Combo({ value, onChange, options, placeholder = 'Select', clearLabel, ariaLabel, dense }: {
  value: string; onChange: (v: string) => void; options: ComboOption[]; placeholder?: string; clearLabel?: string; ariaLabel?: string; dense?: boolean;
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
        className={(dense ? inputCls.replace('h-12', 'h-10').replace('text-[15px]', 'text-sm') : inputCls) + ' pr-9'}
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
        <ul role="listbox" className="absolute z-40 left-0 right-0 mt-1 max-h-64 overflow-y-auto thin-scroll rounded-md border border-slate-300 bg-white shadow-lg">
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
                  className={`px-3 min-h-[44px] flex items-center text-[15px] cursor-pointer ${i === hi ? 'bg-slate-100' : ''} ${o.value === value ? 'font-bold text-teal-800' : 'text-slate-800'} ${o.value === '' ? 'text-slate-500' : ''}`}>
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

export const STAGE_DOT: Record<string, string> = {
  'First call': 'bg-slate-400',
  'Not connected': 'bg-orange-500',
  'Follow-up': 'bg-sky-500',
  '1st meeting': 'bg-indigo-500',
  'Send proposal': 'bg-amber-500',
  Negotiation: 'bg-lime-600',
  Converted: 'bg-emerald-600',
  Invalid: 'bg-slate-400',
  Lost: 'bg-rose-500',
  Closed: 'bg-emerald-600',
};

export function StageDot({ name }: { name: string }) {
  return <span className={`inline-block h-2 w-2 shrink-0 ${STAGE_DOT[stepLabel(name)] || 'bg-slate-400'}`} aria-hidden />;
}

export function Tag({ text }: { text: string }) {
  const t = stepLabel(text);
  return <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 whitespace-nowrap"><StageDot name={t} />{t}</span>;
}

export const isSelfGenerated = (l: Lead): boolean => l.group === 'Direct';

export function KindTag({ lead }: { lead: Lead }) {
  const self = isSelfGenerated(lead);
  return (
    <span className={`inline-block rounded-[3px] px-1.5 py-px text-[11px] font-bold whitespace-nowrap ${self ? 'bg-fuchsia-50 text-fuchsia-800' : 'bg-blue-50 text-blue-800'}`}>
      {self ? 'Self generated' : 'Online'}
    </span>
  );
}

export const fullName = (l: Lead) => `${l.firstName} ${l.lastName}`.trim() || l.phone;

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

const clock = (d: string): string => {
  const [h, m] = d.slice(11, 16).split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};
const span = (mins: number): string => mins < 60 ? `${Math.max(1, Math.round(mins))} min` : mins < 1440 ? `${Math.round(mins / 60)} hr${Math.round(mins / 60) === 1 ? '' : 's'}` : `${Math.round(mins / 1440)} day${Math.round(mins / 1440) === 1 ? '' : 's'}`;

/** Plain words for when a lead is due: "2 hrs late", "Due in 40 min", "Today, 6:30 pm". */
export function dueText(lead: Lead): { text: string; late: boolean } {
  const p = plannedOf(lead);
  if (!p || lead.outcome !== 'Open') return { text: '', late: false };
  const late = isOverdue(lead);
  const today = todayStr();
  if (p.length <= 10) {
    const days = Math.round((new Date(today + 'T00:00:00').getTime() - new Date(p + 'T00:00:00').getTime()) / 86400000);
    if (late) return { text: `${span(days * 1440)} late`, late };
    return { text: p === today ? 'Due today' : p === addDays(1) ? 'Tomorrow' : shortDate(p), late };
  }
  const diff = (new Date(p.replace(' ', 'T') + ':00+05:30').getTime() - Date.now()) / 60000;
  if (late) return { text: `${span(-diff)} late`, late };
  if (diff < 360) return { text: `Due in ${span(diff)}`, late };
  const day = p.slice(0, 10);
  return { text: `${day === today ? 'Today' : day === addDays(1) ? 'Tomorrow' : shortDate(day)}, ${clock(p)}`, late };
}

export const phoneDigits = (l: Lead): string => (l.phone || '').replace(/\D/g, '').slice(-10);

/** One lead in a list: who, what they want, where it stands, and one tap to call or WhatsApp. */
export function LeadRow({ lead, selected, onOpen, meId }: { lead: Lead; selected?: boolean; onOpen: () => void; meId?: string }) {
  const open = lead.outcome === 'Open';
  const due = dueText(lead);
  const digits = phoneDigits(lead);
  const who = !open ? '' : !lead.ownerId ? 'Needs a caller' : lead.ownerId !== meId ? `With ${lead.ownerName}` : '';
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div role="button" tabIndex={0} aria-current={selected || undefined} onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      className={`relative flex gap-3 px-4 py-3 border-b border-slate-100 last:border-b-0 cursor-pointer focus-visible:outline-none focus-visible:bg-slate-50 ${selected ? 'bg-teal-50' : 'hover:bg-slate-50'}`}>
      {selected && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-teal-700" aria-hidden />}
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-bold text-slate-900 truncate">{fullName(lead)}</div>
        <div className="text-[13px] text-slate-600 truncate mt-0.5">{[lead.requirement, lead.city, lead.source].filter(Boolean).join(' · ') || lead.phone}</div>
        <div className="flex items-center gap-2.5 mt-1.5 min-w-0 text-xs text-slate-500">
          <Tag text={open ? lead.stage : lead.outcome} />
          <KindTag lead={lead} />
          {who && <span className={`truncate ${!lead.ownerId ? 'font-bold text-rose-700' : ''}`}>{who}</span>}
        </div>
      </div>
      <div className="shrink-0 flex flex-col items-end justify-between gap-2">
        <span className={`text-xs font-bold whitespace-nowrap ${due.late ? 'text-rose-700' : 'text-slate-500'}`}>{due.text || (open ? '' : shortDate((lead.updatedAt || '').slice(0, 10)))}</span>
        {open && digits.length === 10 && (
          <div className="flex gap-1.5">
            <a href={`tel:+91${digits}`} onClick={stop} aria-label={`Call ${fullName(lead)}`} title="Call" className="h-9 w-9 rounded-md bg-teal-50 text-teal-800 flex items-center justify-center hover:bg-teal-100"><Phone size={16} /></a>
            <a href={`https://wa.me/91${digits}`} target="_blank" rel="noreferrer" onClick={stop} aria-label={`WhatsApp ${fullName(lead)}`} title="WhatsApp" className="h-9 w-9 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200"><MessageCircle size={16} /></a>
          </div>
        )}
      </div>
    </div>
  );
}

const STEPS = ['First call', 'Follow-up', '1st meeting', 'Send proposal', 'Negotiation'];

/** Where an open lead stands in the five working steps. */
export function Stepper({ stage }: { stage: string }) {
  const s = normStage(stage);
  const at = s === 'New' || s === 'Not connected' ? 0 : Math.max(0, STEPS.indexOf(s));
  return (
    <div className="@container">
    <ol className="grid grid-cols-5 gap-1.5" aria-label={`Step ${at + 1} of 5: ${stepLabel(s)}`}>
      {STEPS.map((label, i) => (
        <li key={label} className="min-w-0">
          <div className={`h-1.5 ${i < at ? 'bg-teal-700/35' : i === at ? 'bg-teal-700' : 'bg-slate-200'}`} />
          <div className={`hidden @md:block mt-1.5 text-[11px] truncate ${i === at ? 'font-bold text-slate-900' : i < at ? 'text-slate-500' : 'text-slate-400'}`}>{i === at ? stepLabel(s) : label}</div>
        </li>
      ))}
    </ol>
    </div>
  );
}
