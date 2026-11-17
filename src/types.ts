export interface Salesperson {
  region: string;
  showroom: string;
  name: string;
  code: string; // Add this
  id: string;
  password: string;
  manager?: string;
  isManager?: boolean;
  managerAccess?: string;
  mobile?: string;
  email?: string;
  team?: string;
  active?: boolean;
  designation?: string;
  crmAdmin?: boolean;
}

export interface SaleReport {
  salespersonName: string;
  date: string;
  region: string;
  opfNumber: string;
  visitType: 'Showroom' | 'Other Region';
  segment: string;
  subSegment?: string;
  leadSource: string;
  clientName: string;
  companyName?: string;
  mobileNumber: string;
  emailId?: string;
  dealerName?: string;
  dealerMobileNumber?: string;
  dealerCompanyName?: string;
  dealerCity?: string;
  dealerState?: string;
  city: string;
  state: string;
  brandName: string;
  model: string;
  functionality: string;
  category: string;
  crrNbd: string;
  typeOfBusiness: string;
  quantity: number;
  grossSales: number;
  commission: number;
  tax: number;
  freightCharges: number;
  netSales: number;
  advanceAmount: number;
  remarks?: string;
  linkedDocument?: string;
  enquiryNo?: string;
}

export interface NoSaleReport {
  salespersonName: string;
  date: string;
  clientVisits: number;
  followUps: number;
  remarks?: string;
}

export interface ValidationData {
  segments: string[];
  leadSources: string[];
  subSegments: string[];
  brands: string[];
  models: string[];
  functionalities: string[];
  categories: string[];
  crrNbds: string[];
  typesOfBusiness: string[];
}

export interface OPFData {
  date: string;
  salesperson: string;
  opf: string;
  region: string;
  visitType: string;
  segment: string;
  subSegment: string;
  leadSource: string;
  clientName: string;
  companyName: string;
  mobileNumber: string;
  emailId: string;
  dealerName: string;
  dealerMobileNumber: string;
  dealerCompanyName: string;
  dealerCity: string;
  dealerState: string;
  city: string;
  state: string;
  brandName: string;
  model: string;
  functionality: string;
  category: string;
  crrNbd: string;
  typeOfBusiness: string;
  quantity: number;
  grossSales: number;
  commission: number;
  tax: number;
  freightCharges: number;
  netSales: number;
  advanceAmount: number;
  remarks: string;
  clientVisits?: number;
  followUps?: number;
  showroom?: string;
}

export interface SalesTarget {
  salesperson: string;
  monthYear: string; // MM-YYYY format for easy mapping
  target: number;
  showroom?: string;
}

export interface BankDetails {
  showroomOrRegion: string;
  bankingDetails: string;
  companyDetails?: string;
}

