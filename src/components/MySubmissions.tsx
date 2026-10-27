import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { OPFData } from '../types';
import { format, isValid } from 'date-fns';
import { Search, Download, Filter, ChevronLeft, ChevronRight, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

const parseSafeDate = (dateStr: string) => {
    if (!dateStr) return null;
    const clean = dateStr.trim();
    
    // 1. Try ISO date format parsing (e.g. YYYY-MM-DD)
    if (clean.match(/^\d{4}[-/]\d{2}[-/]\d{2}/)) {
        const d = new Date(clean.replace(' ', 'T'));
        if (isValid(d)) return d;
    }
    
    // 2. Clear out time-zone parts and try splitting for DD/MM/YYYY
    const datePartOnly = clean.split(/[ T]/)[0];
    const parts = datePartOnly.split(/[/-]/);
    
    if (parts.length === 3) {
        const first = parseInt(parts[0], 10);
        const second = parseInt(parts[1], 10);
        const third = parseInt(parts[2], 10);
        
        if (third > 1000) {
            // DD/MM/YYYY format or MM/DD/YYYY format. Assume Indian locale DD/MM/YYYY
            if (first >= 1 && first <= 31 && second >= 1 && second <= 12) {
                const parsed = new Date(third, second - 1, first);
                if (isValid(parsed)) return parsed;
            }
        } else if (first > 1000) {
            // YYYY-MM-DD
            if (second >= 1 && second <= 12 && third >= 1 && third <= 31) {
                const parsed = new Date(first, second - 1, third);
                if (isValid(parsed)) return parsed;
            }
        }
    }
    
    const fallback = new Date(clean);
    if (isValid(fallback)) return fallback;
    
    const fallbackAlt = new Date(clean.replace(/\//g, '-'));
    if (isValid(fallbackAlt)) return fallbackAlt;

    return null;
};

export const MySubmissions = ({ data }: { data: OPFData[] }) => {
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [segmentFilter, setSegmentFilter] = useState('');
  const [subSegmentFilter, setSubSegmentFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [functionalityFilter, setFunctionalityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [crrNbdFilter, setCrrNbdFilter] = useState('');
  const [typeOfBusinessFilter, setTypeOfBusinessFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const uniqueCities = useMemo(() => {
    return Array.from(new Set(data.map(item => item.city))).filter(Boolean).sort();
  }, [data]);

  const uniqueSegments = useMemo(() => {
    return Array.from(new Set(data.map(item => item.segment))).filter(Boolean).sort();
  }, [data]);

  const uniqueSubSegments = useMemo(() => {
    return Array.from(new Set(data.map(item => item.subSegment))).filter(Boolean).sort();
  }, [data]);

  const uniqueSources = useMemo(() => {
    return Array.from(new Set(data.map(item => item.leadSource))).filter(Boolean).sort();
  }, [data]);

  const uniqueBrands = useMemo(() => {
    return Array.from(new Set(data.map(item => item.brandName))).filter(Boolean).sort();
  }, [data]);

  const uniqueModels = useMemo(() => {
    return Array.from(new Set(data.map(item => item.model))).filter(Boolean).sort();
  }, [data]);

  const uniqueFunctionalities = useMemo(() => {
    return Array.from(new Set(data.map(item => item.functionality))).filter(Boolean).sort();
  }, [data]);

  const uniqueCategories = useMemo(() => {
    return Array.from(new Set(data.map(item => item.category))).filter(Boolean).sort();
  }, [data]);

  const uniqueCrrNbds = useMemo(() => {
    return Array.from(new Set(data.map(item => item.crrNbd))).filter(Boolean).sort();
  }, [data]);

  const uniqueTypesOfBusiness = useMemo(() => {
    return Array.from(new Set(data.map(item => item.typeOfBusiness))).filter(Boolean).sort();
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter(item => {
      // User requested to hide "No Sale" data (blank OPF or OPF starting with NSL)
      if (!item.opf || item.opf.trim() === '' || item.opf.startsWith('NSL')) {
        return false;
      }

      const matchesSearch = !search || 
        item.clientName?.toLowerCase().includes(search.toLowerCase()) ||
        item.opf.toLowerCase().includes(search.toLowerCase()) ||
        item.city.toLowerCase().includes(search.toLowerCase());
      
      const parsedItemDate = parseSafeDate(item.date);
      const itemTime = parsedItemDate ? parsedItemDate.getTime() : 0;
      const matchesDateFrom = !dateFrom || itemTime >= new Date(dateFrom).getTime();
      
      let toLimitRange: number | null = null;
      if (dateTo) {
        const dTo = new Date(dateTo);
        dTo.setHours(23, 59, 59, 999);
        toLimitRange = dTo.getTime();
      }
      const matchesDateTo = !dateTo || itemTime <= (toLimitRange ?? 0);
      
      const matchesCity = !cityFilter || item.city === cityFilter;
      const matchesSegment = !segmentFilter || item.segment === segmentFilter;
      const matchesSubSegment = !subSegmentFilter || item.subSegment === subSegmentFilter;
      const matchesSource = !sourceFilter || item.leadSource === sourceFilter;
      const matchesBrand = !brandFilter || item.brandName === brandFilter;
      const matchesModel = !modelFilter || item.model === modelFilter;
      const matchesFunctionality = !functionalityFilter || item.functionality === functionalityFilter;
      const matchesCategory = !categoryFilter || item.category === categoryFilter;
      const matchesCrrNbd = !crrNbdFilter || item.crrNbd === crrNbdFilter;
      const matchesTypeOfBusiness = !typeOfBusinessFilter || item.typeOfBusiness === typeOfBusinessFilter;

      return matchesSearch && matchesDateFrom && matchesDateTo && matchesCity && 
             matchesSegment && matchesSubSegment && matchesSource && matchesBrand && 
             matchesModel && matchesFunctionality && matchesCategory && matchesCrrNbd && 
             matchesTypeOfBusiness;
    }).sort((a, b) => {
      const db = parseSafeDate(b.date);
      const da = parseSafeDate(a.date);
      return (db ? db.getTime() : 0) - (da ? da.getTime() : 0);
    });
  }, [data, search, dateFrom, dateTo, cityFilter, segmentFilter, subSegmentFilter, sourceFilter, brandFilter, modelFilter, functionalityFilter, categoryFilter, crrNbdFilter, typeOfBusinessFilter]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const clearFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setCityFilter('');
    setSegmentFilter('');
    setSubSegmentFilter('');
    setSourceFilter('');
    setBrandFilter('');
    setModelFilter('');
    setFunctionalityFilter('');
    setCategoryFilter('');
    setCrrNbdFilter('');
    setTypeOfBusinessFilter('');
    setCurrentPage(1);
  };

  const exportToExcel = () => {
    // Filter out No Sale items and use ONLY the currently filtered data from the table
    const salesOnly = filteredData.filter(item => !item.opf.startsWith('NSL'));
    
    if (salesOnly.length === 0) {
      alert('No sale records found in current filtered view to export');
      return;
    }

    const exportData = salesOnly.map(item => ({
      'Date': item.date,
      'Salesperson': item.salesperson,
      'OPF Number': item.opf,
      'Region': item.region,
      'Visit Type': item.visitType,
      'Segment': item.segment,
      'Sub Segment': item.subSegment,
      'Lead Source': item.leadSource,
      'Client Name': item.clientName,
      'Company Name': item.companyName,
      'Mobile Number': item.mobileNumber,
      'Email ID': item.emailId,
      'Dealer Name': item.dealerName,
      'Dealer Mobile': item.dealerMobileNumber,
      'Dealer Company': item.dealerCompanyName,
      'Dealer City': item.dealerCity,
      'Dealer State': item.dealerState,
      'City': item.city,
      'State': item.state,
      'Brand Name': item.brandName,
      'Model': item.model,
      'Functionality': item.functionality,
      'Category': item.category,
      'CRR/NBD': item.crrNbd,
      'Type of Business': item.typeOfBusiness,
      'Quantity': item.quantity,
      'Gross Sales': item.grossSales,
      'Commission': item.commission,
      'Tax': item.tax,
      'Freight' : item.freightCharges,
      'Net Sales': item.netSales,
      'Advance Amount': item.advanceAmount,
      'Remarks': item.remarks
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Report");
    
    // Generate filename with current timestamp
    const fileName = `Sales_Report_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">My Sale Report Data</h2>
          <p className="text-slate-500 text-sm font-medium">History of your client records and sales</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 md:w-64 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search client or OPF..." 
              className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input outline-none text-sm focus:ring-2 focus:ring-emerald-200 transition-all"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all text-sm font-bold shadow-sm"
          >
            <FileSpreadsheet size={18} />
            <span>Export Excel</span>
          </button>
          
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-sm font-bold ${
              showFilters || dateFrom || dateTo || cityFilter
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-md' 
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter size={18} />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {showFilters && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="luxury-card p-6 bg-slate-50/50"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">From Date</label>
              <input 
                type="date" 
                className="w-full p-2.5 rounded-xl glass-input outline-none text-xs focus:ring-2 focus:ring-emerald-200 transition-all border border-slate-200"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">To Date</label>
              <input 
                type="date" 
                className="w-full p-2.5 rounded-xl glass-input outline-none text-xs focus:ring-2 focus:ring-emerald-200 transition-all border border-slate-200"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">City</label>
              <select 
                className="w-full p-2.5 rounded-xl glass-input outline-none text-xs focus:ring-2 focus:ring-emerald-200 transition-all border border-slate-200"
                value={cityFilter}
                onChange={(e) => {
                  setCityFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Cities</option>
                {uniqueCities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">Segment</label>
              <select 
                className="w-full p-2.5 rounded-xl glass-input outline-none text-xs focus:ring-2 focus:ring-emerald-200 transition-all border border-slate-200"
                value={segmentFilter}
                onChange={(e) => {
                  setSegmentFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Segments</option>
                {uniqueSegments.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">Sub Segment</label>
              <select 
                className="w-full p-2.5 rounded-xl glass-input outline-none text-xs focus:ring-2 focus:ring-emerald-200 transition-all border border-slate-200"
                value={subSegmentFilter}
                onChange={(e) => {
                  setSubSegmentFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Sub Segments</option>
                {uniqueSubSegments.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">Source</label>
              <select 
                className="w-full p-2.5 rounded-xl glass-input outline-none text-xs focus:ring-2 focus:ring-emerald-200 transition-all border border-slate-200"
                value={sourceFilter}
                onChange={(e) => {
                  setSourceFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Sources</option>
                {uniqueSources.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">Brand</label>
              <select 
                className="w-full p-2.5 rounded-xl glass-input outline-none text-xs focus:ring-2 focus:ring-emerald-200 transition-all border border-slate-200"
                value={brandFilter}
                onChange={(e) => {
                  setBrandFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Brands</option>
                {uniqueBrands.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">Model</label>
              <select 
                className="w-full p-2.5 rounded-xl glass-input outline-none text-xs focus:ring-2 focus:ring-emerald-200 transition-all border border-slate-200"
                value={modelFilter}
                onChange={(e) => {
                  setModelFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Models</option>
                {uniqueModels.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">Functionality</label>
              <select 
                className="w-full p-2.5 rounded-xl glass-input outline-none text-xs focus:ring-2 focus:ring-emerald-200 transition-all border border-slate-200"
                value={functionalityFilter}
                onChange={(e) => {
                  setFunctionalityFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Functionalities</option>
                {uniqueFunctionalities.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">Category</label>
              <select 
                className="w-full p-2.5 rounded-xl glass-input outline-none text-xs focus:ring-2 focus:ring-emerald-200 transition-all border border-slate-200"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Categories</option>
                {uniqueCategories.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">CRR/NBD</label>
              <select 
                className="w-full p-2.5 rounded-xl glass-input outline-none text-xs focus:ring-2 focus:ring-emerald-200 transition-all border border-slate-200"
                value={crrNbdFilter}
                onChange={(e) => {
                  setCrrNbdFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All CRR/NBD</option>
                {uniqueCrrNbds.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest pl-1">Type of Business</label>
              <select 
                className="w-full p-2.5 rounded-xl glass-input outline-none text-xs focus:ring-2 focus:ring-emerald-200 transition-all border border-slate-200"
                value={typeOfBusinessFilter}
                onChange={(e) => {
                  setTypeOfBusinessFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="">All Types</option>
                {uniqueTypesOfBusiness.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-6">
            <button 
              onClick={clearFilters}
              className="px-6 py-2 rounded-xl border border-rose-100 bg-rose-50 text-rose-600 text-xs font-bold hover:bg-rose-100 transition-all"
            >
              Clear All Filters
            </button>
            <button 
              onClick={() => setShowFilters(false)}
              className="px-6 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold hover:bg-slate-900 transition-all"
            >
              Hide Filters
            </button>
          </div>
        </motion.div>
      )}

      <div className="luxury-card overflow-hidden">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Date & OPF</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Client & Dealer</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Product Info</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Location</th>
                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Financials</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedData.length > 0 ? paginatedData.map((item, idx) => (
                <tr key={`${item.opf}-${idx}`} className="hover:bg-slate-50/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">
                      {(() => {
                        const parsed = parseSafeDate(item.date);
                        return parsed ? format(parsed, 'dd MMM yyyy') : item.date;
                      })()}
                    </div>
                    <div className="text-[10px] font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded inline-block mt-1 font-semibold">{item.opf}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-semibold text-slate-800">{item.clientName || 'N/A'}</div>
                      <div className="text-[10px] text-slate-400 font-medium line-clamp-1">{item.companyName || ''}</div>
                      <div className="text-xs text-slate-500">{item.mobileNumber || 'No Phone'}</div>
                    </div>
                    {(item.dealerName || item.dealerCompanyName) && (
                      <div className="mt-2 pt-2 border-t border-slate-100/50">
                        <div className="text-[9px] font-bold text-emerald-600 uppercase tracking-tight">Dealer Info</div>
                        <div className="text-[11px] font-medium text-slate-700">{item.dealerName} {item.dealerCompanyName ? `(${item.dealerCompanyName})` : ''}</div>
                        <div className="text-[10px] text-slate-400">{item.dealerCity}, {item.dealerState}</div>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-slate-700">{item.brandName} - {item.model}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-tight">{item.segment} | {item.functionality} | {item.crrNbd}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-slate-700">{item.city}</div>
                    <div className="text-[10px] text-slate-400 font-medium">{item.state}</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-bold text-slate-900">{formatCurrency(item.grossSales)}</div>
                    <div className="text-[10px] text-emerald-500 font-bold">Qty: {item.quantity}</div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-slate-400 font-medium">No submissions found matching your search</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 bg-slate-50/30 border-t border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Showing <span className="font-bold">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> of <span className="font-bold">{filteredData.length}</span> results
            </p>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-white transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-slate-200 disabled:opacity-30 hover:bg-white transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
