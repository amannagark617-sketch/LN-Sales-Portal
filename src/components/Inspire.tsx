import React, { useEffect, useRef, useState } from 'react';
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

const pick = (pool: Item[]) => Math.floor(Math.random() * pool.length);

export default function Inspire({ className = '' }: { className?: string }) {
  const ALL = useRef<Item[]>([...DNA, ...TIPS]).current;
  const [i, setI] = useState(() => pick(ALL));
  const [open, setOpen] = useState(false);
  const paused = useRef(false);

  useEffect(() => {
    const t = setInterval(() => { if (!paused.current && !document.hidden) setI(x => (x + 1 + pick(ALL)) % ALL.length); }, 30000);
    return () => clearInterval(t);
  }, [ALL]);

  const it = ALL[i];
  const go = (d: number) => setI(x => (x + d + ALL.length) % ALL.length);
  const c = COLOR[it.kind];

  return (
    <div className={`bg-white border border-slate-200 rounded-lg ${className}`} onMouseEnter={() => { paused.current = true; }} onMouseLeave={() => { paused.current = false; }}>
      <div className="flex items-stretch">
        <div className="w-1 rounded-l-lg shrink-0" style={{ background: c }} />
        <div className="flex-1 min-w-0 px-4 py-3">
          <div className="text-xs font-bold" style={{ color: c }}>{it.kind === 'Sales tip' ? 'Sales tip' : `Little Nap ${it.kind.toLowerCase()}`}</div>
          <p className="text-sm sm:text-[15px] font-semibold text-slate-900 mt-1 leading-snug">{it.kind === 'Sales tip' ? it.text : `“${it.text}”`}</p>
          {it.sub && <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-snug">{it.sub}</p>}
        </div>
        <div className="flex items-center gap-0.5 pr-2 shrink-0">
          <button type="button" aria-label="Previous" className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-slate-900" onClick={() => go(-1)}><ChevronLeft size={18} /></button>
          <button type="button" aria-label="Next" className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-slate-900" onClick={() => go(1)}><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className="border-t border-slate-100 px-4 h-9 flex items-center justify-between text-xs">
        <button type="button" className="font-bold text-slate-600 hover:text-slate-900" onClick={() => setOpen(o => !o)}>{open ? 'Hide Little Nap DNA' : 'See Little Nap DNA'}</button>
        <span className="text-slate-400">{i + 1} of {ALL.length}</span>
      </div>
      {open && (
        <div className="border-t border-slate-100 px-4 py-3 space-y-3">
          {DNA.map((d, k) => (
            <div key={k}>
              <div className="text-xs font-bold" style={{ color: COLOR[d.kind] }}>{d.kind === 'Core value' ? 'Core value' : `Our ${d.kind.toLowerCase()}`}</div>
              <div className="text-sm text-slate-900 font-medium">{d.kind === 'Core value' ? d.text : `“${d.text}”`}</div>
              {d.sub && <div className="text-xs text-slate-600">{d.sub}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
