// The quick links shown to the sales team. To add, change or remove a link, edit this list.
export interface QuickLink {
  title: string;
  note?: string;
  url: string;
  icon: 'globe' | 'whatsapp' | 'linkedin' | 'instagram' | 'facebook' | 'youtube' | 'x' | 'folder' | 'file';
}
export interface QuickLinkGroup { heading: string; links: QuickLink[] }

export const QUICK_LINKS: QuickLinkGroup[] = [
  {
    heading: 'Price lists and catalogues',
    links: [
      { title: 'Little Nap price list', icon: 'file', url: 'https://drive.google.com/file/d/19O8y6UYYm9t0gKngj_rEeTR3K8UOHbAg/view?usp=sharing' },
      { title: 'La-Z-Boy price list', icon: 'file', url: 'https://drive.google.com/open?id=1yF-NqFsjvKjTD6Kqj047Um8V2vS6Ynzk&usp=drive_copy' },
      { title: 'La-Z-Boy catalogue', icon: 'file', url: 'https://drive.google.com/open?id=1Xv0H9hGdPqSZefWMph7sfw92IiY_FVBq&usp=drive_copy' },
      { title: 'Brochures and catalogues folder', note: 'Google Drive folder', icon: 'folder', url: 'https://drive.google.com/drive/folders/1c0IlP2QUcM2TJpzBt7j4IlcCjmj5En4w' }
    ]
  },
  {
    heading: 'Photos and more',
    links: [
      { title: 'Little Nap and La-Z-Boy Drive folder', note: 'Photos, brochures and more, including La-Z-Boy', icon: 'folder',
        url: 'https://drive.google.com/drive/folders/1JpxZ-RGJGOs9A5smVtNKzb0g4-cax2AZ?usp=drive_link' }
    ]
  },
  {
    heading: 'Talk to us',
    links: [
      { title: 'WhatsApp bot', note: '+91 96677 25859', icon: 'whatsapp', url: 'https://wa.me/919667725859' },
      { title: 'Little Nap website', note: 'littlenap.in', icon: 'globe', url: 'https://www.littlenap.in' }
    ]
  },
  {
    heading: 'Social media',
    links: [
      { title: 'Ravinder Goel on LinkedIn', note: 'Founder and CEO', icon: 'linkedin', url: 'https://www.linkedin.com/in/ravindergoel/' },
      { title: 'LinkedIn', note: 'Little Nap company page', icon: 'linkedin', url: 'https://www.linkedin.com/company/little-nap' },
      { title: 'Instagram', note: '@little_nap_recliners', icon: 'instagram', url: 'https://www.instagram.com/little_nap_recliners/' },
      { title: 'Facebook', note: 'Little Nap', icon: 'facebook', url: 'https://www.facebook.com/littlenap' },
      { title: 'YouTube', note: 'Little Nap channel', icon: 'youtube', url: 'https://www.youtube.com/channel/UCKFQ0fpFxWHKlBPHYnQErvQ' },
      { title: 'X', note: '@LittleNap1', icon: 'x', url: 'https://twitter.com/LittleNap1' }
    ]
  }
];
