import React, { useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { crmAction, CrmData } from './api';
import { Field, Combo, opts, inputCls, areaCls, btnPrimary, btnGhost, fullName } from './ui';
import { ZONE_OF_STATE, Lead } from './constants';

const EMPTY = {
  source: '', segment: '', title: '', firstName: '', lastName: '', company: '', designation: '', phone: '', email: '',
  city: '', state: '', zone: '', requirement: '', quantity: '', notes: '',
};

export function AddEnquiry({ data, onSaved, onOpen, onCancel }: { data: CrmData; onSaved: () => void; onOpen: (enq: string) => void; onCancel?: () => void }) {
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
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center max-w-xl mx-auto">
        <CheckCircle2 className="mx-auto text-teal-700" size={40} />
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

  const part = (title: string, hint: string, children: React.ReactNode) => (
    <div className="px-4 md:px-6 py-5 border-b border-slate-200 last:border-b-0 md:grid md:grid-cols-[180px_minmax(0,1fr)] md:gap-6">
      <div className="mb-3 md:mb-0">
        <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500 mt-0.5">{hint}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );

  return (
    <div className="max-w-3xl">
      <div className="bg-white border border-slate-200 rounded-lg">
        <div className="px-4 md:px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold text-slate-900">Add enquiry</h2>
          {onCancel && <button className="hidden lg:block text-sm font-bold text-slate-500 hover:text-slate-800" onClick={onCancel}>Cancel</button>}
        </div>

        {part('Source', 'Where the lead came from decides who gets it.', (
          <Field label="Lead source" required>
            <Combo value={f.source} onChange={v => set('source', v)} placeholder="Search source"
              options={[
                ...directSources.map(s => ({ value: s.name, label: s.name, group: 'Met the customer directly' })),
                ...nbdSources.map(s => ({ value: s.name, label: s.name, group: 'Online and marketing (goes to NBD)' })),
              ]} />
          </Field>
        ))}

        {part('Customer', 'Phone and name are needed. The rest helps the next person.', (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Phone" required>
                <input className={inputCls} inputMode="tel" placeholder="10 digit mobile" value={f.phone} onChange={e => set('phone', e.target.value)} />
              </Field>
              <Field label="Email"><input className={inputCls} type="email" inputMode="email" value={f.email} onChange={e => set('email', e.target.value)} /></Field>
            </div>
            {seen && (
              <div className="flex gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                <div>
                  This number is already in the system as <b>{seen.enquiryNo}</b> ({fullName(seen)}), {seen.outcome === 'Open' ? `with ${seen.ownerName || 'no one yet'}` : seen.outcome.toLowerCase()}.
                  You can still continue, and you will be asked what to do.
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Name" required>
                <div className="grid grid-cols-[88px_1fr] gap-2">
                  <Combo value={f.title} onChange={v => set('title', v)} placeholder="Title" options={opts(lists.Title)} ariaLabel="Title" />
                  <input className={inputCls} placeholder="First name" value={f.firstName} onChange={e => set('firstName', e.target.value)} />
                </div>
              </Field>
              <Field label="Last name"><input className={inputCls} value={f.lastName} onChange={e => set('lastName', e.target.value)} /></Field>
              <Field label="City" required><input className={inputCls} value={f.city} onChange={e => set('city', e.target.value)} /></Field>
              <Field label="State" required>
                <Combo value={f.state} onChange={v => set('state', v)} placeholder="Search state" options={opts(lists.State)} />
              </Field>
              <Field label="Company"><input className={inputCls} value={f.company} onChange={e => set('company', e.target.value)} /></Field>
              <Field label="Designation">
                <Combo value={f.designation} onChange={v => set('designation', v)} placeholder="Search designation" options={opts(lists.Designation)} />
              </Field>
            </div>
          </>
        ))}

        {part('Requirement', 'What the customer is looking for.', (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Requirement" required>
                <Combo value={f.requirement} onChange={v => set('requirement', v)} placeholder="Search requirement" options={opts(lists.Requirement)} />
              </Field>
              <Field label="Quantity"><input className={inputCls} inputMode="numeric" value={f.quantity} onChange={e => set('quantity', e.target.value)} /></Field>
              <Field label="Segment">
                <Combo value={f.segment} onChange={v => set('segment', v)} placeholder="Search segment" options={opts(lists.Segment)} />
              </Field>
            </div>
            <Field label="Notes"><textarea className={areaCls} rows={3} value={f.notes} onChange={e => set('notes', e.target.value)} placeholder="Anything the next person should know" /></Field>
          </>
        ))}

        <div className="px-4 md:px-6 py-4 border-t border-slate-200 sticky bottom-16 lg:bottom-0 bg-white rounded-b-lg z-10">
          {error && <div className="rounded-md border border-rose-200 bg-rose-50 text-rose-800 text-sm px-3 py-2 mb-3">{error}</div>}
          <button className={`${btnPrimary} w-full md:w-auto md:min-w-[200px]`} disabled={busy} onClick={() => submit()}>{busy ? 'Saving…' : 'Save enquiry'}</button>
        </div>
      </div>

      {dup && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-end md:items-center justify-center p-0 md:p-6">
          <div className="bg-white w-full md:max-w-md rounded-t-lg md:rounded-lg p-5 space-y-4">
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
