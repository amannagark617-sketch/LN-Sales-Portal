import React, { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { QUICK_LINKS, QuickLink } from '../links';
import { BRAND_ICONS } from '../brandIcons';

/** The real logo of each brand: official artwork for the social apps, and our own logo for the website. */
function BrandMark({ icon }: { icon: QuickLink['icon'] }) {
  if (icon === 'globe') return <img src="/assets/littlenap-logo.png" alt="Little Nap" className="w-10 h-10 object-contain" />;
  const key = icon === 'folder' || icon === 'file' ? 'drive' : icon;
  const b = BRAND_ICONS[key];
  if (!b) return null;
  return (
    <svg viewBox="0 0 24 24" width="28" height="28" role="img" aria-label={key}>
      {key === 'instagram' && (
        <defs>
          <radialGradient id="ig" cx="30%" cy="107%" r="150%">
            <stop offset="0" stopColor="#FDF497" /><stop offset="0.05" stopColor="#FDF497" />
            <stop offset="0.45" stopColor="#FD5949" /><stop offset="0.6" stopColor="#D6249F" /><stop offset="0.9" stopColor="#285AEB" />
          </radialGradient>
        </defs>
      )}
      <path d={b.path} fill={key === 'instagram' ? 'url(#ig)' : b.color} />
    </svg>
  );
}

function LinkCard({ link }: { link: QuickLink }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(link.url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* the Open button still works */ }
  };
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
      <div className="w-12 h-12 rounded-lg border border-slate-100 bg-white flex items-center justify-center shrink-0">
        <BrandMark icon={link.icon} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-bold text-slate-900 leading-tight">{link.title}</div>
        {link.note && <div className="text-xs text-slate-500 mt-0.5 truncate">{link.note}</div>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={copy} aria-label={`Copy ${link.title} link`} className="h-10 w-10 sm:w-auto sm:px-3 rounded-lg border border-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-slate-50">
          {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
          <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy link'}</span>
        </button>
        <a href={link.url} target="_blank" rel="noreferrer" className="h-10 px-3 sm:px-4 rounded-lg bg-slate-900 text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-slate-800">
          Open <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}

/** One page with every link the team shares with customers. The list is in src/links.ts. */
export function QuickLinks() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Quick links</h2>
        <p className="text-sm text-slate-500 mt-1">Open a link, or copy it to send to a customer.</p>
      </div>
      {QUICK_LINKS.map(g => (
        <section key={g.heading}>
          <h3 className="text-sm font-bold text-slate-700 mb-3">{g.heading}</h3>
          <div className="space-y-3">{g.links.map(l => <LinkCard key={l.url} link={l} />)}</div>
        </section>
      ))}
    </div>
  );
}
