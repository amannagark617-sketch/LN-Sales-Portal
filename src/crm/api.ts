import { getAuthHeaders } from '../services/dataService';
import type { Lead, TimelineEntry } from './constants';

export interface CrmMe { id: string; name: string; team: string; isManager: boolean; admin: boolean; }
export interface CrmLists {
  Source: { name: string; group: 'NBD' | 'Direct' }[];
  Segment: string[]; Title: string[]; Designation: string[]; Requirement: string[]; Zone: string[]; State: string[];
  LostReason: string[]; InvalidReason: string[];
}
export interface CrmQuote { enquiryNo: string; quoteNo: string; docType: 'Quotation' | 'PI'; brand: string; amount: string; linkedQuote: string; byName: string; date: string; }
export interface CrmData {
  leads: Lead[];
  quotes?: CrmQuote[];
  me: CrmMe;
  sales: { id: string; name: string; showroom: string; region: string }[];
  nbd: { id: string; name: string; present: boolean }[];
  lists: CrmLists;
  now: string;
}

async function parse(resp: Response) {
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(data.error || 'Something went wrong. Try again.');
  return data;
}

export async function fetchCrm(refresh = false): Promise<CrmData> {
  return parse(await fetch(`/api/crm/leads${refresh ? '?refresh=1' : ''}`, { headers: getAuthHeaders() }));
}

export async function fetchTimeline(enq: string): Promise<TimelineEntry[]> {
  const d = await parse(await fetch(`/api/crm/timeline?enq=${encodeURIComponent(enq)}`, { headers: getAuthHeaders() }));
  return d.timeline || [];
}

export async function crmAction(body: Record<string, any>): Promise<any> {
  return parse(await fetch('/api/crm/action', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body) }));
}
