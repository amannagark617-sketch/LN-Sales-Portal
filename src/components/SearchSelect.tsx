import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  sub?: string;   // small grey text under the label
  right?: string; // right-aligned text, e.g. a price
}

interface Props {
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  title?: string;
}

/** A dropdown that opens a searchable list. A bottom sheet on phones, a centred panel on larger screens. */
export function SearchSelect({ label, value, options, onChange, placeholder = 'Select', disabled, title }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    if (!open) return;
    setQ('');
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open]);

  const filtered = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return options;
    return options.filter(o => {
      const hay = `${o.label} ${o.sub || ''}`.toLowerCase();
      return words.every(w => hay.includes(w));
    });
  }, [q, options]);

  return (
    <div>
      {label && <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{label}</label>}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="w-full h-12 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 text-left text-sm hover:border-slate-400 focus:outline-none focus:border-slate-900 disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed"
      >
        <span className={`truncate ${selected ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={16} className="shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40" onClick={() => setOpen(false)}>
          <div
            className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[85vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div className="text-sm font-bold text-slate-900">{title || label || 'Select'}</div>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="p-1 text-slate-500"><X size={20} /></button>
            </div>
            <div className="px-5 pb-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3.5 text-slate-400" />
                <input
                  ref={inputRef}
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Type to search"
                  className="w-full h-12 rounded-xl border border-slate-200 pl-9 pr-3 text-sm focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>
            <div className="overflow-y-auto border-t border-slate-100 flex-1">
              {filtered.map(o => (
                <button
                  type="button"
                  key={o.value}
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={`w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left border-b border-slate-100 hover:bg-slate-50 ${o.value === value ? 'bg-slate-50' : ''}`}
                >
                  <span className="min-w-0">
                    <span className="block text-sm text-slate-900 font-medium break-words">{o.label}</span>
                    {o.sub && <span className="block text-xs text-slate-500 mt-0.5 break-words">{o.sub}</span>}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    {o.right && <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">{o.right}</span>}
                    {o.value === value && <Check size={16} className="text-slate-900" />}
                  </span>
                </button>
              ))}
              {!filtered.length && <div className="px-5 py-8 text-center text-sm text-slate-500">Nothing matches "{q}"</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
