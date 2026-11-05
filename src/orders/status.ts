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

/**
 * Rows come from the Salesman Dashboard tab as: OPF Number, Timestamp, Planning, Actual, Status, Remarks.
 * An order can be submitted more than once, so the last row for an OPF is the one that counts.
 */
export function parseOrderRows(rows: string[][]): Record<string, OrderStatus> {
  const out: Record<string, OrderStatus> = {};
  for (const r of rows) {
    const key = normOpf(r[0]);
    const state = stateOf(r[4]);
    if (!key || !state) continue; // skips the header row and blank rows
    out[key] = { status: state, sent: String(r[1] || '').trim(), planned: String(r[2] || '').trim(), actual: String(r[3] || '').trim(), remarks: String(r[5] || '').trim() };
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
