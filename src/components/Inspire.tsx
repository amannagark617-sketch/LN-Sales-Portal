import React, { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Kind = 'Vision' | 'Purpose' | 'Brand promise' | 'Mission' | 'Culture' | 'Core value' | 'Sales tip';
interface Item { kind: Kind; text: string; sub?: string }

const COLOR: Record<Kind, string> = {
  'Vision': '#0F766E', 'Purpose': '#2563EB', 'Brand promise': '#BE3A86', 'Mission': '#7C4DDB',
  'Culture': '#B8860B', 'Core value': '#16803C', 'Sales tip': '#9B7C50'
};

const DNA: Item[] = [
  { kind: 'Vision', text: 'To redefine the future of comfort and create an Indian legacy that reaches the world.' },
  { kind: 'Purpose', text: 'We exist to make every moment worth sinking into.' },
  { kind: 'Brand promise', text: 'Comfort You Can Feel. A Brand You Can Trust.' },
  { kind: 'Mission', text: 'Delivering comfort with commitment: through innovation, customized seating, uncompromising quality and experiences that stay with every customer.' },
  { kind: 'Culture', text: 'Karo Toh Sabki Baat Karo', sub: 'If you speak, speak for all.' },
  { kind: 'Core value', text: 'Customer First: Customer is God.', sub: 'Feel what the customer feels. Listen to everyone. Follow up. Customers include our clients, our vendors and our own people.' },
  { kind: 'Core value', text: 'Integrity: No wrong pitch, ever.', sub: "Never cheat. Never promise what we don't have. Be straightforward, honest and truthful." },
  { kind: 'Core value', text: 'Ownership: Act like it is your own company.', sub: 'Take ownership and accountability for the outcome, not just the task.' },
  { kind: 'Core value', text: 'Learning: The more you learn, the more you implement.', sub: 'Learning never stops, for any of us. We keep growing, one lesson at a time.' },
  { kind: 'Core value', text: 'One Team, One Dream: Unity in diversity.', sub: 'Teamwork, zero politics, transparency from top to bottom, and learning and growing together.' }
];

const TIPS: Item[] = [
  { kind: 'Sales tip', text: 'Let the customer sit before you talk. A recliner is sold by how it feels, so get them into the seat in the first minute.' },
  { kind: 'Sales tip', text: 'Ask who will use the recliner most, and for how long each day. The answer decides the size, the motor and the upholstery.' },
  { kind: 'Sales tip', text: 'Ask the height and build of the person who will sit. Seat depth and headrest position matter more than the colour.' },
  { kind: 'Sales tip', text: 'Measure the room before quoting. Check the wall gap a recliner needs to open fully, and the door and lift width it must pass through.' },
  { kind: 'Sales tip', text: 'Compare the first recliner the customer sat in with the last one. Let them tell you which one they want to go home to.' },
  { kind: 'Sales tip', text: 'Explain manual, single motor and dual motor in one sentence each, by what the customer will do with it, not by technical names.' },
  { kind: 'Sales tip', text: 'Match the upholstery to the home. Ask about children, pets, sunlight and how often the room is used, before suggesting leather or fabric.' },
  { kind: 'Sales tip', text: 'Quote one clear price with what it includes: model, seats, upholstery, add-ons, freight and installation. Surprises later cost you the customer.' },
  { kind: 'Sales tip', text: 'Never promise a delivery date you have not confirmed with production. A late truth is worse than an early one.' },
  { kind: 'Sales tip', text: 'Follow up within a day of the visit with the quotation and one personal line about what the customer liked. Then call, do not just wait.' },
  { kind: 'Sales tip', text: "When a customer says 'I will think about it', ask what they are unsure about. It is usually price, size or the family's opinion." },
  { kind: 'Sales tip', text: 'Invite the whole family to the showroom. The person who will not sit in the chair often decides the purchase.' },
  { kind: 'Sales tip', text: 'Write the customer\'s needs in the lead notes in their own words. The next person who calls should not have to ask again.' },
  { kind: 'Sales tip', text: 'Sell the complete set. A sofa with a matching recliner, or a pair for two partners, looks better and is easier to quote together.' },
  { kind: 'Sales tip', text: 'Add-ons such as a cup holder, a USB switch or a side pocket are best shown on the demo piece, not described over the phone.' },
  { kind: 'Sales tip', text: 'For a project or a cinema, ask for the seat count, row layout and aisle width first. Then price by the seat, with freight and GST stated separately.' },
  { kind: 'Sales tip', text: 'Call every new enquiry on the same day. The customer who enquired this morning is still comparing options this afternoon.' },
  { kind: 'Sales tip', text: 'If a call is not answered, try again at a different time of day, then send a short message. Do not close the lead after one attempt.' },
  { kind: 'Sales tip', text: 'Tell customers how to care for their recliner: keep it away from direct sun, clean spills early, and do not sit on the footrest.' },
  { kind: 'Sales tip', text: 'A happy customer is your best lead. After delivery, ask for a review and for one friend or relative who might also want comfort.' },
  { kind: 'Sales tip', text: 'Know the ready stock before you speak. Offering a piece that can be delivered this week often closes a hesitant customer.' },
  { kind: 'Sales tip', text: 'Keep the next step dated. Every open lead should have a call or meeting with a date, never just "later".' }
];


const TABS: { id: string; label: string; kinds: Kind[]; color: string }[] = [
  { id: 'all', label: 'All', kinds: [], color: '#1E293B' },
  { id: 'vision', label: 'Vision', kinds: ['Vision'], color: COLOR['Vision'] },
  { id: 'purpose', label: 'Purpose', kinds: ['Purpose'], color: COLOR['Purpose'] },
  { id: 'promise', label: 'Promise', kinds: ['Brand promise'], color: COLOR['Brand promise'] },
  { id: 'mission', label: 'Mission', kinds: ['Mission'], color: COLOR['Mission'] },
  { id: 'culture', label: 'Culture', kinds: ['Culture'], color: COLOR['Culture'] },
  { id: 'values', label: 'Values', kinds: ['Core value'], color: COLOR['Core value'] },
  { id: 'tips', label: 'Sales tips', kinds: ['Sales tip'], color: COLOR['Sales tip'] }
];

const shuffle = <T,>(a: T[]) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
/** One piece of DNA, then one tip, then DNA again, in a random order each visit. */
const weave = (): Item[] => {
  const d = shuffle(DNA), t = shuffle(TIPS), out: Item[] = [];
  for (let i = 0; i < Math.max(d.length, t.length); i++) { if (d[i]) out.push(d[i]); if (t[i]) out.push(t[i]); }
  return out;
};

// A double helix that drifts along the bottom of the card, in the Little Nap DNA colours.
const helixUri = (() => {
  const W = 360, H = 40, mid = 20, amp = 13, cols = ['#14B8A6', '#2563EB', '#BE3A86', '#7C4DDB', '#E0A526', '#16803C'];
  const y1 = (x: number) => mid + amp * Math.sin((x / W) * Math.PI * 4);
  const y2 = (x: number) => mid - amp * Math.sin((x / W) * Math.PI * 4);
  let a = '', b = '', rungs = '', dots = '';
  for (let x = 0; x <= W; x += 6) { a += `${x === 0 ? 'M' : 'L'}${x} ${y1(x).toFixed(1)}`; b += `${x === 0 ? 'M' : 'L'}${x} ${y2(x).toFixed(1)}`; }
  for (let x = 9; x < W; x += 18) rungs += `<line x1="${x}" y1="${y1(x).toFixed(1)}" x2="${x}" y2="${y2(x).toFixed(1)}" stroke="#CBD5E1" stroke-width="1"/>`;
  for (let k = 0; k < 12; k++) { const x = 15 + k * 30; dots += `<circle cx="${x}" cy="${y1(x).toFixed(1)}" r="2.4" fill="${cols[k % cols.length]}"/><circle cx="${x}" cy="${y2(x).toFixed(1)}" r="2.4" fill="${cols[(k + 3) % cols.length]}"/>`; }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#14B8A6"/><stop offset=".35" stop-color="#2563EB"/><stop offset=".7" stop-color="#BE3A86"/><stop offset="1" stop-color="#E0A526"/></linearGradient><linearGradient id="h" x1="0" x2="1"><stop offset="0" stop-color="#E0A526"/><stop offset=".4" stop-color="#7C4DDB"/><stop offset=".75" stop-color="#2563EB"/><stop offset="1" stop-color="#14B8A6"/></linearGradient></defs>${rungs}<path d="${a}" fill="none" stroke="url(#g)" stroke-width="2.4" stroke-linecap="round"/><path d="${b}" fill="none" stroke="url(#h)" stroke-width="2.4" stroke-linecap="round"/>${dots}</svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
})();

const CSS = `
@keyframes inspire-in { from { opacity: 0; transform: translateY(14px); filter: blur(5px); } to { opacity: 1; transform: none; filter: none; } }
@keyframes inspire-rule { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes inspire-fill { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes inspire-back { 0%, 12% { transform: rotate(0deg); } 45%, 70% { transform: rotate(-24deg); } 100% { transform: rotate(0deg); } }
@keyframes inspire-foot { 0%, 12% { transform: rotate(78deg); } 45%, 70% { transform: rotate(-3deg); } 100% { transform: rotate(78deg); } }
@keyframes inspire-floor { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -28; } }
@keyframes inspire-glow { 0%, 12% { opacity: 0; } 45%, 70% { opacity: 1; } 100% { opacity: 0; } }
.rc-back { transform-origin: 72px 34px; animation: inspire-back 7s ease-in-out infinite; }
.rc-foot { transform-origin: 118px 36px; animation: inspire-foot 7s ease-in-out infinite; }
.rc-floor { animation: inspire-floor 2.4s linear infinite; }
.rc-glow { animation: inspire-glow 7s ease-in-out infinite; }
.inspire-paused .rc-back, .inspire-paused .rc-foot, .inspire-paused .rc-floor, .inspire-paused .rc-glow { animation-play-state: paused; }
@keyframes inspire-drift { from { background-position-x: 0; } to { background-position-x: -360px; } }
.inspire-in { animation: inspire-in .7s cubic-bezier(.2,.7,.2,1) both; }
.inspire-in-2 { animation: inspire-in .7s .12s cubic-bezier(.2,.7,.2,1) both; }
.inspire-rule { transform-origin: left; animation: inspire-rule .8s .1s cubic-bezier(.2,.7,.2,1) both; }
.inspire-fill { transform-origin: left; animation: inspire-fill var(--dur) linear both; }
.inspire-helix { animation: inspire-drift 26s linear infinite; }
.inspire-paused .inspire-fill, .inspire-paused .inspire-helix { animation-play-state: paused; }
.inspire-q { font-family: 'Fraunces', Georgia, 'Times New Roman', serif; font-weight: 500; letter-spacing: -0.012em; font-optical-sizing: auto; }
@media (prefers-reduced-motion: reduce) { .inspire-in, .inspire-in-2, .inspire-rule, .inspire-helix, .rc-back, .rc-foot, .rc-floor, .rc-glow { animation: none !important; } }
`;

export default function Inspire({ className = '' }: { className?: string }) {
  const [deck, setDeck] = useState<Item[]>(() => weave());
  const [i, setI] = useState(0);
  const [tab, setTab] = useState('all');
  const [paused, setPaused] = useState(false);
  const [open, setOpen] = useState(false);
  const touch = useRef<number | null>(null);

  const it = deck[i % deck.length];
  const c = COLOR[it.kind];
  const dur = Math.min(26, Math.max(10, Math.round((it.text.length + (it.sub?.length || 0)) / 14) + 8));

  const next = (d = 1) => setI(x => (x + d + deck.length) % deck.length);
  const choose = (id: string) => {
    setTab(id);
    const t = TABS.find(x => x.id === id)!;
    const d = t.kinds.length ? shuffle(DNA.concat(TIPS).filter(x => t.kinds.includes(x.kind))) : weave();
    setDeck(d); setI(0);
  };

  return (
    <section aria-label="Little Nap DNA and sales tips" className={`relative overflow-hidden bg-white border border-slate-200 rounded-xl ${paused ? 'inspire-paused' : ''} ${className}`}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
      onTouchStart={e => { touch.current = e.touches[0].clientX; }}
      onTouchEnd={e => { if (touch.current === null) return; const dx = e.changedTouches[0].clientX - touch.current; touch.current = null; if (Math.abs(dx) > 50) next(dx < 0 ? 1 : -1); }}>
      <style>{CSS}</style>

      <div className="absolute inset-x-0 top-0 h-[3px] bg-slate-100">
        <div key={`${tab}-${i}`} className="inspire-fill h-full" style={{ background: c, ['--dur' as any]: `${dur}s` }} onAnimationEnd={() => next(1)} />
      </div>

      <div className="flex items-center gap-1 px-4 sm:px-6 pt-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {TABS.map(t => (
          <button key={t.id} type="button" onClick={() => choose(t.id)}
            className="relative shrink-0 h-8 px-2.5 text-[13px] font-bold whitespace-nowrap transition-colors"
            style={{ color: tab === t.id ? t.color : '#64748B' }}>
            {t.label}
            <span className="absolute left-2.5 right-2.5 bottom-0 h-[2px] transition-opacity" style={{ background: t.color, opacity: tab === t.id ? 1 : 0 }} />
          </button>
        ))}
      </div>

      <div className="px-5 sm:px-8 pt-5 pb-4 min-h-[190px] sm:min-h-[168px] flex items-center gap-3">
        <button type="button" aria-label="Previous" className="hidden sm:flex w-10 h-10 shrink-0 items-center justify-center text-slate-400 hover:text-slate-900 transition-colors" onClick={() => next(-1)}><ChevronLeft size={22} /></button>
        <div key={`${tab}-${i}-${it.text.slice(0, 8)}`} className="flex-1 min-w-0">
          <div className="inspire-in flex items-center gap-3">
            <span className="text-[13px] font-bold" style={{ color: c }}>{it.kind === 'Sales tip' ? 'Sales tip' : it.kind === 'Core value' ? 'Our core value' : `Our ${it.kind.toLowerCase()}`}</span>
            <span className="inspire-rule h-px w-16 sm:w-28" style={{ background: c }} />
          </div>
          <p className="inspire-in inspire-q mt-2.5 text-[21px] sm:text-[28px] leading-[1.25] sm:leading-[1.22] text-slate-900" style={{ animationDelay: '.06s' }}>
            {it.kind === 'Sales tip' ? it.text : `“${it.text}”`}
          </p>
          {it.sub && <p className="inspire-in-2 mt-2.5 text-[13px] sm:text-[15px] leading-snug text-slate-600 max-w-3xl">{it.sub}</p>}
        </div>
        <button type="button" aria-label="Next" className="hidden sm:flex w-10 h-10 shrink-0 items-center justify-center text-slate-400 hover:text-slate-900 transition-colors" onClick={() => next(1)}><ChevronRight size={22} /></button>
      </div>

      {it.kind === 'Sales tip' ? (
        <div className="inspire-in h-14 flex items-end justify-center overflow-hidden" key={`rc-${i}`} aria-hidden>
          <svg viewBox="0 0 400 56" className="h-14 w-[400px] max-w-full" preserveAspectRatio="xMidYMax meet">
            <line className="rc-floor" x1="0" y1="52" x2="400" y2="52" stroke="#9B7C50" strokeWidth="1.4" strokeDasharray="10 18" strokeLinecap="round" opacity=".55" />
            <g transform="translate(130 0)">
              <ellipse className="rc-glow" cx="92" cy="50" rx="62" ry="3.5" fill="#9B7C50" fillOpacity=".2" />
              <rect x="80" y="44" width="34" height="5" rx="2" fill="#9B7C50" />
              <rect x="94" y="38" width="6" height="8" fill="#9B7C50" />
              <g className="rc-foot"><rect x="118" y="32" width="26" height="7" rx="3.5" fill="#B8975F" /></g>
              <g className="rc-back"><rect x="66" y="6" width="13" height="32" rx="6.5" fill="#9B7C50" /><rect x="64" y="2" width="17" height="9" rx="4.5" fill="#B8975F" /></g>
              <rect x="68" y="30" width="54" height="10" rx="5" fill="#9B7C50" />
              <rect x="76" y="22" width="40" height="6" rx="3" fill="#B8975F" />
            </g>
          </svg>
        </div>
      ) : (
        <div className="inspire-helix h-10 opacity-90" style={{ backgroundImage: helixUri, backgroundRepeat: 'repeat-x', backgroundSize: '360px 40px' }} aria-hidden />
      )}

      <div className="border-t border-slate-100 px-4 sm:px-6 h-10 flex items-center justify-between text-xs">
        <button type="button" className="font-bold text-slate-600 hover:text-slate-900" onClick={() => setOpen(o => !o)}>{open ? 'Hide the full Little Nap DNA' : 'Read the full Little Nap DNA'}</button>
        <span className="flex items-center gap-2 text-slate-400">
          <button type="button" aria-label="Previous" className="sm:hidden" onClick={() => next(-1)}><ChevronLeft size={18} /></button>
          {(i % deck.length) + 1} / {deck.length}
          <button type="button" aria-label="Next" className="sm:hidden" onClick={() => next(1)}><ChevronRight size={18} /></button>
        </span>
      </div>

      {open && (
        <div className="border-t border-slate-100 px-5 sm:px-8 py-5 grid sm:grid-cols-2 gap-x-10 gap-y-5">
          {DNA.map((d, k) => (
            <div key={k} className="min-w-0">
              <div className="text-[13px] font-bold" style={{ color: COLOR[d.kind] }}>{d.kind === 'Core value' ? 'Core value' : `Our ${d.kind.toLowerCase()}`}</div>
              <div className="inspire-q text-[17px] leading-snug text-slate-900 mt-0.5">{d.kind === 'Core value' ? d.text : `“${d.text}”`}</div>
              {d.sub && <div className="text-[13px] text-slate-600 mt-1 leading-snug">{d.sub}</div>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
