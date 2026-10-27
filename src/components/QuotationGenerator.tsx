import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Trash2, 
  Plus, 
  MapPin, 
  Building, 
  User, 
  Calendar, 
  Phone, 
  Mail, 
  Printer, 
  Download, 
  CloudLightning, 
  Search, 
  ExternalLink, 
  RefreshCw, 
  Sparkles, 
  Check, 
  FileCheck,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Sliders,
  Layers,
  Sparkle,
  Upload
} from 'lucide-react';
import { Button } from './ui';
import { 
  fetchQuotationOptions, 
  fetchQuotationHistory, 
  submitQuotationData, 
  fetchBankDetails,
  fetchNextQuotationSequence,
  uploadPDFBackground,
  QuotationOption, 
  QuotationData 
} from '../services/dataService';
import { Salesperson, BankDetails } from '../types';
import { jsPDF } from 'jspdf';
import { PDFDocument } from 'pdf-lib';

// Module-level cache to keep the brochure PDF bytes persistent across invoice generations
let cachedBrochureBytes: ArrayBuffer | null = null;

interface QuotationGeneratorProps {
  salesperson: Salesperson;
}

interface ProductLineItem {
  id: string;
  design: string;
  type: string;
  upholstery: string;
  addons: string[];
  quantity: number;
  basePrice: number;
  upholsteryPrice: number;
  addonPrices: { [addonName: string]: number };
  modelDiscount?: number;
  upholsteryDiscount?: number;
  addonDiscount?: number;
  upholsteries?: string[];
  upholsteryPrices?: { [name: string]: number };
  upholsteryQuantities?: { [name: string]: number };
  addonQuantities?: { [name: string]: number };
}

