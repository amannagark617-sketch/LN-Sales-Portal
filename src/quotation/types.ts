export type Brand = 'Little Nap' | 'La-Z-Boy' | 'Smart Comfort';
export type DocType = 'Quotation' | 'PI';

export const BRANDS: Brand[] = ['Little Nap', 'La-Z-Boy', 'Smart Comfort'];

export interface PriceRow {
  brand: Brand;
  category: string;
  item: string;
  variant: string;
  price: number;
  notes: string;
  active: boolean;
  order: number;
}

export interface TermRow {
  brand: Brand;
  no: number;
  text: string;
  active: boolean;
}

export interface PriceListPayload {
  rows: PriceRow[];
  terms: TermRow[];
  loadedAt: number;
}

export interface Discount {
  mode: 'pct' | 'amt';
  value: number;
}

export interface LineOption {
  id: string;
  brand: Brand;
  category: string;
  item: string;
  variant: string;
  /** price currently charged per unit (can be edited by the user) */
  unitPrice: number;
  /** price taken from the price list when the option was picked */
  listPrice: number;
  /** quantity per piece of the main item */
  qty: number;
  custom?: boolean;
}

export interface QuoteLine {
  id: string;
  brand: Brand;
  category: string;
  item: string;
  variant: string;
  qty: number;
  unitPrice: number;
  listPrice: number;
  custom?: boolean;
  options: LineOption[];
  discount: Discount;
  note?: string;
}

export interface Freight {
  mode: 'included' | 'extra';
  amount: number;
}

export interface QuotePayload {
  v: 2;
  brand: Brand;
  docType: DocType;
  lines: QuoteLine[];
  discount: Discount;
  freight: Freight;
}

export interface LineTotals {
  gross: number;
  discount: number;
  net: number;
}

export interface Totals {
  lines: LineTotals[];
  subtotal: number;
  overallDiscount: number;
  taxable: number;
  gstIncluded: number;
  freightExtra: number;
  grandTotal: number;
  hasAnyDiscount: boolean;
}

export interface QuotationRecord {
  date: string;
  quotationNumber: string;
  opfCode: string;
  salespersonId: string;
  salespersonName: string;
  brandName: string;
  clientName: string;
  mobileNumber: string;
  emailId: string;
  billingAddress: string;
  shippingAddress: string;
  subtotal: number;
  gstIncluded: number;
  freight: number;
  grandTotal: number;
  amountInWords: string;
  docUrl: string;
  pdfUrl: string;
  productsJson: string;
  timestamp: string;
  docType: DocType;
  linkedQuotation: string;
  status: string;
}
