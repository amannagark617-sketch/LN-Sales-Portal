export type Brand = 'Little Nap' | 'La-Z-Boy' | 'Smart Comfort';
export type DocType = 'Quotation' | 'PI';
export type QuoteKind = 'Retail' | 'Project';

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
  /** which quotation type the term is for; empty means both */
  kind?: QuoteKind | '';
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
  /** retail discount on this upholstery or add-on */
  discount?: Discount;
}

export interface SpecLine {
  label: string;
  value: string;
}

export interface CustomerExtra {
  site?: string;
  gstin?: string;
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
  /** true when the discount covers the item only and each upholstery or add-on carries its own discount */
  partDiscounts?: boolean;
  note?: string;
  /** optional product specifications shown under the item on the document */
  specs?: SpecLine[];
}

export interface Freight {
  mode: 'included' | 'extra';
  amount: number;
}

export interface QuotePayload {
  v: 2;
  brand: Brand;
  docType: DocType;
  /** Retail uses discounts; Project uses manually entered special prices */
  kind?: QuoteKind;
  lines: QuoteLine[];
  discount: Discount;
  freight: Freight;
  /** GST % already contained in the prices; defaults to 18 */
  gstRate?: number;
  /** terms and conditions as shown on the document (editable by the user) */
  terms?: string[];
  customer?: CustomerExtra;
  /** optional installation charge added to the total */
  installation?: number;
  /** print the bank details block (default true) */
  showBank?: boolean;
  /** salesperson contact shown in the header block */
  contact?: { phone?: string; email?: string };
}

export interface LineTotals {
  gross: number;
  discount: number;
  net: number;
}

export interface Totals {
  lines: LineTotals[];
  /** per item, with any whole-quotation discount shared across the items (used on the customer PDF) */
  effLines: LineTotals[];
  subtotal: number;
  overallDiscount: number;
  taxable: number;
  /** value excluding GST */
  taxableExGst: number;
  gstRate: number;
  gstIncluded: number;
  freightExtra: number;
  installation: number;
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
