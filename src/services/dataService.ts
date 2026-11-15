import { Salesperson, ValidationData, OPFData, SalesTarget, BankDetails } from '../types';

export const getAuthHeaders = (): Record<string, string> => {
  const storedUser = localStorage.getItem('little_nap_user');
  if (storedUser) {
    try {
      const parsed = JSON.parse(storedUser);
      if (parsed && parsed.id && parsed.password) {
        return {
          'X-User-Id': parsed.id.trim(),
          'X-User-Password': parsed.password,
          'Content-Type': 'application/json'
        };
      }
    } catch (e) {
      console.error('Failed to extract authed credentials:', e);
    }
  }
  return {
    'Content-Type': 'application/json'
  };
};

export const loginSalesperson = async (id: string, password: string): Promise<Salesperson> => {
  const response = await fetch('/api/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ id, password })
  });
  
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || 'Invalid ID or Password');
  }
  
  const user = await response.json();
  // Keep the typed password in the frontend session object so we can use it to sign API headers
  return { ...user, password };
};

export const fetchReadyStock = async (refresh = false): Promise<import('../stock/stock').StockPayload> => {
  // refresh: Refresh button. Otherwise this is the first load after the app was opened.
  const response = await fetch(`/api/ready-stock?${refresh ? 'refresh=1' : 'open=1'}`, { headers: getAuthHeaders() });
  if (!response.ok) throw new Error('Could not load the ready stock');
  return await response.json();
};

export const fetchOrderStatus = async (opfs: string[], refresh = false): Promise<{ statuses: Record<string, import('../orders/status').OrderHistory>; loadedAt: number }> => {
  const response = await fetch('/api/order-status', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ opfs, refresh, open: !refresh }) });
  if (!response.ok) {
    let msg = 'Could not read the order status';
    try { const j = await response.json(); if (j?.error) msg = j.error; } catch (_) {}
    throw new Error(msg);
  }
  return await response.json();
};

export const refreshServerData = async (): Promise<void> => {
  await fetch('/api/refresh-data', { method: 'POST', headers: getAuthHeaders() });
};

export const fetchTargets = async (): Promise<SalesTarget[]> => {
  try {
    const response = await fetch('/api/targets', {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Unauthorised targets fetch');
    return await response.json();
  } catch (err) {
    console.error('Failed to fetch targets:', err);
    return [];
  }
};

export const fetchSalespersons = async (): Promise<Salesperson[]> => {
  try {
    const response = await fetch('/api/salespersons', {
      headers: getAuthHeaders()
    });
    if (!response.ok) throw new Error('Unauthorised salespersons fetch');
    return await response.json();
  } catch (err) {
    console.error('Failed to fetch salespersons:', err);
    return [];
  }
};

export const fetchValidationData = async (): Promise<ValidationData> => {
  const response = await fetch('/api/validation', {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Unauthorised validation fetch');
  return await response.json();
};

export const fetchUniqueOPFCodeMap = async (): Promise<Record<string, string>> => {
  const response = await fetch('/api/code-map', {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Unauthorised code-map fetch');
  return await response.json();
};

export const fetchOPFData = async (): Promise<OPFData[]> => {
  const response = await fetch('/api/opf-data', {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Unauthorised OPF data fetch');
  return await response.json();
};

export const fetchNextOPFNumber = async (salespersonName: string, visitType: string): Promise<string> => {
  const encName = encodeURIComponent(salespersonName);
  const encVisit = encodeURIComponent(visitType);
  const response = await fetch(`/api/next-opf-sequence?salespersonName=${encName}&visitType=${encVisit}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Unauthorised next-opf-sequence fetch');
  const data = await response.json();
  return data.opfNumber;
};

export interface QuotationOption {
  design: string;
  category: string;
  type: string;
  price: number;
  brand?: string;
}

export interface QuotationData {
  date: string;
  quotationNumber: string;
  opfCode: string;
  salespersonId: string;
  salespersonName: string;
  brandName: string;
  clientName: string;
  mobileNumber: string;
  emailId?: string;
  billingAddress: string;
  shippingAddress: string;
  subtotal: number;
  gstIncluded: number;
  freight: number;
  grandTotal: number;
  amountInWords: string;
  docUrl?: string;
  pdfUrl?: string;
  productsJson: string; // contains serialized list of products
  timestamp?: string;
  docType?: 'Quotation' | 'PI';
  linkedQuotation?: string;
  convertedTo?: string;
  status?: string;
}

export const fetchQuotationOptions = async (): Promise<QuotationOption[]> => {
  const response = await fetch('/api/quotation-options', {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Unauthorised quotation-options fetch');
  return await response.json();
};

export const fetchQuotationHistory = async (): Promise<QuotationData[]> => {
  const response = await fetch('/api/quotation-history', {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Unauthorised quotation-history fetch');
  return await response.json();
};

export const submitQuotationData = async (payload: any): Promise<{ status: string; docUrl?: string; pdfUrl?: string; docId?: string; pdfId?: string }> => {
  const response = await fetch('/api/submit-quotation', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    let errorMsg = 'Quotation database submission failed';
    try {
      const errJson = await response.json();
      if (errJson && errJson.error) {
        errorMsg = errJson.error;
      }
    } catch (_) {}
    throw new Error(errorMsg);
  }
  return await response.json();
};

export const fetchBankDetails = async (): Promise<BankDetails[]> => {
  const response = await fetch('/api/bank-details', {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Unauthorised bank-details fetch');
  return await response.json();
};

export const fetchNextQuotationSequence = async (): Promise<{ quotationNumber: string }> => {
  const response = await fetch('/api/next-quotation-sequence', {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Unauthorised next-quotation-sequence fetch');
  return await response.json();
};

export const uploadPDFBackground = async (payload: { quotationNumber: string; clientName: string; pdfBase64: string }): Promise<any> => {
  const response = await fetch('/api/upload-pdf-back', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error('Background PDF upload failed');
  }
  return await response.json();
};


// ---------- Quotation wizard (v2) ----------
import type { PriceListPayload, Brand, DocType, QuotePayload, Totals } from '../quotation/types';

export const fetchPriceList = async (refresh = false): Promise<PriceListPayload> => {
  const response = await fetch(`/api/price-list${refresh ? '?refresh=1' : ''}`, { headers: getAuthHeaders() });
  if (!response.ok) {
    let msg = 'Could not load the price list';
    try { const j = await response.json(); if (j?.error) msg = j.error; } catch (_) {}
    throw new Error(msg);
  }
  return await response.json();
};

export const fetchNextNumber = async (brand: Brand, docType: DocType): Promise<{ quotationNumber: string }> => {
  const response = await fetch(`/api/next-quotation-sequence?brand=${encodeURIComponent(brand)}&docType=${docType}`, {
    headers: getAuthHeaders()
  });
  if (!response.ok) throw new Error('Could not get the next number');
  return await response.json();
};

export interface SaveQuotationBody {
  quotationNumber: string;
  linkedQuotation?: string;
  date: string;
  clientName: string;
  mobileNumber: string;
  emailId?: string;
  billingAddress?: string;
  shippingAddress?: string;
  payload: QuotePayload;
  pdfBase64?: string;
}

export const saveQuotation = async (body: SaveQuotationBody): Promise<{ status: string; quotationNumber: string; totals: Totals }> => {
  const response = await fetch('/api/quotations', { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body) });
  if (!response.ok) {
    let msg = 'Saving failed';
    try { const j = await response.json(); if (j?.error) msg = j.error; } catch (_) {}
    throw new Error(msg);
  }
  return await response.json();
};