export function QuotationGenerator({ salesperson }: QuotationGeneratorProps) {
  // Tabs: build or search history
  const [activeTab, setActiveTab] = useState<'build' | 'history'>('build');
  
  // Dynamic Options from Google Sheet
  const [options, setOptions] = useState<QuotationOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  
  // Derived Options
  const [designs, setDesigns] = useState<string[]>([]);
  const [designTypesMap, setDesignTypesMap] = useState<Record<string, string[]>>({});
  const [upholsteryList, setUpholsteryList] = useState<{ name: string; price: number }[]>([]);
  const [addonsList, setAddonsList] = useState<{ name: string; price: number }[]>([]);

  // History State
  const [history, setHistory] = useState<QuotationData[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrandFilter, setSelectedBrandFilter] = useState('');

  // Logo caching state
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  // Attachment states
  const [attachedFiles, setAttachedFiles] = useState<{
    id: string;
    name: string;
    type: 'pdf' | 'image';
    base64Url?: string;
    arrayBuffer?: ArrayBuffer;
  }[]>([]);

  // Form State
  const [brand, setBrand] = useState<'Little Nap' | 'La-Z-Boy' | 'Robocura'>('Little Nap');
  const [termsList, setTermsList] = useState<Record<string, string[]>>({
    'Little Nap': [
      'Payment Terms: 50% advance along with PO, balance 50% before dispatch.',
      'Delivery: Within 4-6 weeks from the date of advance and order confirmation.',
      'Taxes: GST @ 18% included (CGST/SGST/IGST dynamically computed).',
      'Warranty: 1-year comprehensive product warranty.',
      'Validity: Quotation valid for 30 days.'
    ],
    'La-Z-Boy': [
      'Payment Terms: 100% advance along with purchase order.',
      'Delivery: Within 6-8 weeks from date of booking, subject to stock availability.',
      'Taxes: GST @ 18% included inside invoice value.',
      'Warranty: Limited lifetime warranty on the mechanism, 1-year product warranty on leather/foam.',
      'Validity: This quotation is strictly valid for 15 days.'
    ],
    'Robocura': [
      'Payment Terms: 100% advance for immediate shipping confirmation.',
      'Delivery: Within 7-10 working days anywhere in India.',
      'Taxes: GST @ 18% included inside product price.',
      'Warranty: 1-year on-site comprehensive warranty.',
      'Validity: Quotation remains valid for 7 working days.'
    ]
  });
  const [clientName, setClientName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [emailId, setEmailId] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [sameAddress, setSameAddress] = useState(true);
  
  // Quotation particulars
  const [quotationDate, setQuotationDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [quotationNumber, setQuotationNumber] = useState('');
  const [opfCode, setOpfCode] = useState('');
  
  // Product list
  const [products, setProducts] = useState<ProductLineItem[]>([
    {
      id: '1',
      design: '',
      type: '',
      upholstery: '',
      addons: [],
      quantity: 1,
      basePrice: 0,
      upholsteryPrice: 0,
      addonPrices: {},
      modelDiscount: 0,
      upholsteryDiscount: 0,
      addonDiscount: 0,
      upholsteries: [],
      upholsteryPrices: {},
      upholsteryQuantities: {},
      addonQuantities: {}
    }
  ]);

  // Product Configurator focus and filter states
  const [activeConfigProductId, setActiveConfigProductId] = useState<string | null>('1');
  const [configTab, setConfigTab] = useState<'design' | 'upholstery' | 'addons'>('design');
  const [designSearch, setDesignSearch] = useState('');
  const [uphSearch, setUphSearch] = useState('');
  const [addonSearch, setAddonSearch] = useState('');

  // Freight Configuration
  const [freightType, setFreightType] = useState<'included' | 'manual'>('included');
  const [freightCharges, setFreightCharges] = useState<number>(0);

  // Cloud Saving Status Indicator
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [cloudLinks, setCloudLinks] = useState<{ docUrl?: string; pdfUrl?: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [matchedBankDetails, setMatchedBankDetails] = useState<string>('');
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string>('');

  // 1. Fetch options on mount
  useEffect(() => {
    async function loadOptions() {
      try {
        setLoadingOptions(true);
        const [optionsData, bankData] = await Promise.all([
          fetchQuotationOptions().catch(() => [] as QuotationOption[]),
          fetchBankDetails().catch(() => [] as BankDetails[])
        ]);
        setOptions(optionsData);

        // Match banking details based on login salesperson region/showroom
        if (bankData && bankData.length > 0) {
          const userShowroom = (salesperson?.showroom || '').trim().toLowerCase();
          const userRegion = (salesperson?.region || '').trim().toLowerCase();

          // 1. Try exact showroom match
          let matched = bankData.find(b => b.showroomOrRegion.trim().toLowerCase() === userShowroom);
          
          // 2. Try exact region match
          if (!matched) {
            matched = bankData.find(b => b.showroomOrRegion.trim().toLowerCase() === userRegion);
          }

          // 3. Try partial case-insensitive match (showroom)
          if (!matched && userShowroom) {
            matched = bankData.find(b => b.showroomOrRegion.trim().toLowerCase().includes(userShowroom) || userShowroom.includes(b.showroomOrRegion.trim().toLowerCase()));
          }

          // 4. Try partial case-insensitive match (region)
          if (!matched && userRegion) {
            matched = bankData.find(b => b.showroomOrRegion.trim().toLowerCase().includes(userRegion) || userRegion.includes(b.showroomOrRegion.trim().toLowerCase()));
          }

          if (matched) {
            setMatchedBankDetails(matched.bankingDetails);
          } else {
            // Default to first row as fallback
            setMatchedBankDetails(bankData[0]?.bankingDetails || '');
          }
        }

        // Try to fetch sequential Quotation Number and generate OPF code safely
        try {
          const seqResult = await fetchNextQuotationSequence();
          if (seqResult && seqResult.quotationNumber) {
            setQuotationNumber(seqResult.quotationNumber);
            const match = seqResult.quotationNumber.match(/(\d+)$/);
            const numPart = match ? match[1] : Math.floor(1000 + Math.random() * 9000);
            setOpfCode(`OPF-${numPart}`);
          } else {
            const randomNum = Math.floor(1000 + Math.random() * 9000);
            setQuotationNumber(`LNQ-2627-${randomNum}`);
            setOpfCode(`OPF-${randomNum}`);
          }
        } catch (seqErr) {
          console.error('Failed to fetch next quotation sequence:', seqErr);
          const randomNum = Math.floor(1000 + Math.random() * 9000);
          setQuotationNumber(`LNQ-2627-${randomNum}`);
          setOpfCode(`OPF-${randomNum}`);
        }
      } catch (err) {
        console.error('Failed to load quotation spreadsheet configurations:', err);
      } finally {
        setLoadingOptions(false);
      }
    }

    loadOptions();
  }, [salesperson?.id, salesperson?.showroom, salesperson?.region]);

  // Poll next quotation sequence & OPF code every 5 seconds in real-time so multiple concurrent users stay in sync
  useEffect(() => {
    let active = true;
    const updateSequence = async () => {
      try {
        const seqResult = await fetchNextQuotationSequence();
        if (active && seqResult && seqResult.quotationNumber) {
          setQuotationNumber(seqResult.quotationNumber);
          const match = seqResult.quotationNumber.match(/(\d+)$/);
          const numPart = match ? match[1] : Math.floor(1000 + Math.random() * 9000);
          setOpfCode(`OPF-${numPart}`);
        }
      } catch (err) {
        console.error('Failed to poll next quotation sequence:', err);
      }
    };

    const intervalId = setInterval(updateSequence, 5000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, []);

  // 2. Reactively derive product configurations depending on the selected brand and categories
  useEffect(() => {
    if (options.length === 0) return;

    // Filter options by brand (generic options like upholstery/general upgrades might not have a brand)
    const filteredOptions = options.filter(item => {
      if (!item.brand) return true;
      return item.brand.trim().toLowerCase() === brand.trim().toLowerCase();
    });

    const designsSet = new Set<string>();
    const designTypes: Record<string, string[]> = {};
    const uphValueList: { name: string; price: number }[] = [];
    const addonsValueList: { name: string; price: number }[] = [];

    filteredOptions.forEach(item => {
      const categoryLower = item.category.trim().toLowerCase();
      
      if (categoryLower === 'upholstery') {
        uphValueList.push({ name: item.design || item.type, price: item.price });
      } else if (categoryLower === 'add-ons' || categoryLower === 'addons' || categoryLower.includes('accessor')) {
        addonsValueList.push({ name: item.design || item.type, price: item.price });
      } else {
        // Core designs categories are anything else (e.g. Recliners, Massage Chair, Massage Accessories)
        if (item.design) {
          designsSet.add(item.design);
          if (item.type) {
            if (!designTypes[item.design]) {
              designTypes[item.design] = [];
            }
            if (!designTypes[item.design].includes(item.type)) {
              designTypes[item.design].push(item.type);
            }
          }
        }
      }
    });

    const finalDesigns = Array.from(designsSet);
    setDesigns(finalDesigns);
    setDesignTypesMap(designTypes);
    setUpholsteryList(uphValueList);
    setAddonsList(addonsValueList);

    // Dynamic reset: If currently selected products are invalid for the newly chosen brand's list,
    // automatically pre-fill with the first available product line of that brand
    if (finalDesigns.length > 0) {
      const defaultDesign = finalDesigns[0];
      const defaultTypes = designTypes[defaultDesign] || [];
      const defaultType = defaultTypes.length > 0 ? defaultTypes[0] : '';

      const matchingBase = filteredOptions.find(o => 
        o.design === defaultDesign && 
        (defaultType ? o.type === defaultType : true)
      );

      setProducts(prevProducts => {
        // If a product row design is populated, but it is NOT present in the designs of the new brand, we reset.
        // We do NOT reset if a design is empty (which represents an unconfigured row or loading state!)
        const needsReset = prevProducts.some(p => p.design && !finalDesigns.includes(p.design));
        if (needsReset) {
          return [
            {
              id: '1',
              design: defaultDesign,
              type: defaultType,
              upholstery: '',
              addons: [],
              quantity: 1,
              basePrice: matchingBase ? matchingBase.price : 0,
              upholsteryPrice: 0,
              addonPrices: {},
              modelDiscount: 0,
              upholsteryDiscount: 0,
              addonDiscount: 0
            }
          ];
        }
        return prevProducts;
      });
    }
  }, [brand, options]);

  // Load custom logo from localStorage on mount. If not found, run default generation.
  useEffect(() => {
    const savedCustomLogo = localStorage.getItem('little_nap_custom_logo');
    if (savedCustomLogo) {
      setLogoBase64(savedCustomLogo);
    } else {
      const loadDefaultLogo = async () => {
        try {
          const res = await fetch('/api/logo');
          if (res.ok) {
            const data = await res.json();
            if (data.base64) {
              setLogoBase64(data.base64);
              return;
            }
          }
        } catch (err) {
          console.error('Error auto-loading corporate logo:', err);
        }
        generateDefaultLogo();
      };
      loadDefaultLogo();
    }
  }, []);

  const generateDefaultLogo = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clear and make transparent background
      ctx.clearRect(0, 0, 640, 360);

      // 1. Draw Slate-900 rounded square box for Logo (Neutral luxury color instead of Red)
      const cX = 20;
      const cY = 20;
      const boxSize = 230;
      const radius = 55;

      ctx.fillStyle = '#0F172A'; // Midnight Slate
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(cX, cY, boxSize, boxSize, radius);
      } else {
        ctx.moveTo(cX + radius, cY);
        ctx.lineTo(cX + boxSize - radius, cY);
        ctx.quadraticCurveTo(cX + boxSize, cY, cX + boxSize, cY + radius);
        ctx.lineTo(cX + boxSize, cY + boxSize - radius);
        ctx.quadraticCurveTo(cX + boxSize, cY + boxSize, cX + boxSize - radius, cY + boxSize);
        ctx.lineTo(cX + radius, cY + boxSize);
        ctx.quadraticCurveTo(cX, cY + boxSize, cX, cY + boxSize - radius);
        ctx.lineTo(cX, cY + radius);
        ctx.quadraticCurveTo(cX, cY, cX + radius, cY);
      }
      ctx.fill();

      // 2. Draw white ergonomic recliner silhouette
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(cX + 55, cY + 50); // Headrest top-left
      ctx.bezierCurveTo(cX + 70, cY + 45, cX + 85, cY + 68, cX + 98, cY + 98); // Upper back curve
      ctx.bezierCurveTo(cX + 110, cY + 128, cX + 130, cY + 138, cX + 185, cY + 142); // Seat flow
      ctx.bezierCurveTo(cX + 215, cY + 144, cX + 225, cY + 162, cX + 205, cY + 185); // Footrest tip
      ctx.bezierCurveTo(cX + 180, cY + 205, cX + 145, cY + 195, cX + 115, cY + 175); // Seat bottom curve left
      ctx.bezierCurveTo(cX + 85, cY + 155, cX + 65, cY + 125, cX + 55, cY + 80); // Back outer support
      ctx.closePath();
      ctx.fill();

      // Under-seat base structure in white
      ctx.beginPath();
      ctx.moveTo(cX + 55, cY + 195);
      ctx.bezierCurveTo(cX + 110, cY + 155, cX + 175, cY + 170, cX + 205, cY + 190);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 15;
      ctx.lineCap = 'round';
      ctx.stroke();

      // 3. Draw brand text columns on the right (matching serif branding)
      ctx.fillStyle = '#111827'; // slate-900 black
      ctx.font = 'bold 96px Georgia, "Times New Roman", serif';
      ctx.fillText('Little', cX + boxSize + 30, cY + 105);

      ctx.fillStyle = '#0F172A'; // Midnight Slate instead of red text
      ctx.font = 'bold 125px Georgia, "Times New Roman", serif';
      ctx.fillText('NAP', cX + boxSize + 28, cY + 215);

      //Widely spaced "R E C L I N E R S"
      ctx.fillStyle = '#1D293F'; // slate-800
      ctx.font = 'bold 36px "Helvetica Neue", Arial, sans-serif';
      const txt = 'RECLINERS';
      let startX = cX + 40;
      const letterSpacing = 38;
      for (let i = 0; i < txt.length; i++) {
        ctx.fillText(txt[i], startX + (i * letterSpacing), cY + boxSize + 52);
      }

      // Subtitle "Joy of Comfort"
      ctx.fillStyle = '#4B5563'; // Slate-600
      ctx.font = 'italic 500 28px "Georgia", serif';
      ctx.fillText('Joy of Comfort', cX + boxSize + 120, cY + boxSize + 98);

      const dataUrl = canvas.toDataURL('image/png');
      setLogoBase64(dataUrl);
    } catch (err) {
      console.error('Error generating luxury logo:', err);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setLogoBase64(base64String);
        localStorage.setItem('little_nap_custom_logo', base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResetToDefaultLogo = () => {
    localStorage.removeItem('little_nap_custom_logo');
    const loadDefaultLogo = async () => {
      try {
        const res = await fetch('/api/logo');
        if (res.ok) {
          const data = await res.json();
          if (data.base64) {
            setLogoBase64(data.base64);
            return;
          }
        }
      } catch (err) {
        console.error('Error loader during reset:', err);
      }
      generateDefaultLogo();
    };
    loadDefaultLogo();
    const fileInput = document.getElementById('logo-upload-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  // 2. Draft Auto-saver: saves to localStorage on state changes
  useEffect(() => {
    if (clientName || contactNumber || products[0].design) {
      const draft = {
        brand, clientName, contactNumber, emailId, billingAddress, shippingAddress, sameAddress,
        quotationDate, quotationNumber, opfCode, products, freightType, freightCharges
      };
      localStorage.setItem('little_nap_quote_draft', JSON.stringify(draft));
    }
  }, [
    brand, clientName, contactNumber, emailId, billingAddress, shippingAddress, sameAddress,
    quotationDate, quotationNumber, opfCode, products, freightType, freightCharges
  ]);

  // Load Draft from local storage
  const handleRestoreDraft = () => {
    const saved = localStorage.getItem('little_nap_quote_draft');
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        setBrand(draft.brand || 'Little Nap');
        setClientName(draft.clientName || '');
        setContactNumber(draft.contactNumber || '');
        setEmailId(draft.emailId || '');
        setBillingAddress(draft.billingAddress || '');
        setShippingAddress(draft.shippingAddress || '');
        setSameAddress(draft.sameAddress !== undefined ? draft.sameAddress : true);
        setQuotationDate(draft.quotationDate || new Date().toISOString().split('T')[0]);
        setQuotationNumber(draft.quotationNumber || '');
        setOpfCode(draft.opfCode || '');
        setProducts(draft.products || []);
        if (draft.products && draft.products.length > 0) {
          setActiveConfigProductId(draft.products[0].id);
        } else {
          setActiveConfigProductId(null);
        }
        setFreightType(draft.freightType || 'included');
        setFreightCharges(draft.freightCharges || 0);
        setSyncStatus('idle');
        setCloudLinks(null);
        setDesignSearch('');
        setUphSearch('');
        setAddonSearch('');
      } catch (e) {
        console.error('Error reloading draft state:', e);
      }
    }
  };

  const handleResetForm = async () => {
    localStorage.removeItem('little_nap_quote_draft');
    setClientName('');
    setContactNumber('');
    setEmailId('');
    setBillingAddress('');
    setShippingAddress('');
    setSameAddress(true);
    setQuotationDate(new Date().toISOString().split('T')[0]);
    
    // Try to fetch sequential Quotation Number and generate OPF code safely
    try {
      const seqResult = await fetchNextQuotationSequence();
      if (seqResult && seqResult.quotationNumber) {
        setQuotationNumber(seqResult.quotationNumber);
        const match = seqResult.quotationNumber.match(/(\d+)$/);
        const numPart = match ? match[1] : Math.floor(1000 + Math.random() * 9000);
        setOpfCode(`OPF-${numPart}`);
      } else {
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        setQuotationNumber(`LNQ-2627-${randomNum}`);
        setOpfCode(`OPF-${randomNum}`);
      }
    } catch (seqErr) {
      console.error('Failed to fetch next quotation sequence on reset:', seqErr);
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      setQuotationNumber(`LNQ-2627-${randomNum}`);
      setOpfCode(`OPF-${randomNum}`);
    }

    setProducts([{
      id: '1', design: '', type: '', upholstery: '', addons: [], quantity: 1, basePrice: 0, upholsteryPrice: 0, addonPrices: {}, modelDiscount: 0, upholsteryDiscount: 0, addonDiscount: 0
    }]);
    setActiveConfigProductId('1');
    setConfigTab('design');
    setDesignSearch('');
    setUphSearch('');
    setAddonSearch('');
    setFreightType('included');
    setFreightCharges(0);
    setSyncStatus('idle');
    setCloudLinks(null);
  };

  // 3. Handle physical Address copying logic
  const handleBillingAddressChange = (val: string) => {
    setBillingAddress(val);
    if (sameAddress) {
      setShippingAddress(val);
    }
  };

  const handleSameAddressToggle = () => {
    const nextVal = !sameAddress;
    setSameAddress(nextVal);
    if (nextVal) {
      setShippingAddress(billingAddress);
    }
  };

  // 4. Products grid row updates
  const handleAddProductRow = () => {
    const newId = Date.now().toString();
    setProducts([...products, {
      id: newId,
      design: '',
      type: '',
      upholstery: '',
      addons: [],
      quantity: 1,
      basePrice: 0,
      upholsteryPrice: 0,
      addonPrices: {},
      modelDiscount: 0,
      upholsteryDiscount: 0,
      addonDiscount: 0,
      upholsteries: [],
      upholsteryPrices: {},
      upholsteryQuantities: {},
      addonQuantities: {}
    }]);
    setActiveConfigProductId(newId);
    setConfigTab('design');
    setDesignSearch('');
    setUphSearch('');
    setAddonSearch('');
  };

  const handleRemoveProductRow = (id: string) => {
    if (products.length === 1) return;
    const remaining = products.filter(p => p.id !== id);
    setProducts(remaining);
    if (activeConfigProductId === id) {
      setActiveConfigProductId(remaining[0].id);
      setConfigTab('design');
    }
  };

  const handleProductChange = (index: number, field: keyof ProductLineItem, value: any) => {
    const updated = [...products];
    const item = updated[index];

    if (field === 'design') {
      item.design = value;
      // Fetch available types
      const types = designTypesMap[value] || [];
      item.type = types.length > 0 ? types[0] : '';
      
      // Update Base Price
      const matchingBase = options.find(o => 
        o.design === value && 
        (item.type ? o.type === item.type : true)
      );
      item.basePrice = matchingBase ? matchingBase.price : 0;
    } else if (field === 'type') {
      item.type = value;
      // Re-fetch base price for selected design + type combination
      const matchingBase = options.find(o => o.design === item.design && o.type === value);
      item.basePrice = matchingBase ? matchingBase.price : 0;
    } else if (field === 'upholstery') {
      const selectedUpholsteries = Array.isArray(value) ? value : (value ? [value] : []);
      item.upholsteries = selectedUpholsteries;
      
      const prices: { [uphName: string]: number } = {};
      const quantities: { [uphName: string]: number } = { ...item.upholsteryQuantities };
      
      selectedUpholsteries.forEach(uphName => {
        const matchingUph = upholsteryList.find(u => u.name === uphName);
        prices[uphName] = matchingUph ? matchingUph.price : 0;
        if (quantities[uphName] === undefined) {
          quantities[uphName] = 1;
        }
      });
      item.upholsteryPrices = prices;
      item.upholsteryQuantities = quantities;
      
      // Update legacy fields for compatibility
      item.upholstery = selectedUpholsteries.join(', ');
      item.upholsteryPrice = Object.entries(prices).reduce((sum, [uName, p]) => {
        const qty = quantities[uName] ?? 1;
        return sum + p * qty;
      }, 0);
    } else if (field === 'addons') {
      const selectedAddons = value as string[];
      item.addons = selectedAddons;
      const prices: { [addonName: string]: number } = {};
      const quantities: { [addonName: string]: number } = { ...item.addonQuantities };
      
      selectedAddons.forEach(add => {
        const matchingAddon = addonsList.find(a => a.name === add);
        prices[add] = matchingAddon ? matchingAddon.price : 0;
        if (quantities[add] === undefined) {
          quantities[add] = 1;
        }
      });
      item.addonPrices = prices;
      item.addonQuantities = quantities;
    } else if (field === 'quantity') {
      item.quantity = Math.max(1, Number(value));
    } else if (field === 'modelDiscount') {
      const val = value === '' ? 0 : parseFloat(value);
      item.modelDiscount = isNaN(val) ? 0 : Math.min(100, Math.max(0, val));
    } else if (field === 'upholsteryDiscount') {
      const val = value === '' ? 0 : parseFloat(value);
      item.upholsteryDiscount = isNaN(val) ? 0 : Math.min(100, Math.max(0, val));
    } else if (field === 'addonDiscount') {
      const val = value === '' ? 0 : parseFloat(value);
      item.addonDiscount = isNaN(val) ? 0 : Math.min(100, Math.max(0, val));
    } else if (field === 'upholsteryQuantity' as any) {
      const { name, quantity } = value;
      if (!item.upholsteryQuantities) item.upholsteryQuantities = {};
      const parsedQty = parseFloat(quantity);
      item.upholsteryQuantities[name] = isNaN(parsedQty) ? 0 : Math.max(0, parsedQty);
      
      // Sync legacy upholsteryPrice sum
      if (item.upholsteries) {
        let sumPrice = 0;
        item.upholsteries.forEach(uName => {
          const uPrice = item.upholsteryPrices?.[uName] ?? 0;
          const uQty = item.upholsteryQuantities?.[uName] ?? 1;
          sumPrice += uPrice * uQty;
        });
        item.upholsteryPrice = sumPrice;
      }
    } else if (field === 'addonQuantity' as any) {
      const { name, quantity } = value;
      if (!item.addonQuantities) item.addonQuantities = {};
      item.addonQuantities[name] = Math.max(1, Number(quantity));
    }

    setProducts(updated);
  };

  // 5. Mathematical Price Calculation Model
  const calculateLineItemTotal = (item: ProductLineItem) => {
    const isModelSelected = !!item.design;
    const modelPrice = isModelSelected ? item.basePrice * (1 - (item.modelDiscount || 0) / 100) : 0;
    const modelTotal = modelPrice * item.quantity;
    
    // Upholsteries sum
    let uphTotal = 0;
    const uphNames = item.upholsteries || (item.upholstery ? [item.upholstery] : []);
    uphNames.forEach(uphName => {
      const price = item.upholsteryPrices?.[uphName] ?? (uphName === item.upholstery ? item.upholsteryPrice : 0);
      const qty = item.upholsteryQuantities?.[uphName] ?? 1;
      uphTotal += price * qty;
    });
    const upholsteryTotal = uphTotal * (1 - (item.upholsteryDiscount || 0) / 100) * (isModelSelected ? item.quantity : 1);
    
    // Addons sum
    let addTotal = 0;
    item.addons.forEach(add => {
      const price = item.addonPrices[add] || 0;
      const qty = item.addonQuantities?.[add] ?? 1;
      addTotal += price * qty;
    });
    const addonsTotal = addTotal * (1 - (item.addonDiscount || 0) / 100) * (isModelSelected ? item.quantity : 1);
    
    return modelTotal + upholsteryTotal + addonsTotal;
  };

  const subtotal = products.reduce((sum, item) => sum + calculateLineItemTotal(item), 0);
  const actualFreight = freightType === 'included' ? 0 : freightCharges;
  const grandTotal = subtotal + actualFreight;
  
  // GST 18% included (Formula: Total / 1.18 * 0.18)
  const gstIncludedAmount = (subtotal / 1.18) * 0.18;

  // Number to Words Converter
  const amountInWords = numberToWords(grandTotal);

  // Brand Dynamic Terms
  const getTermsByBrand = () => {
    return termsList[brand] || [];
  };

  // Indian Rupees to Words Converter helper
  function numberToWords(num: number): string {
    if (num === 0) return 'Zero Rupees Only';
    
    const ones = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
      'Seventeen', 'Eighteen', 'Nineteen'
    ];
    
    const tens = [
      '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
    ];
    
    const convertLessThanOneThousand = (n: number): string => {
      if (n === 0) return '';
      let result = '';
      
      if (n >= 100) {
        result += ones[Math.floor(n / 100)] + ' Hundred ';
        n %= 100;
      }
      
      if (n >= 20) {
        result += tens[Math.floor(n / 10)] + ' ';
        n %= 10;
      }
      
      if (n > 0) {
        result += ones[n] + ' ';
      }
      
      return result.trim();
    };
    
    let result = '';
    let integerPart = Math.floor(num);
    let paisePart = Math.round((num - integerPart) * 100);
    
    if (integerPart >= 10000000) {
      const crores = Math.floor(integerPart / 10000000);
      result += convertLessThanOneThousand(crores) + ' Crore ';
      integerPart %= 10000000;
    }
    
    if (integerPart >= 100000) {
      const lakhs = Math.floor(integerPart / 100000);
      result += convertLessThanOneThousand(lakhs) + ' Lakh ';
      integerPart %= 100000;
    }
    
    if (integerPart >= 1000) {
      const thousands = Math.floor(integerPart / 1000);
      result += convertLessThanOneThousand(thousands) + ' Thousand ';
      integerPart %= 1000;
    }
    
    if (integerPart > 0) {
      result += convertLessThanOneThousand(integerPart);
    }
    
    result = result.trim() + ' Rupees';
    
    if (paisePart > 0) {
      result += ' and ' + convertLessThanOneThousand(paisePart) + ' Paise';
    }
    
    return result + ' Only';
  }

  // File Upload processor for custom PDF brochure attachments or invoices
  const processUploadedFiles = (fileList: File[]) => {
    fileList.forEach(file => {
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const isImage = file.type.startsWith('image/') || 
                      file.name.toLowerCase().endsWith('.png') || 
                      file.name.toLowerCase().endsWith('.jpg') || 
                      file.name.toLowerCase().endsWith('.jpeg');
      
      if (!isPdf && !isImage) {
        alert(`File "${file.name}" has an unsupported format. Please upload PDF or image files only.`);
        return;
      }
      
      const reader = new FileReader();
      if (isPdf) {
        reader.onload = (e) => {
          const buffer = e.target?.result as ArrayBuffer;
          setAttachedFiles(prev => [
            ...prev,
            {
              id: Math.random().toString(36).substr(2, 9),
              name: file.name,
              type: 'pdf',
              arrayBuffer: buffer
            }
          ]);
        };
        reader.readAsArrayBuffer(file);
      } else {
        reader.onload = (e) => {
          const base64Url = e.target?.result as string;
          setAttachedFiles(prev => [
            ...prev,
            {
              id: Math.random().toString(36).substr(2, 9),
              name: file.name,
              type: 'image',
              base64Url
            }
          ]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  // 6. Local PDF printing helper using standard print or jsPDF
  const handlePrintLocal = () => {
    window.print();
  };

  const generateCorePDF = (): jsPDF => {
    // Generate beautiful A4 invoice PDF in pixel-perfect vector format!
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Premium Color Palette - Elegant Champagne Gold & Slate Theme
    const C_GOLD = '#9B7C50';       // Premium Luxe Champagne Gold Accent
    const C_CHARCOAL = '#0F172A';  // Clear Onyx Charcoal Slate for main headings and readable texts
    const C_SLATE = '#475569';     // Supporting Slate Grey
    const C_LIGHT = '#FDFDFB';     // Clean Light Soft Linen Ivory for alternating rows
    const C_HIGHLIGHT = '#FAF7F2'; // Soft golden-sand background tint for totals pane
    const C_BORDER_GOLD = '#E5DFD4';// Champagne Gold subtle border frame

    const pageW = 210;
    let y = 10;
    let pageNum = 1;

    // Check if any product has a discount selected/applied
    const hasDiscount = products.some(p => 
      (p.modelDiscount && p.modelDiscount > 0) || 
      (p.upholsteryDiscount && p.upholsteryDiscount > 0) || 
      (p.addonDiscount && p.addonDiscount > 0)
    );

    // Dynamic column X positions
    const colQty = hasDiscount ? 112 : 116;
    const colMRP = hasDiscount ? 135 : 143;
    const colDiscount = hasDiscount ? 151 : 0;
    const colSpecial = hasDiscount ? 172 : 169;
    const colTotal = 193;
    const descMaxWidth = hasDiscount ? 75 : 80;

    // Helper to draw vector Indian Rupee symbol
    const drawRupeeSymbol = (docObj: any, x: number, y: number, fontSize: number, color: string = '#FFFFFF') => {
      const prevLineWidth = docObj.getLineWidth();
      const prevDrawColor = docObj.getDrawColor();
      
      // Calculate height of the character in mm:
      // In jsPDF, a font size of S has cap-height roughly 0.25 * S in mm.
      const h = fontSize * 0.25;
      const w = h * 0.62; // Aspect ratio of symbol
      
      // Make the stroke thin and crisp (matching standard typography weights)
      const strokeWidth = Math.max(h * 0.05, 0.075);
      docObj.setLineWidth(strokeWidth);
      docObj.setDrawColor(color);
      
      // Define coordinates relative to top-left of the character box (x, yTop)
      const yTop = y - h * 0.85; // baseline adjustment
      const yBar2 = yTop + h * 0.24;
      const yMid = yTop + h * 0.48;
      const yBot = yTop + h;
      
      const xStart = x + w * 0.20; // horizontal start of loop and stem
      
      // 1. Solid top horizontal bar
      docObj.line(x, yTop, x + w, yTop);
      
      // 2. Middle horizontal bar parallel to the top bar
      docObj.line(x, yBar2, x + w * 0.75, yBar2);
      
      // 3. Vertical stem connecting the top and middle bar on the left side of the loop
      docObj.line(xStart, yTop, xStart, yMid);
      
      // 4. Perfect smooth circular loop on the right side
      const xCenter = xStart;
      const rX = w * 0.55;
      const rY = (yMid - yTop) / 2;
      const yCenter = yTop + rY;
      
      const curvePoints: {x: number, y: number}[] = [];
      const numSteps = 16;
      for (let i = 0; i <= numSteps; i++) {
        const theta = -Math.PI / 2 + (Math.PI * i) / numSteps;
        const px = xCenter + rX * Math.cos(theta);
        const py = yCenter + rY * Math.sin(theta);
        curvePoints.push({ x: px, y: py });
      }
      
      for (let i = 0; i < curvePoints.length - 1; i++) {
        docObj.line(curvePoints[i].x, curvePoints[i].y, curvePoints[i + 1].x, curvePoints[i + 1].y);
      }
      
      // 5. Smooth diagonal leg sloping down-right
      docObj.line(xStart + w * 0.05, yMid, x + w * 0.82, yBot);
      
      docObj.setLineWidth(prevLineWidth);
      docObj.setDrawColor(prevDrawColor);
    };

    // Helper to draw the header on any page
    const drawPageHeader = (currPage: number) => {
      // 1. Sleek gold accent color bar at physical page top
      doc.setFillColor(C_GOLD);
      doc.rect(0, 0, pageW, 3, 'F');

      if (currPage === 1) {
        // Full Header with Corporate Logo
        let logoX = 15;
        let logoY = 10;
        let headerTextX = 54;
        
        if (logoBase64) {
          try {
            doc.addImage(logoBase64, 'PNG', logoX, logoY, 34, 18);
          } catch (err) {
            console.error('Error drawing preloaded logo in jsPDF:', err);
            doc.setDrawColor(C_CHARCOAL);
            doc.setFillColor(C_CHARCOAL);
            doc.rect(logoX, logoY, 34, 18, 'F');
            doc.setFont('Helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor('#FFFFFF');
            doc.text('LITTLE NAP', logoX + 17, logoY + 8, { align: 'center' });
            doc.setFontSize(5);
            doc.text('PREMIUM COMFORT', logoX + 17, logoY + 12, { align: 'center' });
          }
        } else {
          doc.setDrawColor(C_CHARCOAL);
          doc.setFillColor(C_CHARCOAL);
          doc.rect(logoX, logoY, 34, 18, 'F');
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor('#FFFFFF');
          doc.text('LITTLE NAP', logoX + 17, logoY + 8, { align: 'center' });
        }

        // Company profile text and Document Title in elegant premium centered and right-aligned layout
        const centerX = pageW / 2;
        const rightX = pageW - 15;

        // Centered Header Details (PROFORMA INVOICE, Brand, Invoice Reference No)
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(C_GOLD);
        doc.text('PROFORMA INVOICE', centerX, 14, { align: 'center' });
        
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(C_CHARCOAL);
        const subTitleText = brand === 'Little Nap' ? 'LITTLE NAP RECLINERS' : `${brand.toUpperCase()} RANGE`;
        doc.text(subTitleText, centerX, 19, { align: 'center' });
        
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(C_SLATE);
        doc.text(`Invoice No: ${quotationNumber || 'Draft'}`, centerX, 24, { align: 'center' });

        // Right-aligned Corporate & Contact Details
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(C_CHARCOAL);
        doc.text('Little Nap Designs Pvt. Ltd.', rightX, 11, { align: 'right' });
        
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(6.8);
        doc.setTextColor(C_SLATE);
        doc.text('GSTIN: 06AACCL0576H1ZM', rightX, 14.5, { align: 'right' });
        doc.text('Email: enquiry@littlenap.in', rightX, 18, { align: 'right' });
        doc.text('Corp. Office: 844, M.G. Road, Ghitorni,', rightX, 21.5, { align: 'right' });
        doc.text('New Delhi - 110030, India', rightX, 25, { align: 'right' });

        y = 31;
      } else {
        // Clean continued page header indicator
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(C_SLATE);
        doc.text(`Doc Ref: ${quotationNumber || 'Draft'} | Page ${currPage}`, 15, 12);
        doc.text(`${brand.toUpperCase()} - Proforma Invoice (Continued)`, pageW - 15, 12, { align: 'right' });
        
        y = 15;
      }

      doc.setDrawColor('#E2E8F0');
      doc.setLineWidth(0.4);
      doc.line(15, y, pageW - 15, y);
    };

    // Helper to check for space on page, adding page if required
    const ensureSpace = (neededHeight: number, isTableRow: boolean = false) => {
      if (y + neededHeight > 275) {
        if (isTableRow) {
          // close the current table on this page with a thin line
          doc.setDrawColor('#E2E8F0');
          doc.setLineWidth(0.3);
          doc.line(15, y, pageW - 15, y);
        }
        doc.addPage();
        pageNum += 1;
        drawPageHeader(pageNum);
        y += 5; // offset under top line

        if (isTableRow) {
          // Re-draw table headers on the new page
          doc.setFillColor(C_CHARCOAL);
          doc.rect(15, y, pageW - 30, 11, 'F');

          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor('#FFFFFF');
          doc.text('Sr.No.', 17, y + 7);
          doc.text('Item Design & Personalization Specs', 27, y + 7);
          doc.text('Qty', colQty, y + 7, { align: 'right' });
          
          doc.text('MRP (Rs.)', colMRP, y + 5, { align: 'right' });
          
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(6.5);
          doc.setTextColor('#CBD5E1');
          doc.text('(GST Included)', colMRP, y + 9.5, { align: 'right' });
          
          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor('#FFFFFF');
          if (hasDiscount) {
            doc.text('Discount', colDiscount, y + 7, { align: 'right' });
          }
          
          doc.text('Special Price', colSpecial, y + 5, { align: 'right' });
          doc.text('(Rs.)', colSpecial, y + 9.5, { align: 'right' });
          
          doc.text('Total Amount', colTotal, y + 5, { align: 'right' });
          doc.text('(Rs.)', colTotal, y + 9.5, { align: 'right' });

          y += 11;
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(C_CHARCOAL);
        }
      }
    };

    // Render Page 1 Header
    drawPageHeader(1);

    // 3. Metadata Grid
    y += 7;
    // Left border indicator for PARTICULARS
    doc.setFillColor(C_GOLD);
    doc.rect(15, y - 3.5, 1.5, 4.5, 'F');
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(C_CHARCOAL);
    doc.text('INVOICE DETAILS', 18, y);

    // Left border indicator for CREATOR
    doc.setFillColor(C_GOLD);
    doc.rect(112, y - 3.5, 1.5, 4.5, 'F');
    doc.text('PREPARED BY', 115, y);
    
    y += 5;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(C_SLATE);
    doc.text(`Proforma Invoice Date:  ${quotationDate}`, 15, y);
    doc.text(`Employee Name:  ${salesperson.name}`, 112, y);
    
    y += 4.5;
    doc.text(`Proforma Invoice Number:  ${quotationNumber}`, 15, y);
    doc.text(`Employee ID:  ${salesperson.id || 'N/A'}`, 112, y);
    
    y += 6;
    doc.setDrawColor('#E2E8F0');
    doc.setLineWidth(0.4);
    doc.line(15, y, pageW - 15, y);

    // 4. Customer Panel
    ensureSpace(35);
    y += 7;
    doc.setFillColor(C_GOLD);
    doc.rect(15, y - 3.5, 1.5, 4.5, 'F');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(C_CHARCOAL);
    doc.text('CLIENT & DELIVERY PARTICULARS', 18, y);

    y += 5;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(C_SLATE);
    doc.text(`Client Name:  ${clientName || 'N/A'}`, 15, y);
    doc.text(`Contact Phone:  ${contactNumber || 'N/A'}`, 112, y);
    
    y += 4.5;
    doc.text(`Email Address:  ${emailId || 'N/A'}`, 15, y);

    y += 5;
    // Elegant nested addresses cards
    const billingTitle = 'BILLING ADDRESS:';
    const shippingTitle = 'SHIPPING ADDRESS:';
    
    const billAddressLines = doc.splitTextToSize(billingAddress || 'N/A', 80);
    const shipAddressLines = doc.splitTextToSize(shippingAddress || 'N/A', 80);

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(C_CHARCOAL);
    doc.text(billingTitle, 15, y);
    doc.text(shippingTitle, 112, y);

    y += 4;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(C_SLATE);
    doc.text(billAddressLines, 15, y);
    doc.text(shipAddressLines, 112, y);

    y += Math.max(billAddressLines.length, shipAddressLines.length) * 4 + 4;
    doc.setDrawColor('#E2E8F0');
    doc.setLineWidth(0.4);
    doc.line(15, y, pageW - 15, y);

    // 5. Products table header
    ensureSpace(20);
    y += 7;
    doc.setFillColor(C_GOLD);
    doc.rect(15, y - 3.5, 1.5, 4.5, 'F');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(C_CHARCOAL);
    doc.text('PRODUCT SELECTION & MODIFICATIONS BREAKDOWN', 18, y);

    y += 5;
    // Luxury Table Header Solid Fill in beautiful Slate-Charcoal
    doc.setFillColor(C_CHARCOAL);
    doc.rect(15, y, pageW - 30, 11, 'F');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor('#FFFFFF');
    doc.text('Sr.No.', 17, y + 7);
    doc.text('Item Design & Personalization Specs', 27, y + 7);
    doc.text('Qty', colQty, y + 7, { align: 'right' });
    
    // MRP (Rs.) with smaller (GST Included)
    doc.text('MRP (Rs.)', colMRP, y + 5, { align: 'right' });
    
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor('#CBD5E1');
    doc.text('(GST Included)', colMRP, y + 9.5, { align: 'right' });
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor('#FFFFFF');
    if (hasDiscount) {
      doc.text('Discount', colDiscount, y + 7, { align: 'right' });
    }
    
    doc.text('Special Price', colSpecial, y + 5, { align: 'right' });
    doc.text('(Rs.)', colSpecial, y + 9.5, { align: 'right' });
    
    doc.text('Total Amount', colTotal, y + 5, { align: 'right' });
    doc.text('(Rs.)', colTotal, y + 9.5, { align: 'right' });

    y += 11;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(C_CHARCOAL);
    
    interface PrintableRow {
      isSubItem: boolean;
      serialNo: string;
      description: string;
      qty: string;
      mrpPrice: number;
      discountText: string;
      specialPrice: number;
      lineTotal: number;
    }

    const printableRows: PrintableRow[] = [];
    let seqNo = 1;

    products.forEach((p) => {
      const isModelSelected = !!p.design;
      const uphNames = p.upholsteries || (p.upholstery ? [p.upholstery] : []);

      if (isModelSelected) {
        // 1. Base model parent row
        let desc = p.design;
        if (p.type) desc += ` (${p.type})`;
        if (p.modelDiscount && p.modelDiscount > 0) {
          desc += ` (${p.modelDiscount}% Off)`;
        }

        const originalBasePrice = p.basePrice;
        const modelDiscountText = p.modelDiscount && p.modelDiscount > 0 ? `${p.modelDiscount}%` : '-';
        const discountedBasePrice = p.basePrice * (1 - (p.modelDiscount || 0) / 100);
        
        printableRows.push({
          isSubItem: false,
          serialNo: (seqNo++).toString(),
          description: desc,
          qty: p.quantity.toString(),
          mrpPrice: originalBasePrice,
          discountText: modelDiscountText,
          specialPrice: discountedBasePrice,
          lineTotal: discountedBasePrice * p.quantity
        });

        // 2. Sub-row upholstered fabrics
        uphNames.forEach(uName => {
          const originalUphPrice = p.upholsteryPrices?.[uName] ?? (uName === p.upholstery ? p.upholsteryPrice : 0);
          const uphDiscountText = p.upholsteryDiscount && p.upholsteryDiscount > 0 ? `${p.upholsteryDiscount}%` : '-';
          const discountedUphPrice = originalUphPrice * (1 - (p.upholsteryDiscount || 0) / 100);
          const qtyVal = p.upholsteryQuantities?.[uName] ?? 1;

          let uphDesc = `     - Upholstery: ${uName}`;
          if (p.upholsteryDiscount && p.upholsteryDiscount > 0) {
            uphDesc += ` (${p.upholsteryDiscount}% Off)`;
          }

          printableRows.push({
            isSubItem: true,
            serialNo: '',
            description: uphDesc,
            qty: `${qtyVal} Meter${qtyVal !== 1 ? 's' : ''}`,
            mrpPrice: originalUphPrice,
            discountText: uphDiscountText,
            specialPrice: discountedUphPrice,
            lineTotal: discountedUphPrice * qtyVal * p.quantity
          });
        });

        // 3. Sub-row tech addons
        p.addons.forEach(addon => {
          const addonPrice = p.addonPrices[addon] || 0;
          const discountPercentage = p.addonDiscount || 0;
          const addonDiscountText = discountPercentage > 0 ? `${discountPercentage}%` : '-';
          const discountedAddonPrice = addonPrice * (1 - discountPercentage / 100);
          const qtyVal = p.addonQuantities?.[addon] ?? 1;

          let addDesc = `     - Add-on: ${addon}`;
          if (discountPercentage > 0) {
            addDesc += ` (${discountPercentage}% Off)`;
          }

          printableRows.push({
            isSubItem: true,
            serialNo: '',
            description: addDesc,
            qty: `${qtyVal} unit${qtyVal > 1 ? 's' : ''}`,
            mrpPrice: addonPrice,
            discountText: addonDiscountText,
            specialPrice: discountedAddonPrice,
            lineTotal: discountedAddonPrice * qtyVal * p.quantity
          });
        });
      } else {
        // If Model is Unselected, render upholstery and addons as standalone unique serial-numbered items
        uphNames.forEach(uName => {
          const originalUphPrice = p.upholsteryPrices?.[uName] ?? (uName === p.upholstery ? p.upholsteryPrice : 0);
          const uphDiscountText = p.upholsteryDiscount && p.upholsteryDiscount > 0 ? `${p.upholsteryDiscount}%` : '-';
          const discountedUphPrice = originalUphPrice * (1 - (p.upholsteryDiscount || 0) / 100);
          const qtyVal = p.upholsteryQuantities?.[uName] ?? 1;

          let uphDesc = `Upholstery: ${uName}`;
          if (p.upholsteryDiscount && p.upholsteryDiscount > 0) {
            uphDesc += ` (${p.upholsteryDiscount}% Off)`;
          }

          printableRows.push({
            isSubItem: false,
            serialNo: (seqNo++).toString(),
            description: uphDesc,
            qty: `${qtyVal} Meter${qtyVal !== 1 ? 's' : ''}`,
            mrpPrice: originalUphPrice,
            discountText: uphDiscountText,
            specialPrice: discountedUphPrice,
            lineTotal: discountedUphPrice * qtyVal
          });
        });

        p.addons.forEach(addon => {
          const addonPrice = p.addonPrices[addon] || 0;
          const discountPercentage = p.addonDiscount || 0;
          const addonDiscountText = discountPercentage > 0 ? `${discountPercentage}%` : '-';
          const discountedAddonPrice = addonPrice * (1 - discountPercentage / 100);
          const qtyVal = p.addonQuantities?.[addon] ?? 1;

          let addDesc = `Add-on: ${addon}`;
          if (discountPercentage > 0) {
            addDesc += ` (${discountPercentage}% Off)`;
          }

          printableRows.push({
            isSubItem: false,
            serialNo: (seqNo++).toString(),
            description: addDesc,
            qty: qtyVal.toString(),
            mrpPrice: addonPrice,
            discountText: addonDiscountText,
            specialPrice: discountedAddonPrice,
            lineTotal: discountedAddonPrice * qtyVal
          });
        });
      }
    });

    printableRows.forEach((row, idx) => {
      const descLines = doc.splitTextToSize(row.description, descMaxWidth);
      const rowLineCount = descLines.length;
      
      // Calculate tighter row heights for sub-items that belong to a single parent design
      const rowH = row.isSubItem 
        ? Math.max(rowLineCount * 4 + 1.5, 6)
        : Math.max(rowLineCount * 4 + 4, 8);

      // Dynamically paginate if next item does not fit
      ensureSpace(rowH + 2, true);

      // Light background coloring for row
      if (row.isSubItem) {
        // Soft lighter background for grouped subitems
        doc.setFillColor('#FCFDFE');
        doc.rect(15, y, pageW - 30, rowH, 'F');
      } else if (idx % 2 === 1) {
        doc.setFillColor(C_LIGHT);
        doc.rect(15, y, pageW - 30, rowH, 'F');
      }

      // Draw bottom separator
      doc.setDrawColor('#F1F5F9');
      doc.setLineWidth(0.2);
      doc.line(15, y + rowH, pageW - 15, y + rowH);

      // Text offset alignment in row
      const textOffset = row.isSubItem ? 4 : 5;

      // No.
      if (row.serialNo) {
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(C_SLATE);
        doc.text(row.serialNo, 17, y + textOffset);
      }

      // Description
      if (row.isSubItem) {
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(C_SLATE);
      } else {
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(C_CHARCOAL);
      }
      doc.text(descLines, 27, y + textOffset);

      // Qty
      doc.setFont('Helvetica', row.isSubItem ? 'normal' : 'bold');
      doc.setTextColor(row.isSubItem ? C_SLATE : C_CHARCOAL);
      doc.text(row.qty, colQty, y + textOffset, { align: 'right' });

      // MRP Unit Price
      doc.text(row.mrpPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 }), colMRP, y + textOffset, { align: 'right' });

      // Discount column (drawn only when discount column exists)
      if (hasDiscount) {
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(C_SLATE);
        doc.text(row.discountText, colDiscount, y + textOffset, { align: 'right' });
      }

      // Special Price
      doc.setFont('Helvetica', row.isSubItem ? 'normal' : 'bold');
      doc.setTextColor(row.isSubItem ? C_SLATE : C_CHARCOAL);
      doc.text(row.specialPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 }), colSpecial, y + textOffset, { align: 'right' });

      // Line Total
      if (!row.isSubItem) {
        doc.setFont('Helvetica', 'bold');
      }
      doc.text(row.lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 }), colTotal, y + textOffset, { align: 'right' });

      y += rowH;
    });

    // 6. Summary lines block on right
    ensureSpace(38);
    y += 6;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(C_CHARCOAL);
    doc.text('Subtotal Value:', 130, y);
    doc.setFont('Helvetica', 'normal');
    const subtotalText = "Rs. " + subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    doc.text(subtotalText, 193, y, { align: 'right' });

    y += 4.5;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(C_SLATE);
    doc.text('GST @ 18% (Tax Included):', 130, y);
    const gstText = "Rs. " + gstIncludedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    doc.text(gstText, 193, y, { align: 'right' });

    y += 4.5;
    doc.text('Transportation Freight:', 130, y);
    doc.setFont('Helvetica', 'bold');
    if (freightType === 'included') {
      doc.text('Included', 193, y, { align: 'right' });
    } else {
      const freightText = "Rs. " + freightCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 });
      doc.text(freightText, 193, y, { align: 'right' });
    }

    // Highlighted grand total luxury panel in soft Champagne Tint and Gold border
    y += 5;
    doc.setFillColor(C_HIGHLIGHT);
    doc.setDrawColor(C_BORDER_GOLD);
    doc.setLineWidth(0.4);
    doc.rect(125, y, 70, 8.5, 'FD');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(C_GOLD);
    doc.text('Grand Total:', 129, y + 5.5);
    const grandText = "Rs. " + grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 });
    doc.text(grandText, 191, y + 5.5, { align: 'right' });

    y += 12;
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(C_SLATE);
    doc.text(`Amount in words:  ${amountInWords}`, 15, y);

    // Terms & Conditions block
    y += 6;
    const termsLines = getTermsByBrand();
    const lineSpacing = 3.0;
    
    // Split all terms in advance to get precise count of final wrapped lines
    const formattedLines: string[] = [];
    termsLines.forEach((term) => {
      const split = doc.splitTextToSize(term, pageW - 24);
      split.forEach((line, idx) => {
        if (idx === 0) {
          formattedLines.push(`•  ${line}`);
        } else {
          formattedLines.push(`   ${line}`); // indent wrapped parts for tidy look
        }
      });
    });
    
    const boxHeight = 5 + (formattedLines.length * lineSpacing) + 2;

    ensureSpace(boxHeight + 4);
    
    doc.setFillColor(C_LIGHT);
    doc.rect(12, y, pageW - 24, boxHeight, 'F');
    doc.setDrawColor('#E2E8F0');
    doc.rect(12, y, pageW - 24, boxHeight, 'S');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.0);
    doc.setTextColor(C_CHARCOAL);
    doc.text('STANDARD BRAND TERMS & REGULATORY CONDITIONS', 15, y + 4.0);

    y += 7.5;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(C_SLATE);

    formattedLines.forEach((line) => {
      doc.text(line, 15, y);
      y += lineSpacing;
    });

    // Add banking details beneath Terms and conditions:
    if (matchedBankDetails) {
      y += 5.0; // Margin after Terms & Conditions block

      const rawBankLines = matchedBankDetails.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
      const bankLineSpacing = 3.2;
      const formattedBankLines: string[] = [];
      
      rawBankLines.forEach((bankLine) => {
        const split = doc.splitTextToSize(bankLine, pageW - 24);
        split.forEach((line) => {
          formattedBankLines.push(line);
        });
      });
      
      if (formattedBankLines.length > 0) {
        const bankBoxHeight = 5 + (formattedBankLines.length * bankLineSpacing) + 3;
        ensureSpace(bankBoxHeight + 4);
        
        doc.setFillColor(C_LIGHT);
        doc.rect(12, y, pageW - 24, bankBoxHeight, 'F');
        doc.setDrawColor('#E2E8F0');
        doc.rect(12, y, pageW - 24, bankBoxHeight, 'S');

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7.0);
        doc.setTextColor(C_CHARCOAL);
        doc.text('OFFICIAL BANKING ACCOUNT DETAILS FOR DIRECT REMITTANCE', 15, y + 4.0);

        y += 7.5;
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(C_SLATE);

        formattedBankLines.forEach((line) => {
          doc.text(line, 15, y);
          y += bankLineSpacing;
        });
        
        y += 2.0; // Spacer
      }
    }

    return doc;
  };

  // Prefetch the brand brochure in background on mount so the first preview load is instant!
  useEffect(() => {
    const prefetchBrochureOnMount = async () => {
      if (!cachedBrochureBytes) {
        try {
          const bRes = await fetch('/api/brand-brochure');
          if (bRes.ok) {
            const bData = await bRes.json();
            if (bData.base64) {
              const binaryStr = atob(bData.base64);
              const bytes = new Uint8Array(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
              }
              cachedBrochureBytes = bytes.buffer;
            }
          }
        } catch (err) {
          console.error('[Prefetch] Error prefetching brand brochure:', err);
        }
      }
    };
    prefetchBrochureOnMount();
  }, []);

  const compileMergedPDFBytes = async (doc: jsPDF): Promise<Uint8Array> => {
    // Fetch real 2-page brochure PDF from Google Drive proxy (using fast module-level cache)
    let brochureBytes: ArrayBuffer | null = cachedBrochureBytes;
    if (!brochureBytes) {
      try {
        const bRes = await fetch('/api/brand-brochure');
        if (bRes.ok) {
          const bData = await bRes.json();
          if (bData.base64) {
            const binaryStr = atob(bData.base64);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            brochureBytes = bytes.buffer;
            cachedBrochureBytes = brochureBytes; // cache for subsequent clicks
          }
        }
      } catch (err) {
        console.error('Error fetching brand brochure PDF:', err);
      }
    }

    // Convert jsPDF to ArrayBuffer
    const pdfBytes = doc.output('arraybuffer');

    // Create a pdf-lib PDFDocument
    let mergedDoc = await PDFDocument.load(pdfBytes);

    // Append the fetched brochure PDF automatic pages
    if (brochureBytes) {
      try {
        const brochureDoc = await PDFDocument.load(brochureBytes);
        const copiedPages = await mergedDoc.copyPages(brochureDoc, brochureDoc.getPageIndices());
        copiedPages.forEach((page) => mergedDoc.addPage(page));
      } catch (err) {
        console.error('Error merging auto-attached brochure PDF:', err);
      }
    }

    // Append any manually uploaded custom files (PDF or Image)
    if (attachedFiles && attachedFiles.length > 0) {
      for (const file of attachedFiles) {
        if (file.type === 'pdf' && file.arrayBuffer) {
          try {
            const srcDoc = await PDFDocument.load(file.arrayBuffer);
            const copiedPages = await mergedDoc.copyPages(srcDoc, srcDoc.getPageIndices());
            copiedPages.forEach((page) => mergedDoc.addPage(page));
          } catch (err) {
            console.error('Error merging attached PDF:', file.name, err);
          }
        } else if (file.type === 'image' && file.base64Url) {
          try {
            const imagePage = mergedDoc.addPage([595.276, 841.890]); // standard A4 size in points
            const { width, height } = imagePage.getSize();
            
            const base64Data = file.base64Url.split(',')[1];
            const isPng = file.base64Url.startsWith('data:image/png');
            
            let embeddedImage;
            if (isPng) {
              embeddedImage = await mergedDoc.embedPng(Uint8Array.from(atob(base64Data), c => c.charCodeAt(0)));
            } else {
              embeddedImage = await mergedDoc.embedJpg(Uint8Array.from(atob(base64Data), c => c.charCodeAt(0)));
            }

            if (embeddedImage) {
              const margin = 20;
              const maxW = width - margin * 2;
              const maxH = height - margin * 2;
              const imgDims = embeddedImage.scale(1);
              
              let scaleVal = Math.min(maxW / imgDims.width, maxH / imgDims.height);
              if (scaleVal > 1) scaleVal = 1;
              
              const finalW = imgDims.width * scaleVal;
              const finalH = imgDims.height * scaleVal;
              
              const xPos = (width - finalW) / 2;
              const yPos = (height - finalH) / 2;
              
              imagePage.drawImage(embeddedImage, {
                x: xPos,
                y: yPos,
                width: finalW,
                height: finalH,
              });
            }
          } catch (err) {
            console.error('Error drawing image page:', file.name, err);
          }
        }
      }
    }

    return await mergedDoc.save();
  };

  const handleDownloadPDFLocal = async () => {
    const doc = generateCorePDF();
    try {
      const mergedPdfBytes = await compileMergedPDFBytes(doc);
      const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Proforma_Invoice_${quotationNumber || 'Draft'}_${clientName.replace(/\s+/g, '_') || 'Draft'}.pdf`;
      link.click();
      return mergedPdfBytes;
    } catch (mergeErr) {
      console.error('Error compiling merged PDF with pdf-lib, falling back to basic PDF:', mergeErr);
      doc.save(`Proforma_Invoice_${quotationNumber || 'Draft'}_${clientName.replace(/\s+/g, '_') || 'Draft'}.pdf`);
      return new Uint8Array(doc.output('arraybuffer'));
    }
  };

  // 7. Save to Cloud & Download PDF Consolidated Handler
  const handleDownloadAndSave = async () => {
    if (!clientName || !contactNumber) {
      alert('Please fill in Client Name and Contact Number before saving.');
      return;
    }

    try {
      setSyncStatus('saving');
      setCloudLinks(null);
      setErrorMessage('');

      // A. Compile the high-fidelity branded PDF locally (including all attached files & brochures) for fast local download
      const mergedPdfBytes = await handleDownloadPDFLocal();

      // B. Create lightweight text-only payload matching Google Sheets & Apps Script structures (no heavy base64 yet!)
      // This allows the initial POST request to fly across the network and save in real-time instantly under 200ms!
      const payloadTextOnly = {
        action: 'create-quotation',
        date: quotationDate,
        quotationNumber,
        opfCode,
        brandName: brand,
        clientName,
        mobileNumber: contactNumber,
        emailId,
        billingAddress,
        shippingAddress,
        subtotal,
        gstIncluded: gstIncludedAmount,
        freight: actualFreight,
        grandTotal,
        amountInWords,
        pdfBase64: '', // Empty in the fast step to bypass network upload lag!
        productsJson: JSON.stringify(products.map(p => ({
          ...p,
          // Legacy properties required by Google Apps Script formatting engine
          unitPrice: p.basePrice + p.upholsteryPrice + Object.values(p.addonPrices).reduce((a, b) => a + b, 0),
          total: calculateLineItemTotal(p)
        })))
      };

      // C. Submit the fast transaction to the database
      const res = await submitQuotationData(payloadTextOnly);

      if (res && res.status === 'success') {
        // D. Instantly mark UI as successful and remove loading state so salesperson is completely unblocked!
        setSyncStatus('success');
        setCloudLinks({
          docUrl: '',
          pdfUrl: 'Pending Upload...' // Visual indicator for the background uploader
        });
        localStorage.removeItem('little_nap_quote_draft');
        
        // Background refresh search history so it updates instantly in the search tab
        handleFetchHistory().catch(() => {});

        // E. Perform background PDF upload asynchronously using high-performance non-blocking FileReader
        if (mergedPdfBytes) {
          (async () => {
            try {
              console.log('[Background Browser Sync] Initiating non-blocking local base64 compilation...');
              const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
              
              const pdfBase64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                  const result = reader.result as string;
                  const base64 = result.split(',')[1];
                  resolve(base64);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });

              console.log('[Background Browser Sync] Sending background proxy upload to Drive for:', quotationNumber);
              const bgRes = await uploadPDFBackground({
                quotationNumber,
                clientName,
                pdfBase64
              });

              if (bgRes && bgRes.status === 'success' && bgRes.pdfUrl) {
                console.log('[Background Browser Sync] Fully synced high-fidelity PDF with Google Drive:', bgRes.pdfUrl);
                // Dynamically update success card link with the live Google Drive PDF link
                setCloudLinks({
                  docUrl: '',
                  pdfUrl: bgRes.pdfUrl
                });
                // Background refresh history once more so the list contains the real link
                handleFetchHistory().catch(() => {});
              } else {
                console.warn('[Background Browser Sync] background upload payload status warning:', bgRes);
              }
            } catch (bgErr) {
              console.error('[Background Browser Sync] Failed background upload:', bgErr);
            }
          })();
        }
      } else {
        throw new Error('Server returned failed save status');
      }
    } catch (err: any) {
      console.error('Cloud synchronization failure:', err);
      setSyncStatus('error');
      setErrorMessage(
        err.message || 'Database submission failed. The local print copy is fully generated, but please ensure your deployed Google Apps Script is active and updated.'
      );
    }
  };

  // 7.5 Real-Time Live Vector Print Preview Effect (includes automatic brochures & manually uploaded/attached files)
  useEffect(() => {
    let isCancelled = false;
    const timer = setTimeout(() => {
      const generatePreview = async () => {
        try {
          const coreDoc = generateCorePDF();
          let mergedPdfBytes: Uint8Array;
          try {
            mergedPdfBytes = await compileMergedPDFBytes(coreDoc);
          } catch (compileErr) {
            console.warn('Real-time compile fallback to basic doc:', compileErr);
            mergedPdfBytes = new Uint8Array(coreDoc.output('arraybuffer'));
          }

          if (isCancelled) return;

          const pdfBlob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
          const blobUrl = URL.createObjectURL(pdfBlob);
          setPreviewPdfUrl((prev) => {
            if (prev) {
              try {
                URL.revokeObjectURL(prev);
              } catch (revErr) {
                console.error('Revocation error:', revErr);
              }
            }
            return blobUrl;
          });
        } catch (err) {
          console.error('Error generating live print preview:', err);
        }
      };

      generatePreview();
    }, 450); // 450ms debounce guarantees lag-free user experience while typing!

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [
    brand,
    clientName,
    contactNumber,
    emailId,
    billingAddress,
    shippingAddress,
    quotationDate,
    quotationNumber,
    opfCode,
    products,
    freightType,
    freightCharges,
    matchedBankDetails,
    logoBase64,
    attachedFiles // Re-trigger live compilation when any document is attached or removed!
  ]);

  // 8. Fetch and Search history rows
  const handleFetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const data = await fetchQuotationHistory();
      // Reverse history so latest quotations are seen first!
      setHistory(data.reverse());
    } catch (err) {
      console.error('Failed to load history logs:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Fetch history when tab switches to 'history'
  useEffect(() => {
    if (activeTab === 'history') {
      handleFetchHistory();
    }
  }, [activeTab]);

  const handleReopenQuotation = (item: QuotationData) => {
    try {
      setBrand(item.brandName as any);
      setClientName(item.clientName);
      setContactNumber(item.mobileNumber);
      setEmailId(item.emailId || '');
      setBillingAddress(item.billingAddress);
      setShippingAddress(item.shippingAddress);
      setSameAddress(item.billingAddress === item.shippingAddress);
      setQuotationDate(item.date);
      setQuotationNumber(item.quotationNumber);
      setOpfCode(item.opfCode);
      
      let productsFormatted: ProductLineItem[] = [];
      try {
        let rawJson = (item.productsJson || '').trim();
        // Clear potential outer quotes from row value
        if (rawJson.startsWith('"') && rawJson.endsWith('"') && rawJson.length > 1) {
          rawJson = rawJson.slice(1, -1);
        }
        // Replace escaped CSV double quotes ("" -> ")
        rawJson = rawJson.replace(/""/g, '"');
        
        if (rawJson && rawJson !== '[]') {
          const parsedProducts = JSON.parse(rawJson);
          if (Array.isArray(parsedProducts)) {
            productsFormatted = parsedProducts.map((p: any, idx: number) => {
              return {
                id: p.id || idx.toString(),
                design: p.design || '',
                type: p.type || '',
                upholstery: p.upholstery || '',
                addons: p.addons || [],
                quantity: p.quantity || 1,
                basePrice: p.basePrice !== undefined ? p.basePrice : (p.unitPrice || 0),
                upholsteryPrice: p.upholsteryPrice || 0,
                addonPrices: p.addonPrices || {},
                modelDiscount: p.modelDiscount || 0,
                upholsteryDiscount: p.upholsteryDiscount || 0,
                addonDiscount: p.addonDiscount || 0,
                upholsteries: p.upholsteries || [],
                upholsteryPrices: p.upholsteryPrices || {},
                upholsteryQuantities: p.upholsteryQuantities || {},
                addonQuantities: p.addonQuantities || {}
              };
            });
          }
        }
      } catch (parseErr) {
        console.error('Failed to parse productsJson gracefully:', parseErr);
      }

      if (productsFormatted.length === 0) {
        productsFormatted = [{
          id: '1', design: '', type: '', upholstery: '', addons: [], quantity: 1, basePrice: 0, upholsteryPrice: 0, addonPrices: {}, modelDiscount: 0, upholsteryDiscount: 0, addonDiscount: 0
        }];
      }

      // Set products and reconstruct prices loosely from static options if possible
      setProducts(productsFormatted);
      
      if (productsFormatted.length > 0) {
        setActiveConfigProductId(productsFormatted[0].id);
        setConfigTab('design');
        setDesignSearch('');
        setUphSearch('');
        setAddonSearch('');
      }

      setFreightCharges(item.freight);
      setFreightType(item.freight > 0 ? 'manual' : 'included');
      setSyncStatus('idle');
      setCloudLinks(null);
      
      // Navigate to build tab
      setActiveTab('build');
    } catch (e) {
      alert('Error parsing historic products rows. Form fields loaded basic data.');
    }
  };

  // Filtered History
  const filteredHistory = history.filter(item => {
    const query = searchQuery.toLowerCase();
    const matchSearch = 
      item.quotationNumber.toLowerCase().includes(query) ||
      item.clientName.toLowerCase().includes(query) ||
      item.salespersonName.toLowerCase().includes(query);
      
    const matchBrand = selectedBrandFilter ? item.brandName === selectedBrandFilter : true;
    return matchSearch && matchBrand;
  });

  return (
    <div className="space-y-6">
      {/* Navigation header tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4 gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <FileText className="text-emerald-600" size={24} />
            Proforma Invoice Generator
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Build premium proforma invoices instantly and automatically catalog them in real-time.
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('build')}
            className={`flex-1 sm:flex-none h-10 px-5 rounded-lg font-semibold text-xs tracking-wide transition-all border ${
              activeTab === 'build'
                ? 'bg-slate-900 border-slate-950 text-white shadow'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Create New Proforma Invoice
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 sm:flex-none h-10 px-5 rounded-lg font-semibold text-xs tracking-wide transition-all border ${
              activeTab === 'history'
                ? 'bg-slate-900 border-slate-950 text-white shadow'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Search Tracking History
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'build' ? (
          <motion.div
            key="build-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 xl:grid-cols-12 gap-8"
          >
            {/* Form Column */}
            <div className="xl:col-span-7 space-y-6">
              
              {/* Draft Loader Option */}
              {localStorage.getItem('little_nap_quote_draft') && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-3 text-amber-900 text-sm">
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-amber-500 animate-pulse" size={18} />
                    <span>You have an saved auto-save draft. Would you like to restore it?</span>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={handleRestoreDraft}
                      className="px-3 h-8 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs transition-colors"
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => {
                        localStorage.removeItem('little_nap_quote_draft');
                        // force state refresh
                        setClientName(c => c);
                      }}
                      className="px-3 h-8 bg-stone-100 dark:hover:bg-amber-100 text-amber-800 font-medium rounded-lg text-xs hover:bg-amber-100 transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {/* BRAND SELECTION CARD */}
              <div className="luxury-card p-6 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">1. Select Brand</h3>
                <div className="grid grid-cols-3 gap-3">
                  {(['Little Nap', 'La-Z-Boy', 'Robocura'] as const).map(b => (
                    <button
                      key={b}
                      onClick={() => setBrand(b)}
                      className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                        brand === b
                          ? 'border-[#9B7C50] bg-amber-50/30 text-amber-950 shadow-md scale-[1.02]'
                          : 'border-slate-100 hover:border-slate-300 bg-white text-slate-600'
                      }`}
                    >
                      <span className="font-extrabold text-sm tracking-tight">{b}</span>
                      <span className="text-[10px] text-slate-400 font-medium">Predefined Terms</span>
                    </button>
                  ))}
                </div>

                {/* Real Corporate Logo Uploader */}
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Real Corporate Logo (.png, .jpg, .svg)
                    </label>
                    {localStorage.getItem('little_nap_custom_logo') && (
                      <button
                        type="button"
                        onClick={handleResetToDefaultLogo}
                        className="text-[10px] font-black text-rose-600 hover:text-rose-800 tracking-widest uppercase transition-colors"
                      >
                        Reset to default
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="relative flex-1">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                        id="logo-upload-input"
                      />
                      <label 
                        htmlFor="logo-upload-input"
                        className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-200 hover:border-[#9B7C50] rounded-xl bg-slate-50/50 text-slate-500 cursor-pointer hover:bg-slate-50 transition-all text-xs font-semibold"
                      >
                        <Upload className="text-slate-400 mb-1" size={20} />
                        <span>Click to upload your real logo image</span>
                        <span className="text-[9px] text-slate-400 font-medium font-mono mt-0.5">Supports PNG, JPG, SVG</span>
                      </label>
                    </div>
                    {logoBase64 && (
                      <div className="h-16 w-24 p-2 bg-white border border-slate-150 rounded-xl shrink-0 flex items-center justify-center shadow-sm">
                        <img 
                          src={logoBase64} 
                          className="max-h-full max-w-full object-contain" 
                          alt="Real Logo Active Preview" 
                          referrerPolicy="no-referrer" 
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* CUSTOMER INFORMATION CARD */}
              <div className="luxury-card p-6 space-y-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">2. Customer Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Client Name</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="text"
                        className="w-full pl-10 pr-4 h-12 glass-input outline-slate-300 text-sm font-medium"
                        placeholder="John Doe"
                        value={clientName}
                        onChange={e => setClientName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Contact Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="text"
                        className="w-full pl-10 pr-4 h-12 glass-input outline-slate-300 text-sm font-medium"
                        placeholder="+91 99999 99999"
                        value={contactNumber}
                        onChange={e => setContactNumber(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Email ID (Optional)</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="email"
                      className="w-full pl-10 pr-4 h-12 glass-input outline-slate-300 text-sm font-medium"
                      placeholder="john.doe@example.com"
                      value={emailId}
                      onChange={e => setEmailId(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Billing Address</label>
                    <div className="relative">
                      <textarea
                        rows={3}
                        className="w-full p-3 glass-input outline-slate-300 text-sm font-medium"
                        placeholder="Enter full billing address"
                        value={billingAddress}
                        onChange={e => handleBillingAddressChange(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Shipping Address</label>
                      <button
                        type="button"
                        onClick={handleSameAddressToggle}
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded transition-all ${
                          sameAddress 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-slate-100 text-slate-600 border hover:bg-slate-200'
                        }`}
                      >
                        {sameAddress ? '✓ Same as Billing' : 'Enter Manually'}
                      </button>
                    </div>
                    <div className="relative">
                      <textarea
                        rows={3}
                        className={`w-full p-3 glass-input outline-slate-300 text-sm font-medium ${
                          sameAddress ? 'bg-slate-50 text-slate-400 cursor-not-allowed opacity-80' : ''
                        }`}
                        placeholder="Enter shipping address"
                        value={shippingAddress}
                        onChange={e => setShippingAddress(e.target.value)}
                        disabled={sameAddress}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* PROFORMA INVOICE PARTICULARS */}
              <div className="luxury-card p-6 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">3. Proforma Invoice Particulars</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Proforma Invoice Date (Unchangeable)</label>
                    <div className="relative">
                      <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="date"
                        className="w-full pl-10 pr-4 h-12 glass-input outline-slate-300 text-sm font-medium bg-slate-100/50 dark:bg-slate-800/50 cursor-not-allowed opacity-80"
                        value={quotationDate}
                        readOnly
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Proforma Invoice Number (Auto-generated)</label>
                    <input
                      type="text"
                      className="w-full px-4 h-12 glass-input outline-slate-300 text-sm font-bold tracking-tight bg-slate-100/50 dark:bg-slate-800/50 cursor-not-allowed opacity-80"
                      value={quotationNumber}
                      readOnly
                    />
                  </div>
                </div>
              </div>

              {/* PRODUCT SELECTION CARD */}
              <div className="luxury-card p-6 space-y-5">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">4. Products selection</h3>
                    <p className="text-[10px] text-slate-400 mt-1">Configure models, mechanisms, materials, and tech comfort upgrades list.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddProductRow}
                    className="h-9 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <Plus size={14} />
                    Add Product Line
                  </button>
                </div>

                <div className="space-y-4">
                  {products.map((item, index) => {
                    const isExpanded = activeConfigProductId === item.id;
                    
                    if (isExpanded) {
                      // Filter options for searches
                      const filteredDesigns = designs.filter(d => 
                        d.toLowerCase().includes(designSearch.toLowerCase())
                      );
                      const filteredUph = upholsteryList.filter(u => 
                        u.name.toLowerCase().includes(uphSearch.toLowerCase())
                      );
                      const filteredAddons = addonsList.filter(a => 
                        a.name.toLowerCase().includes(addonSearch.toLowerCase())
                      );

                      return (
                        <div 
                          key={item.id} 
                          className="p-5 bg-white/80 rounded-2xl border-2 border-emerald-500 shadow-md space-y-5 transition-all relative"
                        >
                          {/* Expanded Header details */}
                          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px] shadow-sm">
                                {index + 1}
                              </span>
                              <span className="font-extrabold text-slate-800 text-sm tracking-tight">Active Configurator Workspace</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setActiveConfigProductId(null)}
                                className="text-[10px] font-bold text-slate-500 hover:text-slate-800 px-2.5 h-7 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
                                title="Collapse Configurator"
                              >
                                Collapse View
                              </button>
                              {products.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveProductRow(item.id)}
                                  className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50"
                                  title="Remove Item"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Sub-tab Pill Navigation */}
                          <div className="flex border-b border-slate-100 pb-3 gap-2 overflow-x-auto no-scrollbar">
                            <button
                              type="button"
                              onClick={() => setConfigTab('design')}
                              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold text-xs transition-all shrink-0 border ${
                                configTab === 'design'
                                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                                  : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-140'
                              }`}
                            >
                              <Layers size={13} />
                              <span>1. Model & Quantity</span>
                              {item.design ? (
                                <span className="ml-1 bg-white/20 text-[9px] px-1.5 py-0.5 rounded-full font-extrabold text-white">✓</span>
                              ) : (
                                <span className="ml-1 bg-rose-500 text-[9px] w-1.5 h-1.5 rounded-full inline-block animate-pulse"></span>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => setConfigTab('upholstery')}
                              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold text-xs transition-all shrink-0 border ${
                                configTab === 'upholstery'
                                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                                  : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-140'
                              }`}
                            >
                              <Sparkle size={13} />
                              <span>2. Premium Upholstery</span>
                              {item.upholstery ? (
                                <span className="ml-1 bg-white/20 text-[9px] px-1.5 py-0.5 rounded-full font-extrabold text-white">✓</span>
                              ) : null}
                            </button>

                            <button
                              type="button"
                              onClick={() => setConfigTab('addons')}
                              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-bold text-xs transition-all shrink-0 border ${
                                configTab === 'addons'
                                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                                  : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-140'
                              }`}
                            >
                              <Sliders size={13} />
                              <span>3. Upgrades & Add-ons</span>
                              {item.addons.length > 0 ? (
                                <span className="ml-1 bg-white/20 text-[9px] px-1.5 py-0.5 rounded-full font-extrabold text-white">
                                  +{item.addons.length}
                                </span>
                              ) : null}
                            </button>
                          </div>

                          {/* Sub-tab Content Workspace */}
                          <div className="space-y-4">
                            
                            {/* Step 1 Content */}
                            {configTab === 'design' && (
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                                    <span>SEARCH RECLINER DESIGNS ({designs.length} MODELS AVAILABLE)</span>
                                    {item.design && (
                                      <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                                        Selected: {item.design}
                                      </span>
                                    )}
                                  </div>
                                  <div className="relative">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 animate-pulse" size={14} />
                                    <input
                                      type="text"
                                      className="w-full pl-9 pr-4 h-10 bg-slate-50 hover:bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-semibold outline-slate-400 placeholder:text-slate-400"
                                      placeholder="Type model name (e.g. Silverado, Milan, Premium, Cosmo...)"
                                      value={designSearch}
                                      onChange={e => setDesignSearch(e.target.value)}
                                    />
                                  </div>
                                </div>

                                <div className="max-h-48 overflow-y-auto border border-slate-100 bg-slate-50/30 rounded-xl p-2 custom-scrollbar">
                                  {filteredDesigns.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                                      {filteredDesigns.map(d => {
                                        const isSelected = item.design === d;
                                        return (
                                          <button
                                            key={d}
                                            type="button"
                                            onClick={() => {
                                              handleProductChange(index, 'design', d);
                                            }}
                                            className={`px-3 py-2.5 rounded-xl text-left transition-all text-xs font-bold flex items-center justify-between border ${
                                              isSelected
                                                ? 'bg-slate-900 border-slate-900 text-white ring-2 ring-emerald-500 ring-offset-1'
                                                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-350'
                                            }`}
                                          >
                                            <span className="truncate">{d}</span>
                                            {isSelected ? (
                                              <Check size={12} className="text-emerald-400 shrink-0" />
                                            ) : (
                                              <ChevronDown size={11} className="text-slate-300 shrink-0" />
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="text-center py-6 text-xs text-slate-400 font-semibold">
                                      No models match your filter query.
                                    </div>
                                  )}
                                </div>

                                {/* Mechanism Selection Area */}
                                {item.design && designTypesMap[item.design]?.length > 0 && (
                                  <div className="space-y-2 pt-1">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                      Mechanism / Subtype Option
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                      {designTypesMap[item.design].map(type => {
                                        const isSelected = item.type === type;
                                        const matchingOption = options.find(o => o.design === item.design && o.type === type);
                                        const baseRate = matchingOption ? matchingOption.price : 0;
                                        return (
                                          <button
                                            key={type}
                                            type="button"
                                            onClick={() => handleProductChange(index, 'type', type)}
                                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                                              isSelected
                                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                                                : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50 hover:border-slate-300'
                                            }`}
                                          >
                                            <span>{type}</span>
                                            <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                                              (₹{baseRate.toLocaleString('en-IN')})
                                            </span>
                                            {isSelected && <Check size={11} />}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Quantity Incrementor */}
                                <div className="bg-slate-50 rounded-xl p-3.5 flex items-center justify-between border border-slate-100">
                                  <div className="space-y-0.5">
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Configure Quantity</span>
                                    <span className="text-[11px] text-slate-400 font-medium">Customize quantity for this config line</span>
                                  </div>
                                  <div className="flex items-center gap-3.5 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                                    <button
                                      type="button"
                                      onClick={() => handleProductChange(index, 'quantity', Math.max(1, item.quantity - 1))}
                                      className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 active:scale-90 transition-all outline-none"
                                    >
                                      -
                                    </button>
                                    <span className="w-8 text-center font-black text-slate-800 text-sm">{item.quantity}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleProductChange(index, 'quantity', item.quantity + 1)}
                                      className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 flex items-center justify-center font-bold text-slate-700 active:scale-90 transition-all outline-none"
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>

                                {/* Discount & Special Price for Model & Quantity */}
                                <div className="bg-amber-50/50 rounded-xl p-3.5 border border-amber-100 space-y-3">
                                  <div className="flex justify-between items-center">
                                    <div className="space-y-0.5">
                                      <span className="block text-[10px] font-black text-amber-900 uppercase tracking-wider">🏷️ Model & Quantity Discount (%)</span>
                                      <span className="text-[10px] text-amber-700 font-semibold">Special discount for this recliner model & volume</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-white border border-amber-200 rounded-xl px-2 py-1 shadow-sm shrink-0">
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        step="0.5"
                                        placeholder="0"
                                        className="w-12 text-center font-black text-slate-800 text-xs outline-none"
                                        value={item.modelDiscount === 0 ? '' : item.modelDiscount}
                                        onChange={e => handleProductChange(index, 'modelDiscount', e.target.value)}
                                      />
                                      <span className="text-xs font-bold text-slate-500">%</span>
                                    </div>
                                  </div>

                                  {/* Special Price Display */}
                                  {item.basePrice > 0 && (
                                    <div className="flex justify-between items-center text-[10.5px] bg-white border border-dashed border-amber-200 rounded-xl p-2.5 font-bold text-slate-600">
                                      <span>Original: <span className="line-through">₹{(item.basePrice * item.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></span>
                                      <span className="text-amber-800">Special Net Rate: <span className="font-extrabold text-[#0F172A]">₹{((item.basePrice * (1 - (item.modelDiscount || 0) / 100)) * item.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                                         {/* Step 2 Content Upholstery */}
                            {configTab === 'upholstery' && (
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                                    <span>SELECT UPHOLSTERY FABRICS (CHOOSE MULTIPLE OPTIONS)</span>
                                    {item.upholsteries && item.upholsteries.length > 0 && (
                                      <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md font-bold">
                                        Selected: {item.upholsteries.length} Fabrics
                                      </span>
                                    )}
                                  </div>
                                  <div className="relative">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input
                                      type="text"
                                      className="w-full pl-9 pr-4 h-10 bg-slate-50 hover:bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-semibold outline-slate-400 placeholder:text-slate-400"
                                      placeholder="Filter material types (e.g., Fabric, Full Leather, Premium Leather...)"
                                      value={uphSearch}
                                      onChange={e => setUphSearch(e.target.value)}
                                    />
                                  </div>
                                </div>

                                <div className="max-h-60 overflow-y-auto space-y-2 p-1 bg-slate-50/20 border border-slate-100 rounded-xl custom-scrollbar pr-2">
                                  {filteredUph.length > 0 ? filteredUph.map(u => {
                                    const uNames = item.upholsteries || (item.upholstery ? [item.upholstery] : []);
                                    const isSelected = uNames.includes(u.name);
                                    return (
                                      <button
                                        key={u.name}
                                        type="button"
                                        onClick={() => {
                                          const nextUph = isSelected
                                            ? uNames.filter(x => x !== u.name)
                                            : [...uNames, u.name];
                                          handleProductChange(index, 'upholstery', nextUph);
                                        }}
                                        className={`w-full p-3 rounded-xl text-left border transition-all flex items-center justify-between text-xs font-bold ${
                                          isSelected
                                            ? 'border-emerald-600 bg-emerald-50/40 text-emerald-950 shadow-sm ring-1 ring-emerald-500'
                                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                                        }`}
                                      >
                                        <div className="space-y-0.5">
                                          <span className="block font-bold text-slate-800">{u.name}</span>
                                          <span className="block text-[10px] text-slate-400 font-medium">Genuine premium upholstery grade</span>
                                        </div>
                                        <div className="flex items-center gap-2.5">
                                          <span className="block font-black text-slate-750">+₹{u.price.toLocaleString('en-IN')}</span>
                                          <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                                            isSelected
                                              ? 'bg-emerald-600 border-emerald-600 text-white'
                                              : 'border-slate-300 bg-white'
                                          }`}>
                                            {isSelected && <Check size={11} />}
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  }) : (
                                    <div className="text-center py-6 text-xs text-slate-400 font-medium">
                                      No upholstery configurations found matching your search.
                                    </div>
                                  )}
                                </div>

                                {/* Custom Upholstery Quantity Configurator */}
                                {item.upholsteries && item.upholsteries.length > 0 && (
                                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-3">
                                    <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                                      Configure Quantities for Selected Upholstery (Meters)
                                    </span>
                                    <div className="space-y-2">
                                      {item.upholsteries.map(uName => {
                                        const qty = item.upholsteryQuantities?.[uName] ?? 1;
                                        return (
                                          <div key={uName} className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200">
                                            <span className="text-[11px] font-bold text-slate-700 truncate max-w-[150px]">{uName}</span>
                                            <div className="flex items-center gap-1.5">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const newQty = Math.max(0.1, Math.round((qty - 0.5) * 10) / 10);
                                                  handleProductChange(index, 'upholsteryQuantity' as any, { name: uName, quantity: newQty });
                                                }}
                                                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 active:scale-95 transition-all outline-none text-xs"
                                              >
                                                -
                                              </button>
                                              <div className="flex items-center gap-1 bg-slate-50 border border-slate-250 rounded-lg px-2 py-0.5">
                                                <input
                                                  type="number"
                                                  step="0.1"
                                                  min="0.1"
                                                  value={qty === 0 ? '' : qty}
                                                  onChange={(e) => {
                                                    const rawVal = e.target.value;
                                                    const val = rawVal === '' ? 0 : parseFloat(rawVal);
                                                    handleProductChange(index, 'upholsteryQuantity' as any, { name: uName, quantity: isNaN(val) ? 0 : val });
                                                  }}
                                                  className="w-14 text-center font-black text-slate-800 text-xs bg-transparent outline-none h-6"
                                                />
                                                <span className="text-[9px] font-extrabold text-slate-400">Mtr</span>
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const newQty = Math.round((qty + 0.5) * 10) / 10;
                                                  handleProductChange(index, 'upholsteryQuantity' as any, { name: uName, quantity: newQty });
                                                }}
                                                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 active:scale-95 transition-all outline-none text-xs"
                                              >
                                                +
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Discount & Special Price for Premium Upholstery */}
                                {item.upholsteryPrice > 0 && (
                                  <div className="bg-amber-50/50 rounded-xl p-3.5 border border-amber-100 space-y-3 mt-3">
                                    <div className="flex justify-between items-center">
                                      <div className="space-y-0.5">
                                        <span className="block text-[10px] font-black text-amber-900 uppercase tracking-wider">🏷️ Premium Upholstery Discount (%)</span>
                                        <span className="text-[10px] text-amber-700 font-semibold">Special discount for chosen premium upholstery material</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 bg-white border border-amber-200 rounded-xl px-2 py-1 shadow-sm shrink-0">
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          step="0.5"
                                          placeholder="0"
                                          className="w-12 text-center font-black text-slate-800 text-xs outline-none"
                                          value={item.upholsteryDiscount === 0 ? '' : item.upholsteryDiscount}
                                          onChange={e => handleProductChange(index, 'upholsteryDiscount', e.target.value)}
                                        />
                                        <span className="text-xs font-bold text-slate-500">%</span>
                                      </div>
                                    </div>

                                    {/* Special Price Display */}
                                    <div className="flex justify-between items-center text-[10.5px] bg-white border border-dashed border-amber-200 rounded-xl p-2.5 font-bold text-slate-600">
                                      <span>Original Upholstery Sum: ₹{(item.upholsteryPrice * (item.design ? item.quantity : 1)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                                      <span className="text-amber-800">Special Material Rate: <span className="font-extrabold text-[#0F172A]">₹{((item.upholsteryPrice * (1 - (item.upholsteryDiscount || 0) / 100)) * (item.design ? item.quantity : 1)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Step 3 Content Add-ons */}
                            {configTab === 'addons' && (
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-400">
                                    <span>ADD-ONS AND TECH COMFORT FEATURES ({addonsList.length} UPGRADES)</span>
                                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">
                                      {item.addons.length} Add-ons Selected
                                    </span>
                                  </div>
                                  <div className="relative">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input
                                      type="text"
                                      className="w-full pl-9 pr-4 h-10 bg-slate-50 hover:bg-slate-50/70 border border-slate-200 rounded-xl text-xs font-semibold outline-slate-400 placeholder:text-slate-400"
                                      placeholder="Filter accessories list (e.g. Cup, Charger, Bluetooth, Swivel...)"
                                      value={addonSearch}
                                      onChange={e => setAddonSearch(e.target.value)}
                                    />
                                  </div>
                                </div>

                                <div className="max-h-60 overflow-y-auto p-1 bg-slate-50/20 border border-slate-100 rounded-xl custom-scrollbar pr-2">
                                  {filteredAddons.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {filteredAddons.map(addon => {
                                        const isChecked = item.addons.includes(addon.name);
                                        return (
                                          <button
                                            key={addon.name}
                                            type="button"
                                            onClick={() => {
                                              const nextAddons = isChecked
                                                ? item.addons.filter(x => x !== addon.name)
                                                : [...item.addons, addon.name];
                                              handleProductChange(index, 'addons', nextAddons);
                                            }}
                                            className={`p-3 rounded-xl text-left transition-all text-xs font-bold border flex items-center justify-between ${
                                              isChecked
                                                ? 'border-emerald-600 bg-emerald-50/40 text-emerald-950 shadow-sm ring-1 ring-emerald-500'
                                                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300'
                                            }`}
                                          >
                                            <div className="space-y-0.5 truncate mr-2">
                                              <span className="block truncate font-bold text-slate-800">{addon.name}</span>
                                              <span className="block text-[10px] text-slate-400 font-extrabold">+₹{addon.price.toLocaleString('en-IN')}</span>
                                            </div>
                                            <div className="shrink-0">
                                              <div className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                                                isChecked
                                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                                  : 'border-slate-300 bg-white'
                                              }`}>
                                                {isChecked && <Check size={11} />}
                                              </div>
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="text-center py-6 text-xs text-slate-400 font-medium">
                                      No technical upgrades match your query.
                                    </div>
                                  )}
                                </div>

                                {/* Selected Addons Quantities Editor */}
                                {item.addons.length > 0 && (
                                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-3 mt-3">
                                    <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                                      Configure Quantities for Selected Add-ons
                                    </span>
                                    <div className="space-y-2">
                                      {item.addons.map(addName => {
                                        const qty = item.addonQuantities?.[addName] ?? 1;
                                        return (
                                          <div key={addName} className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-200">
                                            <span className="text-[11px] font-bold text-slate-700 truncate max-w-[200px]">{addName}</span>
                                            <div className="flex items-center gap-2">
                                              <button
                                                type="button"
                                                onClick={() => handleProductChange(index, 'addonQuantity' as any, { name: addName, quantity: Math.max(1, qty - 1) })}
                                                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-705 active:scale-95 transition-all outline-none text-xs"
                                              >
                                                -
                                              </button>
                                              <span className="w-6 text-center font-black text-slate-800 text-xs">{qty}</span>
                                              <button
                                                type="button"
                                                onClick={() => handleProductChange(index, 'addonQuantity' as any, { name: addName, quantity: qty + 1 })}
                                                className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-705 active:scale-95 transition-all outline-none text-xs"
                                              >
                                                +
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* Discount & Special Price for Upgrades & Add-ons */}
                                {item.addons.length > 0 && (
                                  <div className="bg-amber-50/50 rounded-xl p-3.5 border border-amber-100 space-y-3 mt-3">
                                    <div className="flex justify-between items-center">
                                      <div className="space-y-0.5">
                                        <span className="block text-[10px] font-black text-amber-900 uppercase tracking-wider">🏷️ Upgrades & Add-ons Discount (%)</span>
                                        <span className="text-[10px] text-amber-700 font-semibold">Special discount for chosen customized comfort add-ons</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 bg-white border border-amber-200 rounded-xl px-2 py-1 shadow-sm shrink-0">
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          step="0.5"
                                          placeholder="0"
                                          className="w-12 text-center font-black text-slate-800 text-xs outline-none"
                                          value={item.addonDiscount === 0 ? '' : item.addonDiscount}
                                          onChange={e => handleProductChange(index, 'addonDiscount', e.target.value)}
                                        />
                                        <span className="text-xs font-bold text-slate-500">%</span>
                                      </div>
                                    </div>

                                    {/* Special Price Display */}
                                    {Object.keys(item.addonPrices).length > 0 && (
                                      <div className="flex justify-between items-center text-[10.5px] bg-white border border-dashed border-amber-200 rounded-xl p-2.5 font-bold text-slate-600">
                                        {(() => {
                                          const sumOriginalAddons = Object.entries(item.addonPrices).reduce((sum, [addName, p]) => {
                                            const qty = item.addonQuantities?.[addName] ?? 1;
                                            return sum + p * qty;
                                          }, 0);
                                          const originalTotalAddons = sumOriginalAddons * (item.design ? item.quantity : 1);
                                          const discountAmount = originalTotalAddons * (item.addonDiscount || 0) / 100;
                                          const discountedTotalAddons = originalTotalAddons - discountAmount;
                                          return (
                                            <>
                                              <span>Original Add-ons Sum: <span className="line-through">₹{originalTotalAddons.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></span>
                                              <span className="text-amber-800">Special Upgrade Rate: <span className="font-extrabold text-[#0F172A]">₹{discountedTotalAddons.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></span>
                                            </>
                                          );
                                        })()}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                          </div>

                          {/* Line and price totals calculation card */}
                          <div className="pt-4 border-t border-slate-200/50 flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
                            <div className="text-[10px] text-slate-400 font-medium flex flex-wrap gap-2">
                              <span>Base Unit: <strong className="text-slate-600">₹{item.basePrice.toLocaleString('en-IN')}</strong></span>
                              {item.upholsteryPrice > 0 && (
                                <span>+ Material: <strong className="text-slate-600">₹{item.upholsteryPrice.toLocaleString('en-IN')}</strong></span>
                              )}
                              {Object.keys(item.addonPrices).length > 0 && (
                                <span>+ Accessories: <strong className="text-slate-600">₹{Object.values(item.addonPrices).reduce((a, b) => a + b, 0).toLocaleString('en-IN')}</strong></span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 justify-between sm:justify-end">
                              <div className="text-right">
                                <span className="block text-[8px] uppercase font-black text-slate-400">Total item price</span>
                                {(() => {
                                  const origSum = (item.basePrice + item.upholsteryPrice + Object.values(item.addonPrices).reduce((a, b) => a + b, 0)) * item.quantity;
                                  const discAmt = calculateLineItemTotal(item);
                                  if (origSum > discAmt) {
                                    return <span className="line-through text-slate-400 text-xs mr-2 font-bold">₹{origSum.toLocaleString('en-IN')}</span>;
                                  }
                                  return null;
                                })()}
                                <span className="text-emerald-700 font-black text-base">₹{calculateLineItemTotal(item).toLocaleString('en-IN')}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setActiveConfigProductId(null)}
                                className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs transition-all flex items-center gap-1 shadow-sm"
                              >
                                <span>Done</span>
                                <Check size={13} />
                              </button>
                            </div>
                          </div>

                        </div>
                      );
                    }

                    // Collapsed high-density read-only visual sum card
                    return (
                      <div 
                        key={item.id} 
                        className="p-4 bg-slate-50/50 hover:bg-slate-50/90 rounded-2xl border border-slate-200 hover:border-slate-350 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
                        onClick={() => {
                          setActiveConfigProductId(item.id);
                          setConfigTab('design');
                        }}
                      >
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] font-black font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              Product #{index + 1}
                            </span>
                            {item.design ? (
                              <span className="font-extrabold text-slate-800 text-xs md:text-sm tracking-tight truncate">{item.design}</span>
                            ) : (
                              <span className="font-extrabold text-rose-500 italic text-xs md:text-sm flex items-center gap-1">
                                <AlertCircle size={13} />
                                Complete Configuration Pending...
                              </span>
                            )}
                            {item.quantity > 1 && (
                              <span className="bg-slate-200/60 text-slate-800 text-[9px] font-black px-1.5 py-0.5 rounded-full">
                                {item.quantity} units
                              </span>
                            )}
                          </div>
                          
                          {/* Selected characteristics badges */}
                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">
                            {item.type && (
                              <span>Type: <span className="text-slate-650 font-black">{item.type}</span></span>
                            )}
                            {item.upholstery ? (
                              <span className="text-amber-700">Material: <span className="text-amber-800 font-extrabold">{item.upholstery}</span></span>
                            ) : (
                              <span>Material: <span className="text-slate-500 bg-slate-100 px-1 rounded">Standard Catalog</span></span>
                            )}
                            {item.addons.length > 0 && (
                              <span className="text-emerald-700">Tech Upgrades: <span className="text-emerald-800 font-extrabold">+{item.addons.length} Add-ons</span></span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3.5 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                          <div className="text-left sm:text-right">
                            <span className="block text-[8px] uppercase tracking-wider font-extrabold text-slate-400">Section Subtotal</span>
                            <span className="font-black text-xs text-slate-800">
                              ₹{calculateLineItemTotal(item).toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveConfigProductId(item.id);
                                setConfigTab('design');
                              }}
                              className="h-8 px-2.5 bg-white border border-slate-200 text-slate-700 hover:text-slate-900 rounded-lg text-[11px] font-bold hover:border-slate-350 transition-all flex items-center gap-1"
                            >
                              <Sliders size={11} className="text-emerald-600" />
                              <span>Configure</span>
                            </button>
                            
                            {products.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveProductRow(item.id);
                                }}
                                className="h-8 w-8 bg-white border border-slate-200 text-slate-400 hover:text-rose-600 rounded-lg flex items-center justify-center transition-all hover:bg-rose-50 hover:border-rose-100"
                                title="Remove Item"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>

              {/* FREIGHT SETUP */}
              <div className="luxury-card p-6 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">5. Freight Setup</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setFreightType('included')}
                      className={`flex-1 h-12 rounded-xl font-bold text-xs transition-all border ${
                        freightType === 'included'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      Freight Included
                    </button>
                    <button
                      type="button"
                      onClick={() => setFreightType('manual')}
                      className={`flex-1 h-12 rounded-xl font-bold text-xs transition-all border ${
                        freightType === 'manual'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      Manual Freight Charge
                    </button>
                  </div>
                  {freightType === 'manual' && (
                    <div>
                      <input
                        type="number"
                        min="0"
                        className="w-full h-12 px-4 glass-input outline-slate-300 text-sm font-bold text-slate-700 placeholder:text-slate-400"
                        placeholder="Enter freight charge in INR"
                        value={freightCharges || ''}
                        onChange={e => setFreightCharges(Math.max(0, Number(e.target.value)))}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* EDITABLE TERMS AND CONDITIONS */}
              <div className="luxury-card p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div className="space-y-0.5">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">6. Terms & Conditions</h3>
                    <p className="text-[10px] text-slate-500 font-medium">Editable rules applied for {brand}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const defaults: Record<string, string[]> = {
                        'Little Nap': [
                          'Payment Terms: 50% advance along with PO, balance 50% before dispatch.',
                          'Delivery: Within 4-6 weeks from the date of advance and order confirmation.',
                          'Taxes: GST @ 18% included (CGST/SGST/IGST dynamically computed).',
                          'Warranty: 1-year comprehensive product warranty.',
                          'Validity: Quotation valid for 30 days.'
                        ],
                        'La-Z-Boy': [
                          'Payment Terms: 100% advance along with purchase order.',
                          'Delivery: Within 6-8 weeks from date of booking, subject to stock availability.',
                          'Taxes: GST @ 18% included inside invoice value.',
                          'Warranty: Limited lifetime warranty on the mechanism, 1-year product warranty on leather/foam.',
                          'Validity: This quotation is strictly valid for 15 days.'
                        ],
                        'Robocura': [
                          'Payment Terms: 100% advance for immediate shipping confirmation.',
                          'Delivery: Within 7-10 working days anywhere in India.',
                          'Taxes: GST @ 18% included inside product price.',
                          'Warranty: 1-year on-site comprehensive warranty.',
                          'Validity: Quotation remains valid for 7 working days.'
                        ]
                      };
                      setTermsList(prev => ({
                        ...prev,
                        [brand]: [...defaults[brand]]
                      }));
                    }}
                    className="text-[10px] font-black text-rose-600 hover:text-rose-800 tracking-wider uppercase transition-colors"
                  >
                    Reset Defaults
                  </button>
                </div>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {(termsList[brand] || []).map((term, index) => (
                    <div key={index} className="flex gap-2 items-start bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-mono font-bold text-slate-400 mt-2 shrink-0 select-none w-5 text-center">
                        #{index + 1}
                      </span>
                      <textarea
                        rows={2}
                        className="flex-1 text-xs bg-transparent border-none outline-none focus:ring-0 resize-none text-slate-700 font-medium"
                        value={term}
                        onChange={e => {
                          const updated = [...(termsList[brand] || [])];
                          updated[index] = e.target.value;
                          setTermsList(prev => ({
                            ...prev,
                            [brand]: updated
                          }));
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (termsList[brand] || []).filter((_, idx) => idx !== index);
                          setTermsList(prev => ({
                            ...prev,
                            [brand]: updated
                          }));
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 shrink-0 transition-all"
                        title="Delete this term"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  
                  {(termsList[brand] || []).length === 0 && (
                    <div className="text-center py-4 text-xs text-slate-400 font-medium">
                      No terms generated. Click below to add.
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setTermsList(prev => ({
                        ...prev,
                        [brand]: [...(prev[brand] || []), 'New custom term & conditions statement.']
                      }));
                    }}
                    className="w-full h-11 border border-dashed border-slate-200 hover:border-[#9B7C50] hover:bg-amber-50/20 text-[#9B7C50] rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all mt-2"
                  >
                    <Plus size={14} />
                    Add Custom Term Item
                  </button>

                  {matchedBankDetails && (
                    <div className="mt-4 pt-4 border-t border-dashed border-slate-150 p-3 bg-amber-50/10 rounded-xl border border-[#E5DFD4] shadow-sm">
                      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-700 tracking-wider mb-2">
                        <Building size={12} className="text-[#9B7C50]" />
                        <span>Matched Banking Details</span>
                        <span className="text-[8px] text-[#9B7C50] font-medium lowercase normal-case italic ml-auto bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200/30">
                          region: {salesperson?.showroom || salesperson?.region || 'Default'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-600 whitespace-pre-line leading-relaxed font-bold bg-white p-3 rounded-lg border border-slate-100 shadow-sm font-mono">
                        {matchedBankDetails}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 7. DOCUMENT UPLOADER & CUSTOM ATTACHMENTS */}
              <div className="luxury-card p-6 space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">7. Document Upload & Custom Attachments</h3>
                  <p className="text-[10px] text-slate-500 font-medium">Configure marketing materials or append custom reference reports permanently to the PDF download</p>
                </div>

                {/* File Upload Zone */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Append Extra Documents (PDF / Images)</label>
                  <div 
                    onClick={() => document.getElementById('custom-file-upload')?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const droppedFiles = Array.from(e.dataTransfer.files || []);
                      processUploadedFiles(droppedFiles);
                    }}
                    className="border-2 border-dashed border-slate-200 hover:border-[#9B7C50] hover:bg-slate-50/50 rounded-xl p-6 text-center cursor-pointer transition-all space-y-2 group"
                  >
                    <input 
                      id="custom-file-upload" 
                      type="file" 
                      multiple 
                      accept=".pdf,image/png,image/jpeg,image/jpg" 
                      className="hidden" 
                      onChange={(e) => {
                        const selectedFiles = Array.from(e.target.files || []);
                        processUploadedFiles(selectedFiles);
                      }}
                    />
                    <div className="mx-auto w-10 h-10 rounded-full bg-slate-100 group-hover:bg-amber-50 flex items-center justify-center text-slate-400 group-hover:text-[#9B7C50] transition-colors">
                      <Plus size={20} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-black text-slate-700">Click to upload or drag & drop files here</p>
                      <p className="text-[10px] text-slate-400 font-semibold">Supports .pdf documents, .png, or .jpeg images. They keep adding in sequence.</p>
                    </div>
                  </div>
                </div>

                {/* Uploaded Files Table */}
                {attachedFiles.length > 0 && (
                  <div className="space-y-2">
                    <span className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">Currently Appended Extra Files ({attachedFiles.length})</span>
                    <div className="divide-y divide-slate-100 border border-slate-150 rounded-xl overflow-hidden bg-white">
                      {attachedFiles.map((file, fIdx) => (
                        <div key={file.id} className="flex items-center justify-between p-3 hover:bg-slate-50/50 text-[11px] transition-all">
                          <div className="flex items-center gap-2.5 min-w-0 pr-4">
                            <span className="text-slate-400 font-mono text-[10px] select-none font-bold">#{fIdx + 1}</span>
                            <div className={`p-1.5 rounded-lg font-bold shrink-0 text-[10px] uppercase font-mono ${
                              file.type === 'pdf' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                            }`}>
                              {file.type}
                            </div>
                            <span className="font-extrabold text-slate-800 truncate" title={file.name}>
                              {file.name}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setAttachedFiles(prev => prev.filter(item => item.id !== file.id));
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-all"
                            title="Remove attachment"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ACTION TOOLS PANEL */}
              <div className="luxury-card p-6 space-y-4">
                <div className="w-full">
                  <Button
                    type="button"
                    onClick={handleDownloadAndSave}
                    disabled={syncStatus === 'saving'}
                    className="h-14 w-full rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition-all shadow-lg flex items-center justify-center gap-2 text-sm"
                  >
                    {syncStatus === 'saving' ? (
                      <>
                        <RefreshCw className="animate-spin text-white" size={18} />
                        Saving & Generating Documents...
                      </>
                    ) : (
                      <>
                        <Download size={18} />
                        Download Proforma Invoice
                      </>
                    )}
                  </Button>
                </div>

                <div className="flex justify-between items-center text-xs font-semibold pt-1">
                  <button
                    onClick={handleResetForm}
                    className="text-rose-600 hover:text-rose-700 hover:underline transition-all"
                  >
                    Reset Invoice Form
                  </button>
                  <span className="text-slate-400">Employee Account: {salesperson.name}</span>
                </div>

                {/* Integration Logs / Status Displays */}
                {syncStatus === 'success' && cloudLinks && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3"
                  >
                    <div className="flex items-center gap-2 text-amber-950 font-bold text-xs uppercase tracking-wide">
                      <FileCheck className="text-[#9B7C50]" size={16} />
                      Google Workspace Sync Complete
                    </div>
                    <p className="text-xs text-amber-900">
                      {cloudLinks.pdfUrl === 'Pending Upload...' ? (
                        <span>Successfully appended to Google Sheet spreadsheet (PI (Data)) in real-time! Your high-fidelity PDF document is being uploaded directly to Google Drive in the background.</span>
                      ) : (
                        <span>Successfully appended to Google Sheet spreadsheet (PI (Data)) and saved a print-ready PDF duplicate directly in Google Drive!</span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1 font-bold text-xs">
                      {cloudLinks.pdfUrl && cloudLinks.pdfUrl !== 'Pending Upload...' && (
                        <a
                          href={cloudLinks.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-950 rounded-lg flex items-center gap-1.5 transition-colors"
                        >
                          <ExternalLink size={14} />
                          Open Drive PDF Link
                        </a>
                      )}
                      {cloudLinks.pdfUrl === 'Pending Upload...' && (
                        <div className="flex items-center gap-2.5 text-amber-800 bg-amber-100/50 px-3 py-2 rounded-lg text-xs font-semibold select-none border border-amber-200">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-600"></span>
                          </span>
                          <span>Uploading PDF copy to Google Drive in background...</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {syncStatus === 'error' && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 space-y-2 text-xs"
                  >
                    <div className="flex items-center gap-2 font-bold uppercase tracking-wide">
                      <AlertCircle className="text-rose-600" size={16} />
                      Sync Alert
                    </div>
                    <p className="font-medium text-rose-800 leading-relaxed">
                      {errorMessage}
                    </p>
                    <p className="text-slate-500 font-mono text-[10px] leading-relaxed">
                      Developer info: Update Google Apps Script with the blueprint inside google-apps-script.js to activate complete synchronization of sheets and drive automatically on click.
                    </p>
                  </motion.div>
                )}
              </div>

            </div>

            {/* Print preview Column */}
            <div className="xl:col-span-5 relative">
              <div className="sticky top-28 space-y-4">
                <div className="flex justify-between items-center text-xs font-bold text-slate-400 px-1">
                  <span>REAL-TIME PRINT PREVIEW</span>
                  <button
                    onClick={handlePrintLocal}
                    className="flex items-center gap-1 hover:text-slate-600 transition-colors"
                  >
                    <Printer size={14} />
                    Browser Print
                  </button>
                </div>
                {/* THE FLOATING PAPER SHEET / LIVE PDF IFRAME */}
                <div className="bg-white rounded-3xl shadow-2xl border border-slate-150 text-slate-800 relative overflow-hidden h-[950px] mb-4">
                  {previewPdfUrl ? (
                    <iframe
                      src={`${previewPdfUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                      className="w-full h-full border-none rounded-3xl"
                      title="Proforma Invoice Real-Time PDF Preview"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3">
                      <RefreshCw className="animate-spin text-slate-400" size={32} />
                      <p className="font-bold text-sm tracking-wide">Generating pixel-perfect PDF preview...</p>
                    </div>
                  )}
                </div>

                {/* Legacy offline print element kept hidden for background page queries */}
                <div className="bg-white rounded-3xl shadow-2xl border border-slate-150 p-10 text-slate-800 space-y-8 md:min-h-[900px] relative overflow-hidden hidden" id="paper-printable-view">
                  
                  {/* Top luxury decorative brand strip */}
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#9B7C50]"></div>

                  {/* BRAND HEADER */}
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-1">
                    <div className="flex gap-4 items-center">
                      {logoBase64 ? (
                        <img src={logoBase64} alt="Little Nap Logo" className="h-12 w-auto object-contain shrink-0" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="h-12 w-32 bg-[#9B7C50] flex flex-col items-center justify-center text-white shrink-0 rounded-lg">
                          <span className="text-[10px] font-black tracking-widest leading-none">LITTLE NAP</span>
                          <span className="text-[4px] font-bold tracking-widest text-[#FAF7F2] mt-1 uppercase">Premium Recliners</span>
                        </div>
                      )}
                      <div className="text-left border-l border-slate-200 pl-4">
                        <h4 className="text-sm font-black tracking-tight text-slate-900 leading-none">
                          LITTLE NAP RECLINERS
                        </h4>
                        <p className="text-[9px] text-[#9B7C50] font-bold tracking-wider mt-1">
                          Email ID: enquiry@littlenap.in
                        </p>
                        <p className="text-[8px] text-slate-500 leading-snug mt-1 font-semibold max-w-[200px]">
                          Corporate Office: 844, M.G.Road, Ghitorni, New Delhi - 110030
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right sm:text-right w-full sm:w-auto">
                      <h4 className="text-base font-black tracking-wider text-[#0F172A] leading-none">
                        PROFORMA INVOICE
                      </h4>
                      <div className="text-[9px] text-slate-400 font-bold tracking-widest uppercase mt-1">
                        {brand}
                      </div>
                      <div className="text-[9px] text-slate-500 font-bold tracking-tight mt-1 bg-slate-50 border border-slate-100 rounded px-2 py-0.5 inline-block">
                        REF: {quotationNumber || 'DRAFT'}
                      </div>
                    </div>
                  </div>
                  <div className="h-px w-full bg-gradient-to-r from-slate-200 via-slate-100 to-transparent"></div>

                  {/* INFO BAR */}
                  <div className="grid grid-cols-2 gap-4 text-[10px] bg-slate-50/50 rounded-2xl p-4 border border-slate-100 font-semibold text-slate-600">
                    <div className="space-y-1.5 border-r border-slate-200/60 pr-2">
                      <div><span className="text-slate-400 font-black uppercase tracking-wider block sm:inline mr-1 text-[9px]">Invoice Date:</span> <span className="text-slate-900">{quotationDate}</span></div>
                      <div><span className="text-slate-400 font-black uppercase tracking-wider block sm:inline mr-1 text-[9px]">Invoice No:</span> <span className="text-slate-900">{quotationNumber}</span></div>
                    </div>
                    <div className="space-y-1.5 text-right pl-2">
                      <div><span className="text-slate-400 font-black uppercase tracking-wider block sm:inline mr-1 text-[9px]">Created By:</span> <span className="text-slate-900">{salesperson.name}</span></div>
                      <div><span className="text-slate-400 font-black uppercase tracking-wider block sm:inline mr-1 text-[9px]">Employee Code:</span> <span className="text-slate-900">{salesperson.id || 'N/A'}</span></div>
                    </div>
                  </div>

                  {/* CUSTOMER BLOCK */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-3.5 bg-slate-800 rounded-full block"></span>
                      <div className="font-extrabold text-[#0F172A] uppercase tracking-wider text-[11px]">Client & Delivery Particulars</div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[10px] bg-white p-4 rounded-2xl border border-slate-150">
                      <div>
                        <div className="mb-1"><span className="text-slate-400 font-bold uppercase text-[9px] mr-1">Client Name:</span> <span className="text-slate-900 font-extrabold">{clientName || '---'}</span></div>
                        <div><span className="text-slate-400 font-bold uppercase text-[9px] mr-1">Phone Number:</span> <span className="text-slate-900 font-extrabold">{contactNumber || '---'}</span></div>
                        <div className="mt-1"><span className="text-slate-400 font-bold uppercase text-[9px] mr-1">Email Identifier:</span> <span className="text-slate-900 font-bold">{emailId || '---'}</span></div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 pt-1 border-t sm:border-t-0 sm:border-l border-slate-150 sm:pl-4">
                        <div>
                          <span className="text-slate-400 font-black text-[9px] uppercase tracking-wider block mb-1">Billing Location</span>
                          <span className="text-slate-650 leading-relaxed font-semibold block max-h-16 overflow-y-auto">{billingAddress || 'Not specified'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 font-black text-[9px] uppercase tracking-wider block mb-1">Shipping Destination</span>
                          <span className="text-slate-650 leading-relaxed font-semibold block max-h-16 overflow-y-auto">{shippingAddress || 'Not specified'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* PRODUCTS TABLE */}
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-3.5 bg-slate-800 rounded-full block"></span>
                      <div className="font-extrabold text-[#0F172A] uppercase tracking-wider text-[11px]">Product Selection & Customization</div>
                    </div>
                    <div className="overflow-hidden border border-slate-200 rounded-2xl">
                      <table className="w-full text-left border-collapse text-[10px]">
                        <thead>
                          <tr className="bg-[#1E293B] text-white font-bold uppercase text-[9px] tracking-wider">
                            <th className="py-3 px-4 w-12 text-center">Sr.No.</th>
                            <th className="py-3 px-2">Item Design & Personalization Specs</th>
                            <th className="py-3 px-2 text-right w-12">Qty</th>
                            <th className="py-3 px-4 text-right w-28 leading-tight">
                              <div>MRP (Rs.)</div>
                              <span className="text-[7.5px] font-medium text-slate-350 uppercase tracking-normal mt-0.5 block">(GST Included)</span>
                            </th>
                            <th className="py-3 px-4 text-center w-24">Discount</th>
                            <th className="py-3 px-4 text-right w-28">Special Price (Rs.)</th>
                            <th className="py-3 px-4 text-right w-28">Total Amount (Rs.)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {(() => {
                            let sNo = 1;
                            return products.map((p) => {
                              const isModelSelected = !!p.design;
                              const uphNames = p.upholsteries || (p.upholstery ? [p.upholstery] : []);

                              if (isModelSelected) {
                                const modelPrice = p.basePrice * (1 - (p.modelDiscount || 0) / 100);
                                const modelLineTotal = modelPrice * p.quantity;
                                const currentSNo = sNo++;

                                return (
                                  <React.Fragment key={p.id}>
                                    {/* Base product row */}
                                    <tr className="hover:bg-slate-50/50 transition-colors">
                                      <td className="py-3 px-4 font-bold text-slate-400 text-center">{currentSNo}</td>
                                      <td className="py-3 px-2">
                                        <span className="font-extrabold text-slate-900 block text-[11px]">{p.design}</span>
                                        {p.type && (
                                          <span className="inline-block bg-slate-100 text-slate-700 text-[8px] font-extrabold px-1.5 py-0.5 rounded leading-none mt-1 border border-slate-205">
                                            {p.type}
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-3 px-2 text-right font-black text-slate-900 text-xs">{p.quantity}</td>
                                      {/* MRP Unit Price */}
                                      <td className="py-3 px-4 text-right font-semibold text-slate-700">
                                        {p.basePrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                      </td>
                                      {/* Discount */}
                                      <td className="py-3 px-4 text-center">
                                        {p.modelDiscount && p.modelDiscount > 0 ? (
                                          <span className="inline-block bg-amber-50 text-amber-700 font-extrabold text-[9px] px-2 py-0.5 rounded border border-amber-200">
                                            {p.modelDiscount}% Off
                                          </span>
                                        ) : (
                                          <span className="text-slate-400 font-medium">-</span>
                                        )}
                                      </td>
                                      {/* Special Price */}
                                      <td className="py-3 px-4 text-right text-slate-950 font-extrabold">
                                        {modelPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                      </td>
                                      {/* Line Amount */}
                                      <td className="py-3 px-4 text-right font-black text-[#0F172A] text-xs">
                                        {modelLineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                      </td>
                                    </tr>

                                    {/* Upholstery sub-rows (tight spacing!) */}
                                    {uphNames.map((uName) => {
                                      const originalUphPrice = p.upholsteryPrices?.[uName] ?? (uName === p.upholstery ? p.upholsteryPrice : 0);
                                      const uphNetPrice = originalUphPrice * (1 - (p.upholsteryDiscount || 0) / 100);
                                      const qtyVal = p.upholsteryQuantities?.[uName] ?? 1;
                                      const uphLineTotal = uphNetPrice * qtyVal * p.quantity;

                                      return (
                                        <tr key={uName} className="bg-[#FAFBFD]/60 border-t-0">
                                          <td className="py-1 px-4"></td>
                                          <td className="py-1 px-2 border-t-0">
                                            <div className="pl-6 text-[9px] text-slate-500 font-semibold flex items-center gap-1.5">
                                              <span className="text-slate-300 font-extrabold font-mono">└─</span>
                                              <span>Upholstery: &nbsp;<strong className="text-slate-700 font-extrabold">{uName}</strong></span>
                                            </div>
                                          </td>
                                          <td className="py-1 px-2 text-right text-slate-500 text-[10px] border-t-0">
                                            {qtyVal} Meter{qtyVal !== 1 ? 's' : ''}
                                          </td>
                                          {/* MRP Unit Price */}
                                          <td className="py-1 px-4 text-right text-slate-500 font-medium border-t-0">
                                            {originalUphPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                          </td>
                                          {/* Discount */}
                                          <td className="py-1 px-4 text-center border-t-0">
                                            {p.upholsteryDiscount && p.upholsteryDiscount > 0 ? (
                                              <span className="inline-block bg-amber-50 text-amber-700 font-extrabold text-[8px] px-1.5 py-0.2 rounded border border-amber-200">
                                                {p.upholsteryDiscount}% Off
                                              </span>
                                            ) : (
                                              <span className="text-slate-405 font-medium">-</span>
                                            )}
                                          </td>
                                          {/* Special Price */}
                                          <td className="py-1 px-4 text-right text-slate-900 font-bold border-t-0">
                                            {uphNetPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                          </td>
                                          {/* Line Amount */}
                                          <td className="py-1 px-4 text-right text-slate-600 font-semibold border-t-0">
                                            {uphLineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                          </td>
                                        </tr>
                                      );
                                    })}

                                    {/* Addon sub-rows (tight spacing!) */}
                                    {p.addons.map((addon) => {
                                      const addonPrice = p.addonPrices[addon] || 0;
                                      const discountPercentage = p.addonDiscount || 0;
                                      const addonNetPrice = addonPrice * (1 - discountPercentage / 100);
                                      const qtyVal = p.addonQuantities?.[addon] ?? 1;
                                      const addonLineTotal = addonNetPrice * qtyVal * p.quantity;

                                      return (
                                        <tr key={addon} className="bg-[#FAFBFD]/60 border-t-0">
                                          <td className="py-1 px-4"></td>
                                          <td className="py-1 px-2 border-t-0">
                                            <div className="pl-6 text-[9px] text-slate-500 font-semibold flex items-center gap-1.5">
                                              <span className="text-slate-300 font-extrabold font-mono">└─</span>
                                              <span>Add-on: &nbsp;<strong className="text-slate-700 font-extrabold">{addon}</strong></span>
                                            </div>
                                          </td>
                                          <td className="py-1 px-2 text-right text-slate-500 text-[10px] border-t-0">
                                            {qtyVal} unit{qtyVal > 1 ? 's' : ''}
                                          </td>
                                          {/* MRP Unit Price */}
                                          <td className="py-1 px-4 text-right text-slate-500 font-medium border-t-0">
                                            {addonPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                          </td>
                                          {/* Discount */}
                                          <td className="py-1 px-4 text-center border-t-0">
                                            {discountPercentage > 0 ? (
                                              <span className="inline-block bg-amber-50 text-amber-700 font-extrabold text-[8px] px-1.5 py-0.2 rounded border border-amber-200">
                                                {discountPercentage}% Off
                                              </span>
                                            ) : (
                                              <span className="text-slate-405 font-medium">-</span>
                                            )}
                                          </td>
                                          {/* Special Price */}
                                          <td className="py-1 px-4 text-right text-slate-900 font-bold border-t-0">
                                            {addonNetPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                          </td>
                                          {/* Line Amount */}
                                          <td className="py-1 px-4 text-right text-slate-600 font-semibold border-t-0">
                                            {addonLineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </React.Fragment>
                                );
                              } else {
                                // Standalone items when Model Design is not chosen
                                return (
                                  <React.Fragment key={p.id}>
                                    {uphNames.map((uName) => {
                                      const originalUphPrice = p.upholsteryPrices?.[uName] ?? (uName === p.upholstery ? p.upholsteryPrice : 0);
                                      const uphNetPrice = originalUphPrice * (1 - (p.upholsteryDiscount || 0) / 100);
                                      const qtyVal = p.upholsteryQuantities?.[uName] ?? 1;
                                      const uphLineTotal = uphNetPrice * qtyVal;
                                      const currentSNo = sNo++;

                                      return (
                                        <tr key={uName} className="hover:bg-slate-50/50 transition-colors">
                                          <td className="py-3 px-4 font-bold text-slate-400 text-center">{currentSNo}</td>
                                          <td className="py-3 px-2">
                                            <span className="font-extrabold text-slate-900 block text-[11px]">Upholstery: {uName}</span>
                                          </td>
                                          <td className="py-3 px-2 text-right font-black text-slate-900 text-xs">{qtyVal} Meter{qtyVal !== 1 ? 's' : ''}</td>
                                          <td className="py-3 px-4 text-right font-semibold text-slate-700">
                                            {originalUphPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                          </td>
                                          <td className="py-3 px-4 text-center">
                                            {p.upholsteryDiscount && p.upholsteryDiscount > 0 ? (
                                              <span className="inline-block bg-amber-50 text-amber-700 font-extrabold text-[9px] px-2 py-0.5 rounded border border-amber-200">
                                                {p.upholsteryDiscount}% Off
                                              </span>
                                            ) : (
                                              <span className="text-slate-400 font-medium">-</span>
                                            )}
                                          </td>
                                          <td className="py-3 px-4 text-right text-slate-950 font-extrabold">
                                            {uphNetPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                          </td>
                                          <td className="py-3 px-4 text-right font-black text-[#0F172A] text-xs">
                                            {uphLineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                          </td>
                                        </tr>
                                      );
                                    })}

                                    {p.addons.map((addon) => {
                                      const addonPrice = p.addonPrices[addon] || 0;
                                      const discountPercentage = p.addonDiscount || 0;
                                      const addonNetPrice = addonPrice * (1 - discountPercentage / 100);
                                      const qtyVal = p.addonQuantities?.[addon] ?? 1;
                                      const addonLineTotal = addonNetPrice * qtyVal;
                                      const currentSNo = sNo++;

                                      return (
                                        <tr key={addon} className="hover:bg-slate-50/50 transition-colors">
                                          <td className="py-3 px-4 font-bold text-slate-400 text-center">{currentSNo}</td>
                                          <td className="py-3 px-2">
                                            <span className="font-extrabold text-slate-900 block text-[11px]">Add-on: {addon}</span>
                                          </td>
                                          <td className="py-3 px-2 text-right font-black text-slate-900 text-xs">{qtyVal}</td>
                                          <td className="py-3 px-4 text-right font-semibold text-slate-700">
                                            {addonPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                          </td>
                                          <td className="py-3 px-4 text-center">
                                            {discountPercentage > 0 ? (
                                              <span className="inline-block bg-amber-50 text-amber-700 font-extrabold text-[9px] px-2 py-0.5 rounded border border-amber-200">
                                                {discountPercentage}% Off
                                              </span>
                                            ) : (
                                              <span className="text-slate-400 font-medium">-</span>
                                            )}
                                          </td>
                                          <td className="py-3 px-4 text-right text-slate-950 font-extrabold">
                                            {addonNetPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                          </td>
                                          <td className="py-3 px-4 text-right font-black text-[#0F172A] text-xs">
                                            {addonLineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </React.Fragment>
                                );
                              }
                            });
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* SUMMARY SECTION */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1 items-start">
                    <div className="text-[10px] bg-slate-50/70 rounded-2xl p-4 border border-slate-150 leading-relaxed h-full">
                      <span className="font-black uppercase text-[9px] text-[#0F172A] block mb-1 tracking-wider">Amount in Regulatory Words</span>
                      <span className="text-slate-600 italic font-bold leading-normal">{amountInWords}</span>
                    </div>
                    <div className="space-y-2 text-right font-semibold text-[10px] bg-slate-50/30 p-4 rounded-2xl border border-dashed border-slate-200">
                      <div className="flex justify-between border-b border-slate-200 pb-1.5">
                        <span className="text-slate-400 font-bold uppercase tracking-wide">Base Subtotal:</span>
                        <span className="text-slate-900">Rs. {subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-500 border-b border-slate-200 pb-1.5">
                        <span className="uppercase tracking-wide font-medium">GST @ 18% (Tax Included):</span>
                        <span>Rs. {gstIncludedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-500 border-b border-slate-200 pb-1.5">
                        <span className="uppercase tracking-wide font-medium">Freight Logistics:</span>
                        <span>{freightType === 'included' ? 'Included' : `Rs. ${freightCharges.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}</span>
                      </div>
                      <div className="flex justify-between font-black text-xs pt-1">
                        <span className="text-[#0F172A] uppercase tracking-wider pt-1.5 text-[11px]">Invoice Grand Total:</span>
                        <span className="text-base font-black text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-4 py-1.5 shadow-sm">
                          Rs. {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* PREDEFINED TERMS BLOCK */}
                  <div className="pt-4 space-y-2 border-t border-dashed border-slate-200">
                    <div className="text-[10px] font-black uppercase text-[#0f172a] tracking-wider flex items-center gap-1.5">
                      <span className="w-1 h-3 bg-slate-800 rounded-sm block"></span>
                      Terms & Regulatory Conditions ({brand})
                    </div>
                    <ul className="list-inside list-decimal text-[8px] text-slate-500 space-y-1 pl-1 leading-relaxed font-bold">
                      {getTermsByBrand().map((t, idx) => (
                        <li key={idx} className="hover:text-slate-700 transition-colors">{t}</li>
                      ))}
                    </ul>
                  </div>

                  {/* BANKING DETAILS BLOCK */}
                  {matchedBankDetails && (
                    <div className="pt-4 space-y-2 border-t border-dashed border-slate-200">
                      <div className="text-[10px] font-black uppercase text-[#0f172a] tracking-wider flex items-center gap-1.5">
                        <span className="w-1 h-3 bg-[#9B7C50] rounded-sm block"></span>
                        Banking Details ({salesperson?.showroom || salesperson?.region || 'My Franchise'})
                      </div>
                      <div className="text-[8px] text-slate-500 font-bold whitespace-pre-line leading-relaxed pl-1 font-mono">
                        {matchedBankDetails}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>

          </motion.div>
        ) : (
          <motion.div
            key="history-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Search/Filter controls */}
            <div className="luxury-card p-5 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
              <div className="md:col-span-6 relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search by quote number, customer name, salesperson account..."
                  className="w-full pl-10 pr-4 h-11 glass-input outline-slate-300 text-xs font-semibold"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="md:col-span-4 select bg-white border border-slate-200 rounded-lg">
                <select
                  className="w-full h-11 px-3 text-xs bg-transparent outline-none font-semibold text-slate-700"
                  value={selectedBrandFilter}
                  onChange={e => setSelectedBrandFilter(e.target.value)}
                >
                  <option value="">-- All Brands --</option>
                  <option value="Little Nap">Little Nap</option>
                  <option value="La-Z-Boy">La-Z-Boy</option>
                  <option value="Robocura">Robocura</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <button
                  onClick={handleFetchHistory}
                  disabled={loadingHistory}
                  className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center justify-center gap-2 font-bold text-xs transition-colors"
                >
                  <RefreshCw className={loadingHistory ? 'animate-spin' : ''} size={14} />
                  Refresh logs
                </button>
              </div>
            </div>

            {/* History Records Table */}
            <div className="luxury-card overflow-hidden">
              {loadingHistory ? (
                <div className="p-20 text-center text-slate-400 space-y-3">
                  <RefreshCw className="animate-spin text-slate-400 mx-auto" size={32} />
                  <p className="font-bold text-sm tracking-wide">Syncing proforma invoice log with Google Sheets...</p>
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="p-20 text-center text-slate-400 space-y-2">
                  <FileText className="mx-auto text-slate-300" size={48} />
                  <p className="font-bold text-sm tracking-wide">No proforma invoice logs match search criteria.</p>
                  <p className="text-xs text-slate-400">Create new proforma invoices in the generator tab to populate tracking sheets.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-slate-600 text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 font-extrabold uppercase text-[10px] border-b border-slate-200">
                        <th className="p-4">Date</th>
                        <th className="p-4">Quote No</th>
                        <th className="p-4">Client</th>
                        <th className="p-4">Brand</th>
                        <th className="p-4">Salesperson</th>
                        <th className="p-4 text-right">Grand Total</th>
                        <th className="p-4 text-center">Cloud PDF</th>
                        <th className="p-4 text-center">Reopen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredHistory.map((item, idx) => (
                        <tr key={idx} className="border-b hover:bg-slate-50/50 transition-colors font-medium">
                          <td className="p-4 text-slate-800">{item.date}</td>
                          <td className="p-4 font-bold text-slate-900">{item.quotationNumber}</td>
                          <td className="p-4">
                            <div className="font-bold text-slate-800">{item.clientName}</div>
                            <div className="text-[10px] text-slate-400">{item.mobileNumber}</div>
                          </td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 font-bold uppercase text-[9px] tracking-wider rounded bg-slate-100 text-slate-700">
                              {item.brandName}
                            </span>
                          </td>
                          <td className="p-4 text-slate-500">{item.salespersonName}</td>
                          <td className="p-4 text-right font-extrabold text-slate-900">
                            ₹{item.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex justify-center items-center font-bold text-[10px]">
                              {item.pdfUrl ? (
                                <a
                                  href={item.pdfUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded border border-emerald-100 hover:bg-emerald-100 transition-colors"
                                >
                                  Drive PDF
                                </a>
                              ) : (
                                <span className="text-[9px] text-slate-400">No PDF</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => handleReopenQuotation(item)}
                              className="px-2.5 py-1 bg-slate-900 text-white rounded font-bold text-[10px] tracking-wide hover:bg-slate-800 transition-colors"
                            >
                              Load & Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
