// The quick links shown to the sales team. To add, change or remove a link, edit this list.
export interface QuickLink {
  title: string;
  note?: string;
  url: string;
  icon: 'globe' | 'whatsapp' | 'linkedin' | 'instagram' | 'facebook' | 'youtube' | 'x' | 'folder';
}
export interface QuickLinkGroup { heading: string; links: QuickLink[] }

export const QUICK_LINKS: QuickLinkGroup[] = [
  {
    heading: 'Brochures, photos and catalogues',
    links: [
      { title: 'Little Nap and La-Z-Boy Drive folder', note: 'Brochures, photos and more, including La-Z-Boy', icon: 'folder',
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
      { title: 'LinkedIn', note: 'Little Nap company page', icon: 'linkedin', url: 'https://www.linkedin.com/company/little-nap' },
      { title: 'Instagram', note: '@little_nap_recliners', icon: 'instagram', url: 'https://www.instagram.com/little_nap_recliners/' },
      { title: 'Facebook', note: 'Little Nap', icon: 'facebook', url: 'https://www.facebook.com/littlenap' },
      { title: 'YouTube', note: 'Little Nap channel', icon: 'youtube', url: 'https://www.youtube.com/channel/UCKFQ0fpFxWHKlBPHYnQErvQ' },
      { title: 'X', note: '@LittleNap1', icon: 'x', url: 'https://twitter.com/LittleNap1' }
    ]
  }
];
