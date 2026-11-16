import React, { useEffect, useState } from 'react';
import { ChevronLeft, Phone, MessageCircle, Mail, FileText, Plus } from 'lucide-react';
import { crmAction, fetchTimeline, CrmData } from './api';
import { Lead, TimelineEntry, SALES_STAGES, MEETING_TYPES, normStage, nextSalesStage, plannedOf, isOverdue, stepLabel } from './constants';
import { Field, Combo, opts, inputCls, areaCls, btnPrimary, btnGhost, btnSm, DateField, Tag, KindTag, Stepper, dueText, fullName, shortDate, todayStr } from './ui';

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
    <div className={`grid border border-slate-300 rounded-md overflow-hidden`} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
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

export function LeadPanel({ lead, data, onChanged, onClose, onQuote }: { lead: Lead; data: CrmData; onChanged: () => Promise<void> | void; onClose: () => void; onQuote?: (lead: Lead, reuse?: { no: string; asPI: boolean }) => void }) {
  const me = data.me;
  const iOwn = lead.ownerId === me.id;
  const quotes = (data.quotes || []).filter(q => q.enquiryNo === lead.enquiryNo).sort((a, b) => b.date.localeCompare(a.date));
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

  const due = dueText(lead);
  const sec = 'px-4 md:px-5 py-4 border-b border-slate-200';
  const h3 = 'text-[13px] font-extrabold text-slate-900';
  const nbdNotes = lead.nbdId && lead.nbdId !== me.id && (lead.ownerTeam === 'Sales' || lead.salesId)
    ? (timeline || []).filter(t => t.byId === lead.nbdId && t.text && t.type !== 'Created') : [];

  return (
    <div className="bg-white border border-slate-200 rounded-lg md:border-0 md:rounded-none">
      <div className="px-4 md:px-5 py-3.5 border-b border-slate-200 flex items-start gap-3 md:sticky md:top-0 bg-white z-20 rounded-t-lg">
        <button onClick={onClose} aria-label="Back to list" className="md:hidden h-10 w-10 -ml-1 rounded-md border border-slate-300 flex items-center justify-center shrink-0"><ChevronLeft size={20} /></button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-extrabold text-slate-900 truncate leading-tight">{fullName(lead)}</h2>
            <KindTag lead={lead} />
          </div>
          <div className="text-xs text-slate-500 mt-1">{lead.enquiryNo} · {lead.source}{lead.ownerName ? ` · with ${lead.ownerName}` : ' · needs a caller'}</div>
        </div>
      </div>

      {open ? (
        <div className={`${sec} ${overdue ? 'bg-rose-50/60' : ''}`}>
          <Stepper stage={stage} />
          <div className="mt-3.5 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-slate-500">{stepLabel(stage)}{planned ? ` · due ${shortDate(planned)}` : ''}</div>
              <div className={`text-lg font-extrabold leading-tight mt-0.5 ${overdue ? 'text-rose-700' : 'text-slate-900'}`}>{due.text || 'No follow-up date set'}</div>
            </div>
            {canUpdate && (
              <button onClick={() => { setPanel(panel === 'update' ? null : 'update'); setError(''); }} aria-expanded={panel === 'update'}
                className={`${panel === 'update' ? btnGhost : btnPrimary} !h-11 shrink-0 min-w-[104px]`}>{panel === 'update' ? 'Cancel' : 'Update'}</button>
            )}
          </div>
        </div>
      ) : (
        <div className={`${sec} bg-slate-50 flex items-center justify-between gap-3`}>
          <div className="min-w-0">
            <Tag text={lead.outcome} />
            <div className="text-sm text-slate-700 mt-1">
              {lead.outcome === 'Closed' ? [lead.opf && `OPF ${lead.opf}`, lead.orderValue && `Rs. ${Number(lead.orderValue).toLocaleString('en-IN')}`].filter(Boolean).join(' · ') || 'Order closed' : lead.reason || 'No reason recorded'}
            </div>
          </div>
          {canReopen && panel !== 'reopen' && <button className={`${btnGhost} !h-10 shrink-0`} onClick={() => { setPanel('reopen'); setError(''); }}>Reopen lead</button>}
        </div>
      )}

      {(canUpdate && panel === 'update') && (
        <div className="px-4 md:px-5 py-4 border-b border-slate-200 bg-slate-50 space-y-3">
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
                    className={`min-h-[44px] rounded-md border text-[13px] font-bold ${f.mtype === m ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'}`}>{m}</button>
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

          {error && <div className="rounded-md border border-rose-200 bg-rose-50 text-rose-800 text-sm px-3 py-2">{error}</div>}
          <div className="sticky bottom-16 md:bottom-0 bg-slate-50 pt-2 pb-1 -mb-1 z-10">
            {moveTo && <div className="text-xs text-slate-500 mb-2">Moves to: <span className="font-bold text-slate-800">{moveTo}</span></div>}
            <button className={`${btnPrimary} w-full`} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      )}

      {canReopen && panel === 'reopen' && (
        <div className={`${sec} bg-slate-50/60 space-y-3`}>
          <Field label="Remarks"><textarea className={areaCls} rows={2} value={f.text} onChange={e => set('text', e.target.value)} placeholder="Why is it back?" /></Field>
          {nextField}
          <div className="grid grid-cols-2 gap-3">
            <button className={btnGhost} onClick={() => setPanel(null)}>Cancel</button>
            <button className={btnPrimary} disabled={busy} onClick={() => run({ action: 'reopen', nextFollowUp: f.next, text: f.text })}>{busy ? 'Saving…' : 'Reopen lead'}</button>
          </div>
        </div>
      )}

      {error && panel !== 'update' && <div className="mx-4 md:mx-5 mt-3 rounded-md border border-rose-200 bg-rose-50 text-rose-800 text-sm px-3 py-2">{error}</div>}

      <div className={`${sec} @container`}>
        <div className={`grid gap-2 ${lead.email ? 'grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.8fr)]' : 'grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]'}`}>
          <a href={`tel:+91${digits}`} className="h-11 px-2 rounded-md bg-teal-50 text-teal-900 border border-teal-200 text-sm font-bold hover:bg-teal-100 inline-flex items-center justify-center gap-2 whitespace-nowrap"><Phone size={16} className="shrink-0" /><span className="tabular-nums">{digits.length === 10 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : 'Call'}</span></a>
          <a href={`https://wa.me/91${digits}`} target="_blank" rel="noreferrer" className={`${btnGhost} !h-11 !px-2 whitespace-nowrap`}><MessageCircle size={16} className={`shrink-0 ${lead.email ? 'hidden @sm:block' : ''}`} />WhatsApp</a>
          {lead.email && <a href={`mailto:${lead.email}`} className={`${btnGhost} !h-11 !px-2 whitespace-nowrap`}><Mail size={16} className="shrink-0 hidden @sm:block" />Email</a>}
        </div>
      </div>

      {nbdNotes.length > 0 && (
        <div className={`${sec} bg-slate-50`}>
          <h3 className={h3}>What {lead.nbdName || 'the sales coordinator'} did on this lead</h3>
          <div className="text-xs text-slate-500 mt-0.5 mb-3">Read this before you talk to the customer.</div>
          <ul className="space-y-3">
            {[...nbdNotes].reverse().slice(0, 5).map((t, i) => (
              <li key={i} className="text-sm border-l-2 border-teal-700 pl-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-bold text-slate-900">{t.type}</span>
                  <span className="text-[11px] text-slate-500 shrink-0">{when(t.time)}</span>
                </div>
                <div className="text-slate-700 whitespace-pre-wrap">{t.text}</div>
                {t.nextFollowUp && <div className="text-xs text-slate-500">Next follow-up {shortDate(t.nextFollowUp)}</div>}
              </li>
            ))}
          </ul>
          {nbdNotes.length > 5 && <div className="text-xs text-slate-500 mt-2">The full history is in the timeline below.</div>}
        </div>
      )}

      <div className={sec}>
        <h3 className={`${h3} mb-3`}>Details</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Info label="Requirement" value={lead.requirement} />
          <Info label="Quantity" value={lead.quantity} />
          <Info label="City" value={[lead.city, lead.state].filter(Boolean).join(', ')} />
          <Info label="Zone" value={lead.zone} />
          <Info label="Phone" value={lead.phone} />
          <Info label="Email" value={lead.email} />
          <Info label="Meeting" value={lead.meetingDate ? `${shortDate(lead.meetingDate)} ${lead.meetingTime}`.trim() : ''} />
          <Info label="Segment" value={lead.segment} />
          <Info label="Company" value={[lead.company, lead.designation].filter(Boolean).join(', ')} />
          <Info label="Campaign" value={[lead.utmMedium, lead.utmCampaign].filter(Boolean).join(' · ')} />
          <Info label="NBD (first caller)" value={lead.nbdName} />
          <Info label="Salesperson" value={lead.salesName} />
          <div className="col-span-2"><Info label="Notes" value={lead.notes} /></div>
        </div>
      </div>

      {((onQuote && iOwn && open) || quotes.length > 0) && (
        <div className={sec}>
          <div className="flex items-center justify-between gap-3">
            <h3 className={h3}>Quotations{quotes.length > 0 && <span className="ml-1.5 font-bold text-slate-400 tabular-nums">{quotes.length}</span>}</h3>
            {onQuote && iOwn && open && <button onClick={() => onQuote(lead)} className={btnSm}><Plus size={14} /> New quotation</button>}
          </div>
          {quotes.length > 0 ? (
            <ul className="mt-2 divide-y divide-slate-100">
              {quotes.map(q => (
                <li key={q.quoteNo} className="py-3 last:pb-0">
                  <div className="flex items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900">{q.quoteNo}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{q.docType === 'PI' ? 'Proforma invoice' : 'Quotation'} · {q.brand} · {shortDate(q.date)}{q.byName ? ` · ${q.byName}` : ''}</div>
                      {q.convertedTo && <div className="text-xs text-slate-500">Converted to {q.convertedTo}</div>}
                    </div>
                    <div className="font-extrabold text-slate-900 shrink-0 tabular-nums">Rs. {Number(q.amount || 0).toLocaleString('en-IN')}</div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {q.pdfUrl
                      ? <a href={q.pdfUrl} target="_blank" rel="noreferrer" className={btnSm}><FileText size={14} /> View PDF</a>
                      : <span className="h-9 px-3 rounded-md bg-slate-50 text-slate-500 text-xs inline-flex items-center">PDF is being prepared. Refresh in a moment.</span>}
                    {onQuote && iOwn && open && q.docType === 'Quotation' && <button onClick={() => onQuote(lead, { no: q.quoteNo, asPI: false })} className={btnSm}>Revise</button>}
                    {onQuote && iOwn && open && q.docType === 'Quotation' && !q.convertedTo && (
                      <button onClick={() => onQuote(lead, { no: q.quoteNo, asPI: true })} className={`${btnSm} !border-teal-700 !text-teal-800`}>Convert to PI</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : <div className="mt-1 text-xs text-slate-500">No quotation made for this lead yet.</div>}
        </div>
      )}

      <div className="px-4 md:px-5 py-4">
        <h3 className={`${h3} mb-3`}>Timeline</h3>
        {timeline === null && <div className="text-sm text-slate-500">Loading…</div>}
        {timeline && timeline.length === 0 && <div className="text-sm text-slate-500">Nothing yet.</div>}
        <ol className="border-l border-slate-200 ml-1 space-y-4">
          {timeline && [...timeline].reverse().map((t, i) => (
            <li key={i} className="relative pl-4">
              <span className={`absolute -left-[4.5px] top-1.5 h-2 w-2 ${i === 0 ? 'bg-teal-700' : 'bg-slate-300'}`} aria-hidden />
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold text-slate-900">{t.type}{t.byName ? <span className="font-normal text-slate-500"> · {t.byName}</span> : ''}</span>
                <span className="text-[11px] text-slate-500 shrink-0">{when(t.time)}</span>
              </div>
              {t.text && <div className="text-sm text-slate-700 mt-0.5 whitespace-pre-wrap">{t.text}</div>}
              {(t.fromName || t.toName) && <div className="text-xs text-slate-500 mt-0.5">{t.fromName ? `${t.fromName} to ` : 'To '}{t.toName}</div>}
              {t.nextFollowUp && <div className="text-xs text-slate-500 mt-0.5">Next follow-up {shortDate(t.nextFollowUp)}</div>}
            </li>
          ))}
        </ol>
      </div>

      {open && boss && (
        <div className="px-4 md:px-5 py-3 border-t border-slate-200 space-y-3">
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
    </div>
  );
}
