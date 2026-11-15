import React, { useEffect, useState } from 'react';
import { ChevronLeft, Phone, MessageCircle, Mail } from 'lucide-react';
import { crmAction, fetchTimeline, CrmData } from './api';
import { Lead, TimelineEntry, STAGES } from './constants';
import { Field, inputCls, areaCls, btnPrimary, btnGhost, DateField, Tag, fullName, shortDate, todayStr } from './ui';

type Status = 'Open' | 'Lost' | 'Invalid' | 'Closed';

function Info({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-bold text-slate-500">{label}</div>
      <div className="text-sm text-slate-900 break-words">{value}</div>
    </div>
  );
}

function when(t: string): string {
  const d = new Date(t.replace(' ', 'T') + '+05:30');
  if (isNaN(d.getTime())) return t;
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}

export function LeadPanel({ lead, data, onChanged, onClose }: { lead: Lead; data: CrmData; onChanged: () => Promise<void> | void; onClose: () => void }) {
  const me = data.me;
  const [panel, setPanel] = useState<null | 'update' | 'reopen' | 'reassign'>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const blank = { status: 'Open' as Status, stage: '', text: '', next: '', align: false, back: false, toId: '', date: '', time: '', reason: '', opf: '', value: '' };
  const [f, setF] = useState(blank);
  const set = (k: keyof typeof blank, v: any) => setF(p => ({ ...p, [k]: v }));

  const loadTimeline = () => fetchTimeline(lead.enquiryNo).then(setTimeline).catch(() => setTimeline([]));
  useEffect(() => { setPanel(null); setError(''); setTimeline(null); setF(blank); loadTimeline(); }, [lead.enquiryNo]);

  const isOwner = lead.ownerId === me.id;
  const isMine = isOwner || (me.team === 'NBD' && !lead.ownerId);
  const boss = me.admin || me.isManager || me.team === 'Manager';
  const open = lead.outcome === 'Open';
  const canUpdate = open && (isMine || boss);
  const canAlign = open && lead.ownerTeam === 'NBD' && (isOwner || me.admin);
  const canBack = open && lead.ownerTeam === 'Sales' && (isOwner || me.admin);
  const canReopen = !open && lead.outcome !== 'Closed' && (isMine || boss);
  const overdue = open && lead.nextFollowUp && lead.nextFollowUp < todayStr();

  const run = async (body: Record<string, any>) => {
    setBusy(true); setError('');
    try {
      await crmAction({ enquiryNo: lead.enquiryNo, ...body });
      setPanel(null);
      setF(blank);
      await onChanged();
      await loadTimeline();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (f.status === 'Lost') return run({ action: 'mark-lost', reason: f.reason, text: f.text });
    if (f.status === 'Invalid') return run({ action: 'mark-invalid', reason: f.reason, text: f.text });
    if (f.status === 'Closed') return run({ action: 'close-lead', opf: f.opf, orderValue: f.value, text: f.text });
    if (f.align) return run({ action: 'align', toId: f.toId, meetingDate: f.date, meetingTime: f.time, text: f.text });
    if (f.back) return run({ action: 'send-back', toId: f.toId, text: f.text, nextFollowUp: f.next });
    return run({ action: 'log-activity', type: 'Follow-up', text: f.text, stage: f.stage || (lead.stage === 'New' ? 'Contacted' : lead.stage), nextFollowUp: f.next });
  };

  const digits = lead.phone.replace(/\D/g, '').slice(-10);
  const people = [...data.nbd.map(n => ({ id: n.id, name: `${n.name} (NBD)` })), ...data.sales.map(s => ({ id: s.id, name: `${s.name} (${s.showroom || s.region})` }))];
  const statuses: Status[] = ['Open', 'Lost', 'Invalid', 'Closed'];

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex items-start gap-3">
        <button onClick={onClose} aria-label="Back to list" className="md:hidden h-10 w-10 -ml-1 rounded-lg border border-slate-200 flex items-center justify-center shrink-0"><ChevronLeft size={20} /></button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-extrabold text-slate-900 truncate">{fullName(lead)}</h2>
            <Tag text={open ? lead.stage : lead.outcome} />
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{lead.enquiryNo} · {lead.source}{lead.ownerName ? ` · with ${lead.ownerName}` : ' · waiting for an NBD person'}</div>
        </div>
      </div>

      <div className="p-4 grid grid-cols-3 gap-2 border-b border-slate-100">
        <a href={`tel:+91${digits}`} className={btnPrimary}><Phone size={16} /> Call</a>
        <a href={`https://wa.me/91${digits}`} target="_blank" rel="noreferrer" className={btnGhost}><MessageCircle size={16} /> WhatsApp</a>
        {lead.email ? <a href={`mailto:${lead.email}`} className={btnGhost}><Mail size={16} /> Email</a> : <span />}
      </div>

      {open && (
        <div className={`px-4 py-3 border-b flex items-center justify-between gap-3 ${overdue ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'}`}>
          <div>
            <div className="text-[11px] font-bold text-slate-500">Planned follow-up</div>
            <div className={`text-base font-extrabold ${overdue ? 'text-rose-700' : 'text-slate-900'}`}>{lead.nextFollowUp ? shortDate(lead.nextFollowUp) : 'Not set'}{overdue ? ' · Overdue' : ''}</div>
          </div>
          {canUpdate && <button onClick={() => { setPanel(panel === 'update' ? null : 'update'); setError(''); }} className={btnPrimary}>Update status</button>}
        </div>
      )}

      {(canUpdate && panel === 'update') && (
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="grid grid-cols-4 border border-slate-300 rounded-lg overflow-hidden">
            {statuses.map(s => (
              <button key={s} onClick={() => setF(p => ({ ...p, status: s, reason: '' }))}
                className={`h-11 text-sm font-bold border-r border-slate-300 last:border-r-0 ${f.status === s ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>{s}</button>
            ))}
          </div>

          {f.status === 'Open' && (
            <>
              {!f.align && !f.back && (
                <Field label="Stage">
                  <select className={inputCls} value={f.stage || (lead.stage === 'New' ? 'Contacted' : lead.stage)} onChange={e => set('stage', e.target.value)}>
                    {STAGES.filter(s => s !== 'New' && s !== 'Converted').map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Remarks" required><textarea className={areaCls} rows={3} value={f.text} onChange={e => set('text', e.target.value)} placeholder="What did the customer say?" /></Field>
              {!f.align && <Field label="Next follow-up date" required><DateField value={f.next} onChange={v => set('next', v)} /></Field>}
              {canAlign && (
                <label className="flex items-center gap-3 text-sm font-bold text-slate-800 min-h-[44px]">
                  <input type="checkbox" className="h-5 w-5" checked={f.align} onChange={e => setF(p => ({ ...p, align: e.target.checked, toId: '' }))} />
                  Align to a salesperson
                </label>
              )}
              {canAlign && f.align && (
                <div className="space-y-3">
                  <Field label="Salesperson" required>
                    <select className={inputCls} value={f.toId} onChange={e => set('toId', e.target.value)}>
                      <option value="">Select salesperson</option>
                      {data.sales.map(s => <option key={s.id} value={s.id}>{s.name} · {s.showroom || s.region}</option>)}
                    </select>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Meeting date" required><input type="date" className={inputCls} min={todayStr()} value={f.date} onChange={e => set('date', e.target.value)} /></Field>
                    <Field label="Meeting time"><input type="time" className={inputCls} value={f.time} onChange={e => set('time', e.target.value)} /></Field>
                  </div>
                </div>
              )}
              {canBack && (
                <label className="flex items-center gap-3 text-sm font-bold text-slate-800 min-h-[44px]">
                  <input type="checkbox" className="h-5 w-5" checked={f.back} onChange={e => setF(p => ({ ...p, back: e.target.checked, toId: '' }))} />
                  Send back to NBD
                </label>
              )}
              {canBack && f.back && (
                <Field label="Send to" hint={lead.nbdName ? `Default: ${lead.nbdName}, who had it before` : undefined}>
                  <select className={inputCls} value={f.toId} onChange={e => set('toId', e.target.value)}>
                    <option value="">{lead.nbdName ? `${lead.nbdName} (same NBD)` : 'Next NBD in rotation'}</option>
                    {data.nbd.filter(n => n.id !== lead.nbdId).map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </select>
                </Field>
              )}
            </>
          )}

          {(f.status === 'Lost' || f.status === 'Invalid') && (
            <>
              <Field label="Reason" required>
                <select className={inputCls} value={f.reason} onChange={e => set('reason', e.target.value)}>
                  <option value="">Select reason</option>
                  {(f.status === 'Invalid' ? data.lists.InvalidReason : data.lists.LostReason).map(r => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Remarks"><textarea className={areaCls} rows={3} value={f.text} onChange={e => set('text', e.target.value)} /></Field>
            </>
          )}

          {f.status === 'Closed' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="OPF number" required><input className={inputCls} value={f.opf} onChange={e => set('opf', e.target.value)} /></Field>
                <Field label="Order value" required><input className={inputCls} inputMode="numeric" value={f.value} onChange={e => set('value', e.target.value.replace(/[^\d.]/g, ''))} /></Field>
              </div>
              <Field label="Remarks"><textarea className={areaCls} rows={2} value={f.text} onChange={e => set('text', e.target.value)} /></Field>
            </>
          )}

          <button className={`${btnPrimary} w-full`} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      )}

      {canReopen && (
        <div className="p-4 border-b border-slate-100 space-y-3">
          {panel !== 'reopen'
            ? <button className={btnGhost} onClick={() => { setPanel('reopen'); setError(''); }}>Reopen lead</button>
            : (
              <>
                <Field label="Remarks"><textarea className={areaCls} rows={2} value={f.text} onChange={e => set('text', e.target.value)} placeholder="Why is it back?" /></Field>
                <Field label="Next follow-up date" required><DateField value={f.next} onChange={v => set('next', v)} /></Field>
                <button className={`${btnPrimary} w-full`} disabled={busy} onClick={() => run({ action: 'reopen', nextFollowUp: f.next, text: f.text })}>{busy ? 'Saving…' : 'Reopen lead'}</button>
              </>
            )}
        </div>
      )}

      {open && boss && (
        <div className="px-4 py-3 border-b border-slate-100 space-y-3">
          <button className="text-xs font-bold text-slate-600 underline" onClick={() => { setPanel(panel === 'reassign' ? null : 'reassign'); setError(''); }}>Reassign this lead</button>
          {panel === 'reassign' && (
            <div className="space-y-3">
              <Field label="New owner" required>
                <select className={inputCls} value={f.toId} onChange={e => set('toId', e.target.value)}>
                  <option value="">Select person</option>
                  {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Remarks"><textarea className={areaCls} rows={2} value={f.text} onChange={e => set('text', e.target.value)} /></Field>
              <button className={`${btnPrimary} w-full`} disabled={busy} onClick={() => run({ action: 'reassign', toId: f.toId, text: f.text })}>{busy ? 'Saving…' : 'Reassign'}</button>
            </div>
          )}
        </div>
      )}

      {error && <div className="mx-4 mt-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm px-3 py-2">{error}</div>}

      <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-3 border-b border-slate-100">
        <Info label="Phone" value={lead.phone} />
        <Info label="Email" value={lead.email} />
        <Info label="City" value={[lead.city, lead.state].filter(Boolean).join(', ')} />
        <Info label="Zone" value={lead.zone} />
        <Info label="Requirement" value={lead.requirement} />
        <Info label="Quantity" value={lead.quantity} />
        <Info label="Segment" value={lead.segment} />
        <Info label="Company" value={[lead.company, lead.designation].filter(Boolean).join(', ')} />
        <Info label="Campaign" value={[lead.utmMedium, lead.utmCampaign].filter(Boolean).join(' · ')} />
        <Info label="Meeting" value={lead.meetingDate ? `${shortDate(lead.meetingDate)} ${lead.meetingTime}`.trim() : ''} />
        <Info label={lead.outcome === 'Closed' ? 'OPF and value' : 'Reason'} value={lead.outcome === 'Closed' ? [lead.opf, lead.orderValue].filter(Boolean).join(' · ') : lead.reason} />
        <div className="col-span-2"><Info label="Notes" value={lead.notes} /></div>
      </div>

      <div className="p-4">
        <h3 className="text-sm font-bold text-slate-800 mb-3">Timeline</h3>
        {timeline === null && <div className="text-sm text-slate-500">Loading…</div>}
        {timeline && timeline.length === 0 && <div className="text-sm text-slate-500">Nothing yet.</div>}
        <ol className="space-y-4">
          {timeline && [...timeline].reverse().map((t, i) => (
            <li key={i} className="border-l-2 border-slate-200 pl-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold text-slate-900">{t.type}{t.byName ? ` · ${t.byName}` : ''}</span>
                <span className="text-[11px] text-slate-400 shrink-0">{when(t.time)}</span>
              </div>
              {t.text && <div className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">{t.text}</div>}
              {(t.fromName || t.toName) && <div className="text-xs text-slate-500 mt-0.5">{t.fromName ? `${t.fromName} to ` : 'To '}{t.toName}</div>}
              {t.nextFollowUp && <div className="text-xs text-slate-500 mt-0.5">Next follow-up {shortDate(t.nextFollowUp)}</div>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
