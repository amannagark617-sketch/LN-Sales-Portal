import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Search, X, ArrowLeft, ChevronRight } from 'lucide-react';
import { PriceRow } from '../quotation/types';

const fmt0 = (n: number) => 'Rs. ' + Math.round(n).toLocaleString('en-IN');

export interface ItemGroup {
  key: string;
  item: string;
  category: string;
  rows: PriceRow[];
}

interface Props {
  groups: ItemGroup[];
  onPick: (row: PriceRow) => void;
  buttonLabel: string;
  title: string;
  /** shown on the second screen, e.g. "Choose seats and type" */
  variantTitle?: string;
  className?: string;
}

/**
 * One control: tap, search or scroll to a model, then pick one of its options (with price).
 * Typing something like "vercon 2 seater" searches the options directly.
 */
export function ItemPicker({ groups, onPick, buttonLabel, title, variantTitle = 'Choose an option', className }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<ItemGroup | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => { setOpen(false); setGroup(null); setQ(''); };

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open]);

  // "2 seater" finds "Two Seater", "1 seater" finds "Single Seater"
  const SYN: Record<string, string> = { '1': 'single', one: 'single', '2': 'two', '3': 'three', '1s': 'single', '2s': 'two', '3s': 'three' };
  const words = q.toLowerCase().replace(/(\d)\s*-?\s*(seater|seat|s)\b/g, '$1 seater').split(/\s+/).filter(Boolean).map(w => SYN[w] || w);

  const modelList = useMemo(() => {
    if (!words.length) return groups;
    return groups.filter(g => words.every(w => `${g.item} ${g.category}`.toLowerCase().includes(w)));
  }, [q, groups]);

  // when text is typed, also search every option so "vercon 2 seater" works
  const optionHits = useMemo(() => {
    if (!words.length) return [] as { g: ItemGroup; r: PriceRow }[];
    const src = group ? [group] : groups;
    const out: { g: ItemGroup; r: PriceRow }[] = [];
    src.forEach(g => g.rows.forEach(r => {
      const hay = `${g.item} ${r.variant} ${g.category}`.toLowerCase();
      if (words.every(w => hay.includes(w))) out.push({ g, r });
    }));
    return out.slice(0, 60);
  }, [q, groups, group]);

  const choose = (r: PriceRow) => { onPick(r); close(); };
  const chooseGroup = (g: ItemGroup) => {
    if (g.rows.length === 1) return choose(g.rows[0]);
    setGroup(g); setQ('');
  };

  const rowBtn = 'w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left border-b border-slate-100 hover:bg-slate-50';

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className={className || 'inline-flex items-center justify-center gap-2 h-12 w-full rounded-xl bg-slate-900 text-white px-6 text-sm font-bold hover:bg-slate-800'}>
        <Plus size={16} /> {buttonLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40" onClick={close}>
          <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[88vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div className="flex items-center gap-2 min-w-0">
                {group && <button type="button" aria-label="Back" onClick={() => { setGroup(null); setQ(''); }} className="p-1 -ml-1 text-slate-600"><ArrowLeft size={20} /></button>}
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">{group ? group.item : title}</div>
                  {group && <div className="text-xs text-slate-500">{variantTitle}</div>}
                </div>
              </div>
              <button type="button" aria-label="Close" onClick={close} className="p-1 text-slate-500"><X size={20} /></button>
            </div>
            <div className="px-5 pb-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3.5 text-slate-400" />
                <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
                  placeholder={group ? 'Search options' : 'Search model, e.g. vercon 2 seater'}
                  className="w-full h-12 rounded-xl border border-slate-200 pl-9 pr-3 text-sm focus:outline-none focus:border-slate-900" />
              </div>
            </div>

            <div className="overflow-y-auto border-t border-slate-100 flex-1">
              {/* second screen: options of the chosen model */}
              {group && !words.length && group.rows.map(r => (
                <button type="button" key={r.variant} className={rowBtn} onClick={() => choose(r)}>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900">{r.variant || 'Standard'}</span>
                    {r.notes && <span className="block text-xs text-slate-500 mt-0.5">{r.notes}</span>}
                  </span>
                  <span className="text-sm font-bold text-slate-800 whitespace-nowrap">{fmt0(r.price)}</span>
                </button>
              ))}

              {/* first screen: models */}
              {!group && !words.length && modelList.map(g => (
                <button type="button" key={g.key} className={rowBtn} onClick={() => chooseGroup(g)}>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900">{g.item}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">{g.category} · {g.rows.length} option{g.rows.length > 1 ? 's' : ''}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-slate-500">from {fmt0(Math.min(...g.rows.map(r => r.price)))}</span>
                    <ChevronRight size={16} className="text-slate-400" />
                  </span>
                </button>
              ))}

              {/* searching: direct option results */}
              {words.length > 0 && optionHits.map(({ g, r }) => (
                <button type="button" key={`${g.key}|${r.variant}`} className={rowBtn} onClick={() => choose(r)}>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900">{g.item}{r.variant ? ` · ${r.variant}` : ''}</span>
                    <span className="block text-xs text-slate-500 mt-0.5">{g.category}</span>
                  </span>
                  <span className="text-sm font-bold text-slate-800 whitespace-nowrap">{fmt0(r.price)}</span>
                </button>
              ))}

              {words.length > 0 && !optionHits.length && <div className="px-5 py-8 text-center text-sm text-slate-500">Nothing matches "{q}"</div>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
