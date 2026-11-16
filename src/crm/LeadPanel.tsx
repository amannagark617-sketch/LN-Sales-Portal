import React, { useEffect, useState } from 'react';
import { ChevronLeft, Phone, MessageCircle, Mail } from 'lucide-react';
import { crmAction, fetchTimeline, CrmData } from './api';
import { Lead, TimelineEntry, SALES_STAGES, MEETING_TYPES, normStage, nextSalesStage, plannedOf, isOverdue, stepLabel } from './constants';
import { Field, Combo, opts, inputCls, areaCls, btnPrimary, btnGhost, DateField, Tag, KindTag, fullName, shortDate, todayStr } from './ui';

type Status = 'Open' | 'Lost' | 'Invalid' | 'Closed';

function Group({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label}>
      <div className="text-xs font-bold text-slate-600 mb-1.5">{label}{required && <span className="text-rose-600"> *</span>}</div>
      {children}
    </div>
  );
}

function Choice<T extends string>({ options, value, onChange, labels }: { options: T[]; value: T | ''; onChange: (v: T) => void; labels?: Partial<Record<T, string>> }) {
  return (
    <div className={`grid border border-slate-300 rounded-lg overflow-hidden`} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(o => (
        <button key={o} type="button" onClick={() => onChange(o)}
          className={`min-h-[44px] px-1 text-[13px] font-bold border-r border-slate-300 last:border-r-0 leading-tight ${value === o ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>{labels?.[o] || o}</button>
      ))}
    </div>
  );
}

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
  const blank = { conn: '' as '' | 'Connected' | 'Not connected', sub: '' as '' | 'Valid' | 'Invalid' | 'Call again', status: '' as Status | '', assign: 'Myself', mtype: '', text: '', next: '', toId: '', date: '', time: '', reason: '', opf: '', value: '' };
  const [f, setF] = useState(blank);
  const set = (k: keyof typeof blank, v: any) => setF(p => ({ ...p, [k]: v }));

  const loadTimeline = () => fetchTimeline(lead.enquiryNo).then(setTimeline).catch(() => setTimeline([]));
  useEffect(() => { setPanel(null); setError(''); setTimeline(null); setF(blank); loadTimeline(); }, [lead.enquiryNo]);

  const stage = normStage(lead.stage);
  const isOwner = lead.ownerId === me.id;
  const isMine = isOwner || (me.team === 'NBD' && !lead.ownerId);
  const boss = me.admin || me.isManager || me.team === 'Manager';
  const open = lead.outcome === 'Open';
  const canUpdate = open && (isMine || boss);
  const ctx: 'call' | 'nbd' | 'sales' = lead.ownerTeam === 'Sales' ? 'sales' : (stage === 'New' || stage === 'Not connected') ? 'call' : 'nbd';
  const canAlign = lead.ownerTeam === 'NBD' && (isOwner || me.admin);
  const canBack = lead.ownerTeam === 'Sales' && (isOwner || me.admin) && (stage === 'Send proposal' || stage === 'Negotiation');
  const canReopen = !open && lead.outcome !== 'Closed' && (isMine || boss);
  const planned = plannedOf(lead);
  const overdue = isOverdue(lead);
  const salesDefault = lead.salesId && data.sales.some(s => s.id === lead.salesId) ? lead.salesId : '';

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

  const need = (ok: any, msg: string) => { if (!ok) { setError(msg); return false; } return true; };

  const save = () => {
    setError('');
    const invalid = () => need(f.reason, 'Pick a reason') && run({ action: 'mark-invalid', reason: f.reason, text: f.text, type: f.mtype });
    if (ctx === 'call') {
      if (!need(f.conn, 'Choose Connected or Not connected') || !need(f.sub, 'Choose an option')) return;
      if (f.sub === 'Invalid') return invalid();
      if (!need(f.next, 'Pick the next follow-up date')) return;
      if (f.sub === 'Call again') return run({ action: 'log-activity', type: 'Call', stage: 'Not connected', text: f.text, nextFollowUp: f.next });
      if (!need(f.text.trim(), 'Write the remarks')) return;
      return run({ action: 'log-activity', type: 'Call', stage: 'Follow-up', text: f.text, nextFollowUp: f.next });
    }
    if (ctx === 'sales' && !need(f.mtype, 'Choose the type of meeting')) return;
    if (!need(f.status, 'Choose the status')) return;
    if (f.status === 'Invalid') return invalid();
    if (f.status === 'Lost') return need(f.reason, 'Pick a reason') && run({ action: 'mark-lost', reason: f.reason, text: f.text, type: f.mtype });
    if (f.status === 'Closed') return need(f.opf.trim() && f.value, 'Enter the OPF number and order value') && run({ action: 'close-lead', opf: f.opf, orderValue: f.value, text: f.text, type: f.mtype });
    if (!need(f.text.trim(), 'Write the remarks')) return;
    if (ctx === 'nbd') {
      if (canAlign && f.assign === 'Salesperson') {
        const toId = f.toId || salesDefault;
        if (!need(toId, 'Pick a salesperson') || !need(f.date, 'Pick the meeting date')) return;
        return run({ action: 'align', toId, meetingDate: f.date, meetingTime: f.time, text: f.text });
      }
      if (!need(f.next, 'Pick the next follow-up date')) return;
      return run({ action: 'log-activity', type: 'Follow-up', stage, text: f.text, nextFollowUp: f.next });
    }
    if (!need(f.next, 'Pick the next follow-up date')) return;
    if (canBack && f.assign === 'Sales coordinator') return run({ action: 'send-back', type: f.mtype, toId: f.toId, text: f.text, nextFollowUp: f.next });
    return run({ action: 'log-activity', type: f.mtype, stage: nextSalesStage(stage), text: f.text, nextFollowUp: f.next });
  };

  const digits = lead.phone.replace(/\D/g, '').slice(-10);
  const people = [...data.nbd.map(n => ({ id: n.id, name: `${n.name} (NBD)` })), ...data.sales.map(s => ({ id: s.id, name: `${s.name} (${s.showroom || s.region})` }))];
  const reasons = (st: string) => (st === 'Invalid' ? data.lists.InvalidReason : data.lists.LostReason);

  const reasonFields = (st: string) => (
    <>
      <Field label="Reason" required>
        <Combo value={f.reason} onChange={v => set('reason', v)} placeholder="Search reason" options={opts(reasons(st))} />
      </Field>
      <Field label="Remarks"><textarea className={areaCls} rows={2} value={f.text} onChange={e => set('text', e.target.value)} /></Field>
    </>
  );
  const remarks = (req = true) => <Field label="Remarks" required={req}><textarea className={areaCls} rows={3} value={f.text} onChange={e => set('text', e.target.value)} placeholder="What did the customer say?" /></Field>;
  const nextField = <Field label="Next follow-up date" required><DateField value={f.next} onChange={v => set('next', v)} /></Field>;
  const closedFields = (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="OPF number" required><input className={inputCls} value={f.opf} onChange={e => set('opf', e.target.value)} /></Field>
        <Field label="Order value" required><input className={inputCls} inputMode="numeric" value={f.value} onChange={e => set('value', e.target.value.replace(/[^\d.]/g, ''))} /></Field>
      </div>
      <Field label="Remarks"><textarea className={areaCls} rows={2} value={f.text} onChange={e => set('text', e.target.value)} /></Field>
    </>
  );

  let moveTo = '';
  if (ctx === 'call' && f.sub === 'Valid') moveTo = 'Follow-up';
  if (ctx === 'call' && f.sub === 'Call again') moveTo = 'Not connected';
  if (ctx === 'nbd' && f.status === 'Open') moveTo = canAlign && f.assign === 'Salesperson' ? `${SALES_STAGES.includes(stage) ? stage : '1st meeting'} with the salesperson` : stage;
  if (ctx === 'sales' && f.status === 'Open') moveTo = canBack && f.assign === 'Sales coordinator' ? `${lead.nbdName || 'the sales coordinator'}` : nextSalesStage(stage);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex items-start gap-3">
        <button onClick={onClose} aria-label="Back to list" className="md:hidden h-10 w-10 -ml-1 rounded-lg border border-slate-200 flex items-center justify-center shrink-0"><ChevronLeft size={20} /></button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-extrabold text-slate-900 truncate">{fullName(lead)}</h2>
            <Tag text={open ? stage : lead.outcome} />
            <KindTag lead={lead} />
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
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-500">{stepLabel(stage)} · planned</div>
            <div className={`text-base font-extrabold ${overdue ? 'text-rose-700' : 'text-slate-900'}`}>{planned ? shortDate(planned) : 'Not set'}{overdue ? ' · Overdue' : ''}</div>
          </div>
          {canUpdate && <button onClick={() => { setPanel(panel === 'update' ? null : 'update'); setError(''); }} className={`${btnPrimary} shrink-0`}>Update</button>}
        </div>
      )}

      {(canUpdate && panel === 'update') && (
        <div className="p-4 border-b border-slate-100 space-y-3">
          {ctx === 'call' && (
            <>
              <Group label="Call result" required>
                <Choice options={['Connected', 'Not connected'] as const as any} value={f.conn} onChange={(v: any) => setF(p => ({ ...p, conn: v, sub: v === 'Connected' ? '' : 'Call again', reason: '' }))} />
              </Group>
              {f.conn === 'Connected' && (
                <Group label="Lead is" required>
                  <Choice options={['Valid', 'Invalid'] as any} value={f.sub} onChange={(v: any) => setF(p => ({ ...p, sub: v, reason: '' }))} />
                </Group>
              )}
              {f.conn === 'Not connected' && (
                <Choice options={['Call again', 'Invalid'] as any} value={f.sub} onChange={(v: any) => setF(p => ({ ...p, sub: v, reason: '' }))} labels={{ 'Invalid': 'Invalid number' } as any} />
              )}
              {f.sub === 'Valid' && <>{remarks()}{nextField}</>}
              {f.sub === 'Call again' && <>{nextField}{remarks(false)}</>}
              {f.sub === 'Invalid' && reasonFields('Invalid')}
            </>
          )}

          {ctx === 'sales' && (
            <Group label="Type of meeting" required>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {MEETING_TYPES.map(m => (
                  <button key={m} type="button" onClick={() => set('mtype', m)}
                    className={`min-h-[44px] rounded-lg border text-[13px] font-bold ${f.mtype === m ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}>{m}</button>
                ))}
              </div>
            </Group>
          )}

          {ctx !== 'call' && (
            <>
              <Group label="Status" required>
                <Choice options={['Open', 'Lost', 'Invalid', 'Closed'] as Status[]} value={f.status} onChange={v => setF(p => ({ ...p, status: v, reason: '' }))} />
              </Group>
              {f.status === 'Open' && (
                <>
                  {remarks()}
                  {ctx === 'nbd' && canAlign && (
                    <Group label="Assigned to">
                      <Choice options={['Myself', 'Salesperson'] as any} value={f.assign as any} onChange={(v: any) => setF(p => ({ ...p, assign: v, toId: '' }))} />
                    </Group>
                  )}
                  {ctx === 'nbd' && canAlign && f.assign === 'Salesperson' ? (
                    <>
                      <Field label="Salesperson" required hint={salesDefault ? `Last with ${lead.salesName}. Change it if needed.` : undefined}>
                        <Combo value={f.toId || salesDefault} onChange={v => set('toId', v)} placeholder="Search salesperson"
                          options={data.sales.map(s => ({ value: s.id, label: `${s.name} · ${s.showroom || s.region}` }))} />
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Meeting date" required><input type="date" className={inputCls} min={todayStr()} value={f.date} onChange={e => set('date', e.target.value)} /></Field>
                        <Field label="Meeting time"><input type="time" className={inputCls} value={f.time} onChange={e => set('time', e.target.value)} /></Field>
                      </div>
                    </>
                  ) : nextField}
                  {ctx === 'sales' && canBack && (
                    <Group label="Assigned to">
                      <Choice options={['Myself', 'Sales coordinator'] as any} value={f.assign as any} onChange={(v: any) => setF(p => ({ ...p, assign: v, toId: '' }))}
                        labels={{ 'Sales coordinator': lead.nbdName ? `${lead.nbdName} (NBD)` : 'Sales coordinator' } as any} />
                    </Group>
                  )}
                  {ctx === 'sales' && canBack && f.assign === 'Sales coordinator' && !lead.nbdName && (
                    <Field label="Sales coordinator" required>
                      <Combo value={f.toId} onChange={v => set('toId', v)} placeholder="Next NBD in rotation" clearLabel="Next NBD in rotation"
                        options={data.nbd.map(n => ({ value: n.id, label: n.name }))} />
                    </Field>
                  )}
                </>
              )}
              {(f.status === 'Lost' || f.status === 'Invalid') && reasonFields(f.status)}
              {f.status === 'Closed' && closedFields}
            </>
          )}

          {error && <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm px-3 py-2">{error}</div>}
          <div className="sticky bottom-16 md:bottom-0 bg-white pt-2 pb-1 -mb-1 z-10">
            {moveTo && <div className="text-xs text-slate-500 mb-2">Moves to: <span className="font-bold text-slate-800">{moveTo}</span></div>}
            <button className={`${btnPrimary} w-full`} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      )}

      {canReopen && (
        <div className="p-4 border-b border-slate-100 space-y-3">
          {panel !== 'reopen'
            ? <button className={btnGhost} onClick={() => { setPanel('reopen'); setError(''); }}>Reopen lead</button>
            : (
              <>
                <Field label="Remarks"><textarea className={areaCls} rows={2} value={f.text} onChange={e => set('text', e.target.value)} placeholder="Why is it back?" /></Field>
                {nextField}
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
                <Combo value={f.toId} onChange={v => set('toId', v)} placeholder="Search person" options={people.map(p => ({ value: p.id, label: p.name }))} />
              </Field>
              <Field label="Remarks"><textarea className={areaCls} rows={2} value={f.text} onChange={e => set('text', e.target.value)} /></Field>
              <button className={`${btnPrimary} w-full`} disabled={busy} onClick={() => run({ action: 'reassign', toId: f.toId, text: f.text })}>{busy ? 'Saving…' : 'Reassign'}</button>
            </div>
          )}
        </div>
      )}

      {error && panel !== 'update' && <div className="mx-4 mt-3 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm px-3 py-2">{error}</div>}

      {lead.nbdId && lead.nbdId !== me.id && (lead.ownerTeam === 'Sales' || lead.salesId) && (() => {
        const mine = (timeline || []).filter(t => t.byId === lead.nbdId && t.text && t.type !== 'Created');
        if (!mine.length) return null;
        return (
          <div className="p-4 border-b border-slate-100 bg-blue-50/50">
            <h3 className="text-sm font-bold text-slate-800 mb-0.5">What {lead.nbdName || 'the sales coordinator'} did on this lead</h3>
            <div className="text-xs text-slate-500 mb-3">Read this before you talk to the customer.</div>
            <ul className="space-y-3">
              {[...mine].reverse().slice(0, 5).map((t, i) => (
                <li key={i} className="text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-bold text-slate-900">{t.type}</span>
                    <span className="text-[11px] text-slate-400 shrink-0">{when(t.time)}</span>
                  </div>
                  <div className="text-slate-700 whitespace-pre-wrap">{t.text}</div>
                  {t.nextFollowUp && <div className="text-xs text-slate-500">Next follow-up {shortDate(t.nextFollowUp)}</div>}
                </li>
              ))}
            </ul>
            {mine.length > 5 && <div className="text-xs text-slate-500 mt-2">The full history is in the timeline below.</div>}
          </div>
        );
      })()}

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
