import { Salesperson, ValidationData, OPFData, SalesTarget, BankDetails } from '../types';

const getAuthHeaders = (): Record<string, string> => {
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

