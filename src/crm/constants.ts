/** Shared by the browser and the server. Lead sources, stages and the Digital/Direct grouping. */

export const SOURCE_GROUP_NBD = 'NBD';
export const SOURCE_GROUP_DIRECT = 'Direct';

/** NBD = new online or marketing lead, goes to the NBD rotation. Direct = the salesperson met the customer, stays with them. */
export const LEAD_SOURCES: { name: string; group: 'NBD' | 'Direct' }[] = [
  { name: 'Meta', group: 'NBD' },
  { name: 'Google', group: 'NBD' },
  { name: 'Google Search', group: 'NBD' },
  { name: 'Google Demand Gen', group: 'NBD' },
  { name: 'Website', group: 'NBD' },
  { name: 'WhatsApp BOT', group: 'NBD' },
  { name: 'WhatsApp (Marketing Department)', group: 'NBD' },
  { name: 'Popin', group: 'NBD' },
  { name: 'IVR', group: 'NBD' },
  { name: 'Facebook', group: 'NBD' },
  { name: 'Instagram', group: 'NBD' },
  { name: 'Linkedin', group: 'NBD' },
  { name: 'Youtube', group: 'NBD' },
  { name: 'Social Media', group: 'NBD' },
  { name: 'Just dial', group: 'NBD' },
  { name: 'Indiamart', group: 'NBD' },
  { name: 'TWAK Chat', group: 'NBD' },
  { name: 'Walk-In', group: 'Direct' },
  { name: 'Reference', group: 'Direct' },
  { name: 'Old Client', group: 'Direct' },
  { name: 'Architect', group: 'Direct' },
  { name: 'Interior Designer', group: 'Direct' },
  { name: 'AV Dealer', group: 'Direct' },
  { name: 'New AV-Partner', group: 'Direct' },
  { name: 'New AV-Partner(Enquires)', group: 'Direct' },
  { name: 'Furniture Dealer', group: 'Direct' },
  { name: 'Franchise', group: 'Direct' },
  { name: 'OEM', group: 'Direct' },
  { name: 'SIS', group: 'Direct' },
  { name: 'CRR', group: 'Direct' },
  { name: 'Exhibition', group: 'Direct' },
  { name: 'Smart Home Expo', group: 'Direct' },
  { name: 'Big Cine Expo', group: 'Direct' },
  { name: 'Ace Reflect Exhibition', group: 'Direct' },
  { name: 'IMAARAT Design Festival-2025', group: 'Direct' },
  { name: 'Bharat Buildcon', group: 'Direct' },
  { name: 'What Hi-Fi', group: 'Direct' },
  { name: 'La-Z-Boy', group: 'Direct' },
  { name: 'RS Sir', group: 'Direct' },
  { name: 'Manoj Bindal', group: 'Direct' },
  { name: 'Myself', group: 'Direct' },
  { name: 'Others', group: 'Direct' },
];

export function sourceGroup(source: string): 'NBD' | 'Direct' {
  const s = (source || '').trim().toLowerCase();
  const f = LEAD_SOURCES.find(x => x.name.toLowerCase() === s);
  return f ? f.group : 'NBD'; // anything unknown goes through NBD first
}

export const STAGES = ['New', 'Contacted', 'Valid', 'Meeting', 'Proposal', 'Negotiation', 'Converted'] as const;
export type Stage = typeof STAGES[number];
export type Outcome = 'Open' | 'Invalid' | 'Lost' | 'Closed';

export const SEGMENTS = ['Retail', 'Online', 'Project', 'AV Dealers', 'Furniture Dealer', 'Franchise', 'For New Franchise', 'SIS', 'Exhibition', 'Popin'];
export const TITLES = ['Mr.', 'Ms.', 'Mrs.', 'Dr.'];
export const DESIGNATIONS = ['Director', 'CEO', 'GM', 'Purchase Head', 'Project Manager', 'Other'];
export const REQUIREMENTS = [
  'Living room recliner', 'Home theater recliners', 'Slider', 'Massage chair', 'Massage accessories',
  'Seating spectrum chair', 'La-Z-Boy', 'Stressle', 'Cinema', 'Club House', 'Hospital', 'Work From Home', 'NA',
];
export const ZONES = ['North', 'South', 'West', 'East'];

export const ZONE_OF_STATE: Record<string, string> = {
  'Delhi/NCR': 'North', 'Haryana': 'North', 'Punjab': 'North', 'Himachal Pradesh': 'North', 'Jammu and Kashmir': 'North', 'Ladakh': 'North',
  'Chandigarh': 'North', 'Uttar Pradesh': 'North', 'Uttarakhand': 'North', 'Rajasthan': 'North',
  'Maharashtra': 'West', 'Gujarat': 'West', 'Goa': 'West', 'Madhya Pradesh': 'West', 'Chhattisgarh': 'West',
  'Dadra & Nagar Haveli and Daman & Diu': 'West',
  'Karnataka': 'South', 'Kerala': 'South', 'Tamil Nadu': 'South', 'Telangana': 'South', 'Andhra Pradesh': 'South',
  'Puducherry': 'South', 'Lakshadweep': 'South', 'Andaman and Nicobar Islands': 'South',
  'West Bengal': 'East', 'Odisha': 'East', 'Bihar': 'East', 'Jharkhand': 'East', 'Assam': 'East', 'Sikkim': 'East',
  'Arunachal Pradesh': 'East', 'Manipur': 'East', 'Meghalaya': 'East', 'Mizoram': 'East', 'Nagaland': 'East', 'Tripura': 'East',
};

export const STATES = [
  'Andhra Pradesh', 'Andaman and Nicobar Islands', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra & Nagar Haveli and Daman & Diu', 'Delhi/NCR', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Nepal', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Oman',
];

export const LOST_REASONS = [
  'Price too high', 'Bought elsewhere', 'Not interested now', 'Not reachable', 'Postponed', 'Wrong requirement', 'Other',
];
export const INVALID_REASONS = [
  'Wrong number', 'Fake or test enquiry', 'Not a customer (job, vendor, spam)', 'Duplicate', 'Outside service area', 'Other',
];

/** Lead record as the portal sees it. */
export interface Lead {
  enquiryNo: string;
  createdAt: string;
  channel: string;
  sourceRef: string;
  source: string;
  group: string;
  segment: string;
  title: string;
  firstName: string;
  lastName: string;
  company: string;
  designation: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  zone: string;
  requirement: string;
  quantity: string;
  notes: string;
  utmMedium: string;
  utmCampaign: string;
  addedBy: string;
  ownerId: string;
  ownerName: string;
  ownerTeam: string;
  nbdId: string;
  nbdName: string;
  stage: string;
  outcome: string;
  reason: string;
  nextFollowUp: string;
  meetingDate: string;
  meetingTime: string;
  opf: string;
  orderValue: string;
  updatedAt: string;
}

export interface TimelineEntry {
  time: string;
  enquiryNo: string;
  byId: string;
  byName: string;
  type: string;
  text: string;
  nextFollowUp: string;
  fromName: string;
  toName: string;
}
