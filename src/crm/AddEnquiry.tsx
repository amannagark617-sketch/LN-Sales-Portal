import React, { useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { crmAction, CrmData } from './api';
import { Field, inputCls, areaCls, btnPrimary, btnGhost, todayStr, Tag, fullName } from './ui';
import { ZONE_OF_STATE, Lead } from './constants';

const EMPTY = {
  source: '', segment: '', title: '', firstName: '', lastName: '', company: '', designation: '', phone: '', email: '',
  city: '', state: '', zone: '', requirement: '', quantity: '', notes: '',
};

export function AddEnquiry({ data, onSaved, onOpen }: { data: CrmData; onSaved: () => void; onOpen: (enq: string) => void }) {
  const [f, setF] = useState({ ...EMPTY });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dup, setDup] = useState<any>(null);
  const [done, setDone] = useState<{ enquiryNo: string; ownerName?: string; waiting?: boolean; added?: string } | null>(null);
  const set = (k: keyof typeof EMPTY, v: string) => setF(p => ({ ...p, [k]: v }));

  const lists = data.lists;
  const nbdSources = lists.Source.filter(s => s.group === 'NBD');
  const directSources = lists.Source.filter(s => s.group === 'Direct');
  const phoneKey = f.phone.replace(/\D/g, '').slice(-10);
  const seen: Lead | undefined = useMemo(
    () => (phoneKey.length === 10 ? data.leads.find(l => l.phone.replace(/\D/g, '').slice(-10) === phoneKey) : undefined),
    [phoneKey, data.leads],
  );

  const submit = async (decision?: 'note' | 'new') => {
    setError('');
    if (!f.source) return setError('Choose the lead source.');
    if (!f.firstName.trim()) return setError('Enter the customer name.');
    if (phoneKey.length < 10) return setError('Enter a 10 digit phone number.');
    if (!f.city.trim()) return setError('Enter the city.');
    if (!f.state) return setError('Choose the state.');
    if (!f.requirement) return setError('Choose the requirement.');
    setBusy(true);
    try {
      const out = await crmAction({ action: 'add-enquiry', decision, fields: { ...f, zone: f.zone || ZONE_OF_STATE[f.state] || '' } });
      if (out.duplicate) { setDup(out.duplicate); return; }
      setDup(null);
      setDone(out);
      onSaved();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 text-center max-w-xl mx-auto">
        <CheckCircle2 className="mx-auto text-emerald-600" size={40} />
        <div className="mt-3 text-sm text-slate-500">{done.added === 'note' ? 'Added to the existing lead' : 'Enquiry saved'}</div>
        <div className="text-3xl font-extrabold text-slate-900 mt-1 tracking-tight">{done.enquiryNo}</div>
        <div className="text-sm text-slate-600 mt-2">
          {done.waiting ? 'No NBD person is present right now. It will go to the first one who is.' : done.ownerName ? `With ${done.ownerName}` : ''}
        </div>
        <div className="grid grid-cols-2 gap-3 mt-6">
          <button className={btnGhost} onClick={() => { setDone(null); setF({ ...EMPTY }); }}>Add another</button>
          <button className={btnPrimary} onClick={() => onOpen(done.enquiryNo)}>Open lead</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white border border-slate-200 rounded-xl p-4 md:p-6 space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Add enquiry</h2>

        <Field label="Lead source" required>
          <select className={inputCls} value={f.source} onChange={e => set('source', e.target.value)}>
            <option value="">Select source</option>
            <optgroup label="Met the customer directly">
              {directSources.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
            </optgroup>
            <optgroup label="Online and marketing (goes to NBD)">
              {nbdSources.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
            </optgroup>
          </select>
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Phone" required>
            <input className={inputCls} inputMode="tel" placeholder="10 digit mobile" value={f.phone} onChange={e => set('phone', e.target.value)} />
          </Field>
          <Field label="Name" required>
            <div className="grid grid-cols-[84px_1fr] gap-2">
              <select className={inputCls} value={f.title} onChange={e => set('title', e.target.value)}>
                <option value="">Title</option>
                {lists.Title.map(t => <option key={t}>{t}</option>)}
              </select>
              <input className={inputCls} placeholder="First name" value={f.firstName} onChange={e => set('firstName', e.target.value)} />
            </div>
          </Field>
        </div>

        {seen && (
          <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <div>
              This number is already in the system as <b>{seen.enquiryNo}</b> ({fullName(seen)}), {seen.outcome === 'Open' ? `with ${seen.ownerName || 'no one yet'}` : seen.outcome.toLowerCase()}.
              You can still continue, and you will be asked what to do.
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Last name"><input className={inputCls} value={f.lastName} onChange={e => set('lastName', e.target.value)} /></Field>
          <Field label="Email"><input className={inputCls} type="email" inputMode="email" value={f.email} onChange={e => set('email', e.target.value)} /></Field>
          <Field label="City" required><input className={inputCls} value={f.city} onChange={e => set('city', e.target.value)} /></Field>
          <Field label="State" required>
            <select className={inputCls} value={f.state} onChange={e => set('state', e.target.value)}>
              <option value="">Select state</option>
              {lists.State.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Requirement" required>
            <select className={inputCls} value={f.requirement} onChange={e => set('requirement', e.target.value)}>
              <option value="">Select requirement</option>
              {lists.Requirement.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Quantity"><input className={inputCls} inputMode="numeric" value={f.quantity} onChange={e => set('quantity', e.target.value)} /></Field>
          <Field label="Segment">
            <select className={inputCls} value={f.segment} onChange={e => set('segment', e.target.value)}>
              <option value="">Select segment</option>
              {lists.Segment.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Company"><input className={inputCls} value={f.company} onChange={e => set('company', e.target.value)} /></Field>
          <Field label="Designation">
            <select className={inputCls} value={f.designation} onChange={e => set('designation', e.target.value)}>
              <option value="">Select</option>
              {lists.Designation.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Date"><input className={inputCls} value={todayStr()} disabled /></Field>
        </div>

        <Field label="Notes"><textarea className={areaCls} rows={3} value={f.notes} onChange={e => set('notes', e.target.value)} placeholder="Anything the next person should know" /></Field>

        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-sm px-3 py-2">{error}</div>}

        <button className={`${btnPrimary} w-full`} disabled={busy} onClick={() => submit()}>{busy ? 'Saving…' : 'Save enquiry'}</button>
      </div>

      {dup && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end md:items-center justify-center p-0 md:p-6">
          <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-amber-700 font-bold"><AlertTriangle size={18} /> This customer already exists</div>
            <div className="text-sm text-slate-700 space-y-1">
              <div><b>{dup.enquiryNo}</b>, {dup.name || 'no name'}</div>
              <div>Source: {dup.source || '—'}</div>
              <div>{dup.outcome === 'Open' ? `Stage ${dup.stage}, with ${dup.ownerName || 'no one yet'}` : dup.outcome}</div>
            </div>
            <div className="space-y-2">
              <button className={`${btnPrimary} w-full`} disabled={busy} onClick={() => submit('note')}>Add this to the existing lead</button>
              <button className={`${btnGhost} w-full`} disabled={busy} onClick={() => submit('new')}>Create a new enquiry anyway</button>
              <button className="w-full h-10 text-sm font-bold text-slate-500" onClick={() => setDup(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
