import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from './ui';
import { SaleReport, ValidationData, OPFData } from '../types';
import { fetchNextOPFNumber } from '../services/dataService';
import { useEffect, useState, useRef } from 'react';
import { useNotification } from './Notification';

const SearchableSelect = ({ options, value, onChange, placeholder, className }: { options: string[], value: string, onChange: (val: string) => void, placeholder?: string, className?: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative" ref={wrapperRef}>
      <div 
        className={`${className} flex justify-between items-center cursor-pointer select-none`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={value ? "text-slate-800 line-clamp-1" : "text-slate-400"}>{value || placeholder || 'Select...'}</span>
        <svg className={`w-4 h-4 text-slate-400 shrink-0 ml-2 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </div>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input 
              type="text" 
              className="w-full bg-slate-100/50 p-2.5 rounded-lg outline-none text-sm focus:bg-slate-100 text-slate-800 placeholder-slate-400 transition-colors"
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className="max-h-64 overflow-y-auto p-1 custom-scrollbar">
            {filteredOptions.length > 0 ? filteredOptions.map((opt, i) => (
              <div 
                key={i} 
                className={`p-3 text-sm cursor-pointer rounded-lg transition-colors flex items-center justify-between ${value === opt ? 'bg-slate-900 text-white' : 'hover:bg-slate-100 text-slate-700'}`}
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                  setSearch('');
                }}
              >
                <span className="line-clamp-1">{opt}</span>
                {value === opt && <svg className="w-4 h-4 ml-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>}
              </div>
            )) : (
              <div className="p-4 text-sm text-slate-400 text-center">No matches found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const saleSchema = z.object({
  clientName: z.string().min(1, 'Required'),
  companyName: z.string().optional(),
  mobileNumber: z.string().min(10, 'Invalid number'),
  emailId: z.string().optional().refine(val => {
    if (!val || val.trim() === '') return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  }, { message: 'Invalid email address' }),
  dealerName: z.string().optional(),
  dealerMobileNumber: z.string().optional(),
  dealerCompanyName: z.string().optional(),
  dealerCity: z.string().optional(),
  dealerState: z.string().optional(),
  quantity: z.preprocess((val) => {
    if (val === '' || val === undefined || val === null || (typeof val === 'number' && isNaN(val))) return undefined;
    return Number(val);
  }, z.number({ message: 'Required' }).min(1, 'Required')),
  grossSales: z.preprocess((val) => {
    if (val === '' || val === undefined || val === null || (typeof val === 'number' && isNaN(val))) return undefined;
    return Number(val);
  }, z.number({ message: 'Required' }).min(0, 'Required')),
  visitType: z.enum(['Showroom', 'Other Region']),
  segment: z.string().min(1, 'Required'),
  subSegment: z.string().optional(),
  city: z.string().min(1, 'Required'),
  state: z.string().min(1, 'Required'),
  brandName: z.string().min(1, 'Required'),
  model: z.string().min(1, 'Required'),
  functionality: z.string().min(1, 'Required'),
  category: z.string().min(1, 'Required'),
  crrNbd: z.string().min(1, 'Required'),
  typeOfBusiness: z.string().min(1, 'Required'),
  commission: z.number().min(0, 'Required'),
  tax: z.number().min(0, 'Required'),
  freightCharges: z.number().min(0, 'Required'),
  netSales: z.number().min(0, 'Required'),
  advanceAmount: z.preprocess((val) => {
    if (val === '' || val === undefined || val === null || (typeof val === 'number' && isNaN(val))) return 0;
    return Number(val);
  }, z.number({ message: 'Required' }).min(0, 'Required')),
  remarks: z.string().optional(),
  linkedDocument: z.string().optional(),
  leadSource: z.string().min(1, 'Required'),
  opfNumber: z.string().min(1, 'Required'),
  salespersonName: z.string().min(1, 'Required'),
  region: z.string().min(1, 'Required'),
}).superRefine((data, ctx) => {
  const seg = (data.segment || '').toLowerCase().trim();
  if ((seg === 'oem' || seg === 'project') && (!data.companyName || data.companyName.trim() === '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Company Name is required for OEM and Project segments.',
      path: ['companyName']
    });
  }
});

const pick = (options: string[], want: string, loose = false) => {
  const w = (want || '').trim().toLowerCase();
  if (!w) return '';
  return options.find(o => o.trim().toLowerCase() === w) || (loose ? options.find(o => { const x = o.trim().toLowerCase(); return x.includes(w) || w.includes(x); }) : '') || '';
};

export const SaleForm = ({ salesperson, validationData, opfData, codeMap, onSubmit, link }: { salesperson: any, validationData: ValidationData, opfData: OPFData[], codeMap: Record<string, string>, onSubmit: (data: SaleReport) => void, link?: { lead: any; quote?: any; record?: any } | null }) => {
  const { showNotification } = useNotification();
  const getIstDateString = () => {
    return new Date().toLocaleString("en-GB", { 
        timeZone: "Asia/Kolkata", 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: false 
    }).replace(/(\d+)\/(\d+)\/(\d+), (\d+:\d+:\d+)/, '$3-$2-$1 $4');
  };

  const fromLead = (() => {
    if (!link?.lead) return {} as Partial<SaleReport>;
    const l = link.lead;
    let payload: any = null;
    try { payload = link.record?.productsJson ? JSON.parse(link.record.productsJson) : null; } catch { payload = null; }
    const lines: any[] = payload?.lines || [];
    const qty = lines.reduce((s, x) => s + (Number(x.qty) || 0), 0) || Number(String(l.quantity || '').replace(/[^\d]/g, '')) || undefined;
    const amount = Number(link.quote?.amount || link.record?.grandTotal || 0) || undefined;
    const group = String(l.group || '').toLowerCase();
    const crr = group === 'nbd' ? pick(validationData.crrNbds, 'nbd', true) : group === 'direct' ? pick(validationData.crrNbds, 'crr', true) : '';
    return {
      clientName: `${l.firstName || ''} ${l.lastName || ''}`.trim(),
      companyName: l.company || '',
      mobileNumber: String(l.phone || '').replace(/\D/g, '').slice(-10),
      emailId: l.email || '',
      city: l.city || '',
      state: l.state || '',
      leadSource: pick(validationData.leadSources, l.source, true),
      segment: pick(validationData.segments, l.segment, true),
      brandName: pick(validationData.brands, link.quote?.brand || link.record?.brandName || '', true),
      model: pick(validationData.models, lines[0]?.item || '', true),
      crrNbd: crr,
      quantity: qty,
      grossSales: amount,
      remarks: `Lead ${l.enquiryNo}${link.quote ? `, ${link.quote.docType === 'PI' ? 'PI' : 'quotation'} ${link.quote.quoteNo}` : ''}`,
      linkedDocument: link.quote?.quoteNo || '',
    } as Partial<SaleReport>;
  })();
  const prefilled = Object.fromEntries(Object.entries(fromLead).filter(([, v]) => v !== '' && v !== undefined)) as Partial<SaleReport>;

  const { register, handleSubmit, setValue, watch, formState: { errors, submitCount } } = useForm<SaleReport>({
    resolver: zodResolver(saleSchema as any),
    defaultValues: {
      salespersonName: salesperson.name,
      region: salesperson.region,
      date: getIstDateString(),
      visitType: 'Showroom',
      segment: '',
      leadSource: '',
      brandName: '',
      model: '',
      functionality: '',
      category: '',
      crrNbd: '',
      typeOfBusiness: validationData.typesOfBusiness[0],
      state: '',
      opfNumber: '',
      commission: 0,
      tax: 0,
      freightCharges: 0,
      netSales: 0,
      advanceAmount: undefined,
      grossSales: undefined,
      quantity: undefined,
      ...prefilled
    }
  });

  const onError = (errors: any) => {
    console.error('Form validation errors:', errors);
    
    // Smoothly scroll directly to the exact input or selector that triggered the validation error!
    const firstErrorKey = Object.keys(errors)[0];
    if (firstErrorKey) {
      const errorElement = document.getElementById(firstErrorKey) ||
                           document.querySelector(`[name="${firstErrorKey}"]`) || 
                           document.querySelector(`input[name*="${firstErrorKey}"]`) ||
                           document.querySelector(`select[name*="${firstErrorKey}"]`) ||
                           document.querySelector(`textarea[name*="${firstErrorKey}"]`) ||
                           document.querySelector(`[data-fieldname="${firstErrorKey}"]`);
      if (errorElement) {
        errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        try {
          (errorElement as any).focus();
        } catch (_) {}
      } else {
        const banner = document.getElementById('validation-errors-banner');
        if (banner) {
          banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          const formEl = document.querySelector('form');
          if (formEl) {
            formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }
    } else {
      const formEl = document.querySelector('form');
      if (formEl) {
        formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    const errorFields = Object.keys(errors).map(key => {
      if (key === 'clientName') return 'Client Name';
      if (key === 'companyName') return 'Company Name';
      if (key === 'mobileNumber') return 'Mobile Number';
      if (key === 'emailId') return 'Email ID';
      if (key === 'city') return 'City';
      if (key === 'state') return 'State';
      if (key === 'brandName') return 'Brand Name';
      if (key === 'model') return 'Model Selection';
      if (key === 'functionality') return 'Functionality';
      if (key === 'category') return 'Category';
      if (key === 'crrNbd') return 'CRR / NBD';
      if (key === 'quantity') return 'Quantity';
      if (key === 'grossSales') return 'Gross Sales';
      if (key === 'advanceAmount') return 'Advance Amount';
      return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    });
    
    showNotification(`Unable to save. Please correct the missing or invalid fields: ${errorFields.join(', ')}`, 'error');
  };

  const selectedSegment = watch('segment');
  const selectedSubSegment = watch('subSegment');
  const city = watch('city');
  const selectedVisitType = watch('visitType');
  const selectedTypeOfBusiness = watch('typeOfBusiness');
  const dealerCity = watch('dealerCity');

  useEffect(() => {
    if (selectedSegment) {
      const lowerSegment = selectedSegment.toLowerCase().trim();
      const lowerSubSegment = (selectedSubSegment || '').toLowerCase().trim();

      // Condition 1: OEM or Project always B To B
      if (lowerSegment === 'oem' || lowerSegment === 'project') {
        setValue('typeOfBusiness', 'B To B', { shouldValidate: true });
      } 
      // Condition 2: Franchise with specific sub-segments
      else if (lowerSegment === 'franchise') {
        const b2bSubSegments = ['cinema architect', 'cinema consultant', 'project'];
        if (b2bSubSegments.includes(lowerSubSegment)) {
          setValue('typeOfBusiness', 'B To B', { shouldValidate: true });
        } else {
          setValue('typeOfBusiness', 'B To C', { shouldValidate: true });
        }
      }
      // Otherwise B To C
      else {
        setValue('typeOfBusiness', 'B To C', { shouldValidate: true });
      }
    }
  }, [selectedSegment, selectedSubSegment, setValue]);

  const [opfLoading, setOpfLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const loadOpf = async (showSpinner = false) => {
      if (showSpinner) setOpfLoading(true);
      try {
        const opf = await fetchNextOPFNumber(salesperson.name, selectedVisitType);
        if (active && opf) {
          setValue('opfNumber', opf, { shouldValidate: true });
        }
      } catch (err) {
        console.error('Failed to pre-fetch next OPF number:', err);
      } finally {
        if (active && showSpinner) {
          setOpfLoading(false);
        }
      }
    };

    // Initial fetch on mount or visit type change
    loadOpf(true);

    // Poll every 5 seconds so the sequence stays in real-time sync across multiple concurrent users
    // Paused while the page is hidden (other tab, minimized, phone locked or another app open)
    const intervalId = setInterval(() => {
      if (document.hidden) return;
      loadOpf(false);
    }, 5000);
    const onVisible = () => { if (!document.hidden) loadOpf(false); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      active = false;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [salesperson.name, selectedVisitType, setValue]);

  useEffect(() => {
    if (city && city.length > 2) {
      const fetchState = async () => {
        try {
          const encodedCity = encodeURIComponent(city);
          const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodedCity},India&addressdetails=1&limit=1`);
          const data = await response.json();
          if (data && data.length > 0 && data[0].address) {
            const addr = data[0].address;
            const state = addr.state || addr['ISO3166-2-lvl4'] || '';
            if (state) {
              setValue('state', state);
            }
          }
        } catch (err) {
          console.error('Failed to fetch state:', err);
        }
      };
      
      const debounceTimer = setTimeout(fetchState, 500);
      return () => clearTimeout(debounceTimer);
    }
  }, [city, setValue]);

  useEffect(() => {
    if (dealerCity && dealerCity.length > 2) {
      const fetchDealerState = async () => {
        try {
          const encodedCity = encodeURIComponent(dealerCity);
          const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodedCity},India&addressdetails=1&limit=1`);
          const data = await response.json();
          if (data && data.length > 0 && data[0].address) {
            const addr = data[0].address;
            const state = addr.state || addr['ISO3166-2-lvl4'] || '';
            if (state) {
              setValue('dealerState', state);
            }
          }
        } catch (err) {
          console.error('Failed to fetch dealer state:', err);
        }
      };
      
      const debounceTimer = setTimeout(fetchDealerState, 500);
      return () => clearTimeout(debounceTimer);
    }
  }, [dealerCity, setValue]);

  const inputClass = "w-full p-3 md:p-4 glass-input text-slate-800 placeholder:text-slate-400 outline-none text-sm md:text-base";
  const labelClass = "block text-[10px] md:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 md:mb-2";
  const sectionClass = "luxury-card p-5 md:p-10 space-y-4 md:space-y-6";

  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmitHandler = async (data: SaleReport) => {
    setIsSubmitting(true);
    const dataWithTimestamp = {
      ...data,
      date: getIstDateString()
    };
    try {
      await onSubmit(dataWithTimestamp);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmitHandler, onError)} className="space-y-6 max-w-4xl mx-auto">
      <div className="text-center mb-10">
        <h3 className="text-3xl font-extrabold text-slate-900 tracking-tight">Record Sale</h3>
        <p className="text-slate-500 mt-2 font-medium">Please enter the details of your new sale</p>
      </div>

      {link?.lead && (
        <div className="border border-slate-200 bg-white p-4 text-sm">
          <div className="font-bold text-slate-900">Sale for lead {link.lead.enquiryNo}{link.quote ? ` · ${link.quote.docType === 'PI' ? 'PI' : 'Quotation'} ${link.quote.quoteNo}` : ''}</div>
          <div className="text-slate-500 mt-1">Customer, product and amount are filled from the lead{link.quote ? ' and its ' + (link.quote.docType === 'PI' ? 'PI' : 'quotation') : ''}. Check them, then submit. The lead closes with this OPF number.</div>
        </div>
      )}

      {Object.keys(errors).length > 0 && (
        <div id="validation-errors-banner" className="bg-red-50 border-2 border-red-200 text-red-950 p-5 rounded-2xl shadow-sm space-y-3 animate-pulse-subtle">
          <div className="flex items-center gap-2 text-red-700 font-extrabold text-sm md:text-base">
            <svg className="w-5 h-5 shrink-0 animate-bounce" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>Please correct the following fields to submit:</span>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 pl-5 list-disc text-xs md:text-sm text-red-800 font-semibold">
            {Object.entries(errors).map(([key, err]: [string, any]) => {
              let label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
              if (key === 'clientName') label = 'Client Name';
              if (key === 'companyName') label = 'Company Name';
              if (key === 'mobileNumber') label = 'Mobile Number';
              if (key === 'emailId') label = 'Email ID';
              if (key === 'city') label = 'City';
              if (key === 'state') label = 'State';
              if (key === 'brandName') label = 'Brand Name';
              if (key === 'model') label = 'Model Selection';
              if (key === 'functionality') label = 'Functionality';
              if (key === 'category') label = 'Category';
              if (key === 'crrNbd') label = 'CRR / NBD';
              if (key === 'quantity') label = 'Quantity';
              if (key === 'grossSales') label = 'Gross Sales';
              if (key === 'advanceAmount') label = 'Advance Amount';
              
              const message = err?.message || 'This field is required or invalid';
              return (
                <li key={key} className="hover:text-red-900 transition-colors">
                  <span className="font-bold text-red-950 uppercase text-[10px] tracking-wider block md:inline md:after:content-[':'] md:mr-1">{label}</span>
                  <span>{message}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      
      <div className={sectionClass}>
        <h4 className="text-lg font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4">Salesperson & Reference</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
            <label className={labelClass}>Salesperson Name</label>
            <input {...register('salespersonName')} className={`${inputClass} bg-slate-100 text-slate-500`} readOnly />
            </div>
            <div>
            <label className={labelClass}>Region</label>
            <input {...register('region')} value={salesperson.region} className={`${inputClass} bg-slate-100 text-slate-500`} readOnly />
            </div>
            <div className="md:col-span-2">
            <label className={labelClass}>Generated OPF Number</label>
            <div className="relative">
              <input {...register('opfNumber')} className={`${inputClass} font-mono font-bold tracking-widest text-lg bg-blue-50/40 border-blue-200/50 text-blue-900 pr-24`} readOnly />
              {opfLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-blue-600 font-medium">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  <span>Syncing...</span>
                </div>
              )}
            </div>
            </div>
        </div>
      </div>

      <div className={sectionClass}>
        <h4 className="text-lg font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4">Visit & Segment</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
            <label className={labelClass}>Visit Type</label>
            <select {...register('visitType')} className={inputClass}>
                <option value="Showroom">Showroom</option>
                <option value="Other Region">Other Region</option>
            </select>
            </div>
            <div>
            <label className={labelClass}>Segment</label>
            <div id="segment" data-fieldname="segment">
              <SearchableSelect
                  options={validationData.segments}
                  value={watch('segment') || ''}
                  onChange={(val) => setValue('segment', val, { shouldValidate: true })}
                  placeholder="Select Segment"
                  className={`${inputClass} ${errors.segment ? 'border-red-300 ring-1 ring-red-300' : ''}`}
              />
            </div>
            {errors.segment && <p className="text-[10px] md:text-xs text-red-500 font-semibold mt-1">{errors.segment.message}</p>}
            </div>
            {selectedSegment?.toLowerCase() === 'franchise' && (
            <div>
                <label className={labelClass}>Sub-Segment</label>
                <select {...register('subSegment')} className={inputClass}>
                    <option value="">Select Sub-Segment</option>
                    {validationData.subSegments.map((s, i) => <option key={`${s}-${i}`} value={s}>{s}</option>)}
                </select>
            </div>
            )}
            <div>
            <label className={labelClass}>Lead Source</label>
            <div id="leadSource" data-fieldname="leadSource">
              <SearchableSelect
                  options={validationData.leadSources}
                  value={watch('leadSource') || ''}
                  onChange={(val) => setValue('leadSource', val, { shouldValidate: true })}
                  placeholder="Select Lead Source"
                  className={`${inputClass} ${errors.leadSource ? 'border-red-300 ring-1 ring-red-300' : ''}`}
              />
            </div>
            {errors.leadSource && <p className="text-[10px] md:text-xs text-red-500 font-semibold mt-1">{errors.leadSource.message}</p>}
            </div>
        </div>
      </div>

      <div className={sectionClass}>
        <h4 className="text-lg font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4">Customer Details</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
            <label className={labelClass}>Client Name</label>
            <input {...register('clientName')} className={`${inputClass} ${errors.clientName ? 'border-red-300 ring-1 ring-red-300' : ''}`} placeholder="Enter Client Name" />
            {errors.clientName && <p className="text-[10px] md:text-xs text-red-500 font-semibold mt-1">{errors.clientName.message}</p>}
            </div>
            <div>
            <label className={labelClass}>
              {(selectedSegment?.toLowerCase().trim() === 'oem' || selectedSegment?.toLowerCase().trim() === 'project') ? (
                <span>Company Name <span className="text-red-500 font-extrabold">*</span></span>
              ) : (
                'Company Name (Optional)'
              )}
            </label>
            <input 
              {...register('companyName')} 
              className={`${inputClass} ${errors.companyName ? 'border-red-300 ring-1 ring-red-300' : ''}`} 
              placeholder="Enter Company Name" 
            />
            {errors.companyName && <p className="text-[10px] md:text-xs text-red-500 font-semibold mt-1">{errors.companyName.message}</p>}
            </div>
            <div>
            <label className={labelClass}>Mobile Number</label>
            <input {...register('mobileNumber')} className={`${inputClass} ${errors.mobileNumber ? 'border-red-300 ring-1 ring-red-300' : ''}`} placeholder="Enter 10-digit number" />
            {errors.mobileNumber && <p className="text-[10px] md:text-xs text-red-500 font-semibold mt-1">{errors.mobileNumber.message}</p>}
            </div>
            <div>
            <label className={labelClass}>Email ID (Optional)</label>
            <input {...register('emailId')} className={`${inputClass} ${errors.emailId ? 'border-red-300 ring-1 ring-red-300' : ''}`} placeholder="client@example.com" />
            {errors.emailId && <p className="text-[10px] md:text-xs text-red-500 font-semibold mt-1">{errors.emailId.message}</p>}
            </div>
            {(selectedSegment?.trim() === 'AV Dealers' || selectedSegment?.trim() === 'AV Dealer' || selectedSegment?.trim() === 'SIS' || selectedSegment?.trim() === 'AV Partner') && (
            <>
                <div className="pt-4 border-t border-slate-100 md:col-span-2">
                    <p className="text-sm font-semibold text-slate-800 mb-4">Dealer Information</p>
                </div>
                <div>
                <label className={labelClass}>Dealer Name</label>
                <input {...register('dealerName')} className={inputClass} placeholder="Enter Dealer Name" />
                </div>
                <div>
                <label className={labelClass}>Dealer Mobile Number</label>
                <input {...register('dealerMobileNumber')} className={inputClass} placeholder="Enter Dealer Mobile" />
                </div>
                <div>
                <label className={labelClass}>Dealer Company Name</label>
                <input {...register('dealerCompanyName')} className={inputClass} placeholder="Enter Dealer Company" />
                </div>
                <div>
                <label className={labelClass}>Dealer Location (City)</label>
                <input {...register('dealerCity')} className={inputClass} placeholder="Dealer City" />
                </div>
                <div>
                <label className={labelClass}>Dealer Location (State)</label>
                <input {...register('dealerState')} className={inputClass} placeholder="Dealer State (Auto)" />
                </div>
            </>
            )}
            <div className="pt-4 border-t border-slate-100 md:col-span-2">
                <p className="text-sm font-semibold text-slate-800 mb-4">Location</p>
            </div>
            <div>
            <label className={labelClass}>City</label>
            <input {...register('city')} className={`${inputClass} ${errors.city ? 'border-red-300 ring-1 ring-red-300' : ''}`} placeholder="Enter City (State auto-fills)" />
            {errors.city && <p className="text-[10px] md:text-xs text-red-500 font-semibold mt-1">{errors.city.message}</p>}
            </div>
            <div>
            <label className={labelClass}>State</label>
            <input {...register('state')} className={`${inputClass} ${errors.state ? 'border-red-300 ring-1 ring-red-300' : ''}`} placeholder="State" />
            {errors.state && <p className="text-[10px] md:text-xs text-red-500 font-semibold mt-1">{errors.state.message}</p>}
            </div>
        </div>
      </div>

      <div className={sectionClass}>
        <h4 className="text-lg font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4">Product Specs</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
            <label className={labelClass}>Brand</label>
            <div id="brandName" data-fieldname="brandName">
              <SearchableSelect
                  options={validationData.brands}
                  value={watch('brandName') || ''}
                  onChange={(val) => setValue('brandName', val, { shouldValidate: true })}
                  placeholder="Select Brand"
                  className={`${inputClass} ${errors.brandName ? 'border-red-300 ring-1 ring-red-300' : ''}`}
              />
            </div>
            {errors.brandName && <p className="text-[10px] md:text-xs text-red-500 font-semibold mt-1">{errors.brandName.message}</p>}
            </div>
            <div>
            <label className={labelClass}>Model</label>
            <div id="model" data-fieldname="model">
              <SearchableSelect 
                  options={validationData.models} 
                  value={watch('model')} 
                  onChange={(val) => setValue('model', val, { shouldValidate: true })} 
                  placeholder="Select Model"
                  className={`${inputClass} ${errors.model ? 'border-red-300 ring-1 ring-red-300' : ''}`}
              />
            </div>
            {errors.model && <p className="text-[10px] md:text-xs text-red-500 font-semibold mt-1">{errors.model.message}</p>}
            </div>
            <div>
            <label className={labelClass}>Functionality</label>
            <div id="functionality" data-fieldname="functionality">
              <SearchableSelect
                  options={validationData.functionalities}
                  value={watch('functionality') || ''}
                  onChange={(val) => setValue('functionality', val, { shouldValidate: true })}
                  placeholder="Select Functionality"
                  className={`${inputClass} ${errors.functionality ? 'border-red-300 ring-1 ring-red-300' : ''}`}
              />
            </div>
            {errors.functionality && <p className="text-[10px] md:text-xs text-red-500 font-semibold mt-1">{errors.functionality.message}</p>}
            </div>
            <div>
            <label className={labelClass}>Category</label>
            <div id="category" data-fieldname="category">
              <SearchableSelect
                  options={validationData.categories}
                  value={watch('category') || ''}
                  onChange={(val) => setValue('category', val, { shouldValidate: true })}
                  placeholder="Select Category"
                  className={`${inputClass} ${errors.category ? 'border-red-300 ring-1 ring-red-300' : ''}`}
              />
            </div>
            {errors.category && <p className="text-[10px] md:text-xs text-red-500 font-semibold mt-1">{errors.category.message}</p>}
            </div>
            <div>
            <label className={labelClass}>CRR/NBD</label>
            <div id="crrNbd" data-fieldname="crrNbd">
              <SearchableSelect
                  options={validationData.crrNbds}
                  value={watch('crrNbd') || ''}
                  onChange={(val) => setValue('crrNbd', val, { shouldValidate: true })}
                  placeholder="Select CRR/NBD"
                  className={`${inputClass} ${errors.crrNbd ? 'border-red-300 ring-1 ring-red-300' : ''}`}
              />
            </div>
            {errors.crrNbd && <p className="text-[10px] md:text-xs text-red-500 font-semibold mt-1">{errors.crrNbd.message}</p>}
            </div>
            <div>
              <label className={labelClass}>Type of Business</label>
              <div className="flex flex-wrap gap-2 pt-1">
                {validationData.typesOfBusiness.map((type) => (
                  <div
                    key={type}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                      selectedTypeOfBusiness === type
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md scale-105 z-10'
                        : 'bg-slate-50 text-slate-300 border-slate-100 opacity-60 grayscale'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {selectedTypeOfBusiness === type && (
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      )}
                      {type}
                    </div>
                  </div>
                ))}
              </div>
              <input type="hidden" {...register('typeOfBusiness')} />
            </div>
        </div>
      </div>

      <div className={sectionClass}>
        <h4 className="text-lg font-bold text-slate-900 mb-6 border-b border-slate-100 pb-4">Financials</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          <div>
            <label className={labelClass}>Quantity</label>
            <input {...register('quantity', { valueAsNumber: true })} type="number" className={`${inputClass} ${errors.quantity ? 'border-red-300 ring-1 ring-red-300' : ''}`} placeholder="0" />
            {errors.quantity && <p className="text-[10px] md:text-xs text-red-500 font-semibold mt-1">{errors.quantity.message}</p>}
          </div>
          <div>
            <label className={labelClass}>Gross Sales</label>
            <div className="relative">
              <span className="absolute left-4 top-4 text-slate-400">₹</span>
              <input {...register('grossSales', { valueAsNumber: true })} type="number" className={`${inputClass} pl-8 ${errors.grossSales ? 'border-red-300 ring-1 ring-red-300' : ''}`} placeholder="0.00" />
            </div>
            {errors.grossSales && <p className="text-[10px] md:text-xs text-red-500 font-semibold mt-1">{errors.grossSales.message}</p>}
          </div>
          {/* Hidden for now as per user request
          ...
          */}
          <div className="col-span-2 md:col-span-3">
            <label className={labelClass}>Advance Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-4 text-slate-400">₹</span>
              <input {...register('advanceAmount', { valueAsNumber: true })} type="number" className={`${inputClass} pl-8 ${errors.advanceAmount ? 'border-red-300 ring-1 ring-red-300' : ''}`} placeholder="0.00" />
            </div>
            {errors.advanceAmount && <p className="text-[10px] md:text-xs text-red-500 font-semibold mt-1">{errors.advanceAmount.message}</p>}
          </div>
        </div>
      </div>

      <Button type="submit" className="w-full h-16 text-lg rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition-transform hover:scale-[1.01] active:scale-[0.99] shadow-xl shadow-slate-900/20" disabled={isSubmitting}>
        {isSubmitting ? 'Uploading to Hub...' : 'Finalize Sale Report'}
      </Button>
    </form>
  );
};
