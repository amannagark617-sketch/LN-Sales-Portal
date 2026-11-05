export type OrderState = 'Pending' | 'Done' | 'On hold' | 'Rejected';

export interface OrderStatus {
  status: OrderState;
  /** when the salesperson submitted the form (Timestamp column) */
  sent: string;
  /** time the operations team planned to finish it */
  planned: string;
  /** time they actually finished it */
  actual: string;
  /** remarks written by the operations team */
  remarks: string;
}

/** The OPF number as typed in the form can carry spaces or tabs, so compare on a cleaned version. */
export const normOpf = (s: string) => String(s || '').replace(/\s+/g, '').toUpperCase();

const stateOf = (s: string): OrderState | null => {
  const t = String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (t === 'done') return 'Done';
  if (t === 'pending') return 'Pending';
  if (t === 'on hold' || t === 'onhold' || t === 'hold') return 'On hold';
  if (t === 'rejected' || t === 'reject') return 'Rejected';
  return null;
};

export const DOC_LABELS = ['Work Order Form', 'PI', 'Layout', 'Commission Sheet', 'OPF'] as const;

export interface OrderDoc { label: string; links: string[] }

/** One time the order went to operations. An order can be sent again after a revision. */
export interface Submission {
  sent: string;
  status: OrderState;
  planned: string;
  actual: string;
  remarks: string;
  docs: OrderDoc[];
}

export interface OrderHistory extends OrderStatus {
  /** newest first; the first entry is the current one */
  submissions: Submission[];
}

const linksIn = (cell: string): string[] => String(cell || '').match(/https?:\/\/[^\s,;"]+/g) || [];

/**
 * Rows come from the Salesman Dashboard tab as:
 * OPF Number, Timestamp, Work Order Form, PI, Layout, Commission Sheet, OPF, Planning, Actual, Status, Remarks.
 * An order can be submitted more than once (a revised order), so every row is kept, newest first.
 * Status, planned and actual always come from the newest row.
 */
export function parseOrderRows(rows: string[][]): Record<string, OrderHistory> {
  const byOpf: Record<string, Submission[]> = {};
  for (const r of rows) {
    const key = normOpf(r[0]);
    const state = stateOf(r[9]);
    if (!key || !state) continue; // skips the header row and blank rows
    const docs: OrderDoc[] = DOC_LABELS.map((label, i) => ({ label, links: linksIn(r[2 + i]) })).filter(d => d.links.length);
    (byOpf[key] ||= []).push({
      sent: String(r[1] || '').trim(), status: state,
      planned: String(r[7] || '').trim(), actual: String(r[8] || '').trim(),
      remarks: String(r[10] || '').trim(), docs,
    });
  }
  const out: Record<string, OrderHistory> = {};
  for (const key of Object.keys(byOpf)) {
    const subs = byOpf[key].slice().reverse().slice(0, 6);
    const cur = subs[0];
    out[key] = { status: cur.status, sent: cur.sent, planned: cur.planned, actual: cur.actual, remarks: cur.remarks, submissions: subs };
  }
  return out;
}

/** Remarks like PROCESS, DONE or Pending only repeat the status, so they are not worth showing. */
export const usefulRemark = (s: OrderStatus): string => {
  const t = s.remarks.trim();
  if (!t) return '';
  if (/^(process|proces|prcoess|done|pending|ok)\.?$/i.test(t)) return '';
  return t;
};
