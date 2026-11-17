import React, { useMemo, useState, useCallback } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { OPFData, SalesTarget } from '../types';
import { format, isWithinInterval, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, subYears, isValid, eachDayOfInterval, parseISO } from 'date-fns';
import { Filter, Calendar, TrendingUp, Layers, AlertTriangle, ShieldCheck, Target, CheckCircle2 } from 'lucide-react';

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

const formatIndianCurrency = (num: number) => {
    const formatted = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(num);
    return formatted;
};

const normalizeRoom = (name?: string) => {
  if (!name) return '';
  return name.toLowerCase().replace(/[\r\n\t"]/g, '').replace(/\bshowroom\b/g, '').trim();
};

const isMatchingRoom = (r1?: string, r2?: string) => {
  if (!r1 || !r2) return false;
  const n1 = normalizeRoom(r1);
  const n2 = normalizeRoom(r2);
  if (!n1 || !n2) return false;
  return n1 === n2;
};

export const Dashboard = ({ 
  opfData, 
  targets, 
  user, 
  salespersons 
}: { 
  opfData: OPFData[]; 
  targets: SalesTarget[];
  user?: any;
  salespersons?: any[];
}) => {
  // opens on the current financial year (April to March)
  const fyStart = (() => { const n = new Date(); return n.getMonth() < 3 ? n.getFullYear() - 1 : n.getFullYear(); })();
  const [startDate, setStartDate] = useState(format(new Date(fyStart, 3, 1), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(fyStart + 1, 2, 31), 'yyyy-MM-dd'));
  const [activeFilter, setActiveFilter] = useState('thisYear');
  const [breakdownKey, setBreakdownKey] = useState<keyof OPFData>('segment');

  const [selectedSalesperson, setSelectedSalesperson] = useState<string>('all');
  const [selectedShowroom, setSelectedShowroom] = useState<string>('all');

  const regionalSalespersons = useMemo(() => {
    if (!user) return [];
    if (!user.isManager) return [user];
    return salespersons && salespersons.length > 0 ? salespersons : [user];
  }, [salespersons, user]);

  const availableShowrooms = useMemo(() => {
    if (!user || !user.isManager) return [];
    
    const set = new Set<string>();
    const userShowroom = (user.showroom || '').trim();
    if (userShowroom && normalizeRoom(userShowroom) !== 'all' && normalizeRoom(userShowroom) !== 'all regions') {
      set.add(userShowroom);
    }

    // Collect all showrooms from managed salespersons
    regionalSalespersons.forEach(s => {
      const room = (s.showroom || '').trim();
      if (room && normalizeRoom(room) !== 'all' && normalizeRoom(room) !== 'all regions') {
        set.add(room);
      }
    });

    // Also collect distinct transaction showrooms from opfData (Column AK)
    opfData.forEach(d => {
      const room = (d.showroom || '').trim();
      if (room && normalizeRoom(room) !== 'all' && normalizeRoom(room) !== 'all regions') {
        set.add(room);
      }
    });

    return Array.from(set).sort();
  }, [regionalSalespersons, opfData, user]);

  const effectiveShowroom = useMemo(() => {
    return selectedShowroom;
  }, [selectedShowroom]);

  const getSalespersonTargetsForPeriod = useCallback((sName: string) => {
    const sNameLower = sName.trim().toLowerCase();
    const start = startOfMonth(new Date(startDate + 'T00:00:00'));
    const end = endOfMonth(new Date(endDate + 'T23:59:59'));

    return targets
      .filter(t => t.salesperson && t.salesperson.trim().toLowerCase() === sNameLower)
      .filter(t => {
        const [mStr, yStr] = t.monthYear.split('-');
        const m = Number(mStr);
        const y = Number(yStr);
        const targetDate = new Date(y, m - 1, 1);
        if (targetDate < start || targetDate > end) return false;

        if (effectiveShowroom === 'all') return true;
        if (t.showroom) {
          return isMatchingRoom(t.showroom, effectiveShowroom);
        }
        const profile = regionalSalespersons.find(s => s.name.trim().toLowerCase() === sNameLower);
        return profile ? isMatchingRoom(profile.showroom, effectiveShowroom) : false;
      })
      .reduce((sum, t) => sum + (t.target || 0), 0);
  }, [targets, startDate, endDate, effectiveShowroom, regionalSalespersons]);

  const getSalespersonSalesForPeriod = useCallback((sName: string) => {
    const sNameLower = sName.trim().toLowerCase();
    const start = startOfDay(new Date(startDate + 'T00:00:00'));
    const end = endOfDay(new Date(endDate + 'T23:59:59'));

    return opfData
      .filter(row => row.salesperson && row.salesperson.trim().toLowerCase() === sNameLower)
      .filter(row => {
        if (effectiveShowroom !== 'all' && !isMatchingRoom(row.showroom || row.region, effectiveShowroom)) {
          return false;
        }
        const rowDate = parseSafeDate(row.date);
        if (!rowDate) return false;
        return isWithinInterval(rowDate, { start, end });
      })
      .reduce((sum, row) => sum + (row.grossSales || 0), 0);
  }, [opfData, startDate, endDate, effectiveShowroom]);

  const tableSalespersons = useMemo(() => {
    return regionalSalespersons.filter(s => {
      const stillHere = s.active !== false && (effectiveShowroom === 'all' || isMatchingRoom(s.showroom, effectiveShowroom));
      if (stillHere) return true;
      return getSalespersonTargetsForPeriod(s.name) > 0 || getSalespersonSalesForPeriod(s.name) > 0;
    });
  }, [regionalSalespersons, effectiveShowroom, getSalespersonTargetsForPeriod, getSalespersonSalesForPeriod]);

  const locationsDisplay = useMemo(() => {
    if (!user) return '';
    if (!user.isManager) return user.showroom || user.region;
    
    // Find unique showrooms inside regionalSalespersons
    const uniqueShowrooms = Array.from(new Set((regionalSalespersons || []).map(s => s.showroom).filter(Boolean)));
    if (uniqueShowrooms.length <= 3) {
      return uniqueShowrooms.join(', ');
    }
    // If there are many, show how many regions they cover
    const uniqueRegions = Array.from(new Set((regionalSalespersons || []).map(s => s.region).filter(Boolean)));
    return `${uniqueShowrooms.length} Showrooms across ${uniqueRegions.length} Regions`;
  }, [regionalSalespersons, user]);

  const localOpfData = useMemo(() => {
    if (!user) return [];
    if (!user.isManager) {
      const myName = user.name.trim().toLowerCase();
      return opfData.filter(d => d.salesperson && d.salesperson.trim().toLowerCase() === myName);
    }

    if (selectedSalesperson !== 'all') {
      const selName = selectedSalesperson.trim().toLowerCase();
      return opfData.filter(d => {
        if (!d.salesperson || d.salesperson.trim().toLowerCase() !== selName) return false;
        if (effectiveShowroom !== 'all') {
          if (!isMatchingRoom(d.showroom || d.region, effectiveShowroom)) return false;
        }
        return true;
      });
    }

    if (effectiveShowroom === 'all') {
      return opfData;
    }

    return opfData.filter(d => {
      return isMatchingRoom(d.showroom || d.region, effectiveShowroom);
    });
  }, [opfData, selectedSalesperson, effectiveShowroom, user]);

  const localTargets = useMemo(() => {
    if (!user) return [];
    if (!user.isManager) {
      const myName = user.name.trim().toLowerCase();
      return targets.filter(t => t.salesperson && t.salesperson.trim().toLowerCase() === myName);
    }

    if (selectedSalesperson !== 'all') {
      const selName = selectedSalesperson.trim().toLowerCase();
      return targets.filter(t => t.salesperson && t.salesperson.trim().toLowerCase() === selName);
    }

    if (effectiveShowroom === 'all') {
      return targets;
    }

    return targets.filter(t => {
      if (!t.salesperson) return false;
      if (t.showroom) {
        return isMatchingRoom(t.showroom, effectiveShowroom);
      }

      const profile = regionalSalespersons.find(s => s.name.trim().toLowerCase() === t.salesperson.trim().toLowerCase());
      return profile ? isMatchingRoom(profile.showroom, effectiveShowroom) : false;
    });
  }, [targets, selectedSalesperson, effectiveShowroom, user, regionalSalespersons]);

  const handleShowroomChange = (val: string) => {
    setSelectedShowroom(val);
    setSelectedSalesperson('all');
  };

  // Quick Filters
  const setQuickFilter = (type: string) => {
      const now = new Date();
      const currentMonth = now.getMonth(); // 0-indexed
      const currentYear = now.getFullYear();
      setActiveFilter(type);

      if (type === 'thisMonth') {
          setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
          setEndDate(format(endOfMonth(now), 'yyyy-MM-dd'));
      } else if (type === 'thisYear') {
          // Indian Financial Year: April to March
          let fyStartYear = currentYear;
          if (currentMonth < 3) fyStartYear = currentYear - 1;
          setStartDate(format(new Date(fyStartYear, 3, 1), 'yyyy-MM-dd')); // April 1st
          setEndDate(format(new Date(fyStartYear + 1, 2, 31), 'yyyy-MM-dd')); // March 31st
      } else if (type === 'lastYear') {
          let fyStartYear = currentYear - 1;
          if (currentMonth < 3) fyStartYear = currentYear - 2;
          setStartDate(format(new Date(fyStartYear, 3, 1), 'yyyy-MM-dd')); // April 1st
          setEndDate(format(new Date(fyStartYear + 1, 2, 31), 'yyyy-MM-dd')); // March 31st
      } else if (type === 'allTime') {
          setStartDate('2025-04-01');
          setEndDate(format(endOfDay(now), 'yyyy-MM-dd'));
      }
  };

  const filteredData = useMemo(() => {
    const start = startOfDay(new Date(startDate + 'T00:00:00'));
    const end = endOfDay(new Date(endDate + 'T23:59:59'));
    
    return localOpfData.filter(row => {
        const rowDate = parseSafeDate(row.date);
        if (!rowDate) return false;
        return isWithinInterval(rowDate, { start, end });
    });
  }, [localOpfData, startDate, endDate]);

  // Target vs Achievement Logic
  const comparisonData = useMemo(() => {
     const start = startOfDay(new Date(startDate + 'T00:00:00'));
     const end = endOfDay(new Date(endDate + 'T23:59:59'));

     // 1. Calculate Monthly Achievement
     const monthlyActuals = filteredData.reduce((acc, row) => {
        const d = parseSafeDate(row.date);
        if (d) {
            const monthKey = format(d, 'MM-yyyy');
            acc[monthKey] = (acc[monthKey] || 0) + (row.grossSales || 0);
        }
        return acc;
     }, {} as Record<string, number>);

     // 2. Build a set of all unique months in the range
     const allMonthsInRange: string[] = [];
     let curr = new Date(start.getFullYear(), start.getMonth(), 1);
     const endLimit = new Date(end.getFullYear(), end.getMonth(), 1);
     
     while (curr <= endLimit) {
        const mk = format(curr, 'MM-yyyy');
        if (!allMonthsInRange.includes(mk)) allMonthsInRange.push(mk);
        curr = new Date(curr.getFullYear(), curr.getMonth() + 1, 1);
     }

     const monthlyComparison = allMonthsInRange.map(mk => {
        // Sum targets for the month (robust to multiple rows)
        const target = localTargets
            .filter(t => t.monthYear === mk)
            .reduce((sum, t) => sum + (t.target || 0), 0);
            
        const actual = monthlyActuals[mk] || 0;
        const dateObj = new Date(Number(mk.split('-')[1]), Number(mk.split('-')[0]) - 1, 1);
        
        return {
            monthKey: mk,
            name: format(dateObj, 'MMM yy'),
            target,
            actual,
            percent: target > 0 ? Math.round((actual / target) * 100) : 0,
            quarter: `Q${Math.floor((dateObj.getMonth() + 9) % 12 / 3) + 1}`,
            fy: dateObj.getMonth() < 3 ? dateObj.getFullYear() - 1 : dateObj.getFullYear()
        };
     });

     // Quarterly aggregate
     const quarterlyMap = monthlyComparison.reduce((acc, mc) => {
        const qKey = `${mc.quarter} FY${String(mc.fy).slice(-2)}`;
        if (!acc[qKey]) acc[qKey] = { name: qKey, target: 0, actual: 0 };
        acc[qKey].target += mc.target;
        acc[qKey].actual += mc.actual;
        return acc;
     }, {} as Record<string, any>);

     const quarterlyComparison = Object.values(quarterlyMap).map(q => ({
        ...q,
        percent: q.target > 0 ? Math.round((q.actual / q.target) * 100) : 0
     }));

     // Summary for KPI and context
     const periodTarget = monthlyComparison.reduce((sum, m) => sum + m.target, 0);
     const periodActual = monthlyComparison.reduce((sum, m) => sum + m.actual, 0);
     const totalDaysInRange = Math.max(1, eachDayOfInterval({ start, end }).length);
     const dailyTarget = periodTarget / totalDaysInRange;

     // YoY Target Aggregation
     const yearlyTargetMap = localTargets.reduce((acc, t) => {
        const [m, y] = t.monthYear.split('-').map(Number);
        const fyStartYear = m <= 3 ? y - 1 : y;
        const fyLabel = `FY ${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`;
        acc[fyLabel] = (acc[fyLabel] || 0) + (t.target || 0);
        return acc;
     }, {} as Record<string, number>);

     return { monthly: monthlyComparison, quarterly: quarterlyComparison, periodTarget, periodActual, dailyTarget, yearlyTargetMap };
  }, [filteredData, localTargets, startDate, endDate]);

  const kpis = useMemo(() => {
      const totalSales = filteredData.reduce((acc, row) => acc + (row.grossSales || 0), 0);
      const totalOrders = filteredData.filter(row => row.grossSales > 0 || row.opf).length;
      const targetAchievement = comparisonData.periodTarget > 0 ? (totalSales / comparisonData.periodTarget) * 100 : 0;
      return { 
          totalSales, 
          totalOrders, 
          target: comparisonData.periodTarget,
          targetCompletion: Math.round(targetAchievement)
      };
  }, [filteredData, comparisonData]);

  // Dynamic breakdown for the Bar Chart
  const dynamicSegmentData = useMemo(() => {
    const groupedSales = filteredData.reduce((acc, row) => {
        const key = String(row[breakdownKey] || 'Unknown').trim();
        const validKey = key === '' ? 'Unknown' : key;
        
        acc[validKey] = (acc[validKey] || 0) + (row.grossSales || 0);
        return acc;
    }, {} as Record<string, number>);

    return Object.keys(groupedSales)
        .map(key => ({ 
            name: key, 
            sales: groupedSales[key],
            achievement: kpis.totalSales > 0 ? (groupedSales[key] / kpis.totalSales) * 100 : 0 
        }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 15);
  }, [filteredData, breakdownKey, kpis.totalSales]);

  // Daily Trend grouping for line chart
  const dailyTrendData = useMemo(() => {
    const dailySales = filteredData.reduce((acc, row) => {
        const d = parseSafeDate(row.date);
        if (d) {
            const dateKey = format(d, 'yyyy-MM-dd');
            acc[dateKey] = (acc[dateKey] || 0) + (row.grossSales || 0);
        }
        return acc;
    }, {} as Record<string, number>);

    return Object.keys(dailySales).sort().map(key => {
        const d = parseISO(key);
        return {
            date: format(d, 'dd MMM'),
            sales: dailySales[key],
            targetLine: comparisonData.dailyTarget
        };
     });
  }, [filteredData, comparisonData.dailyTarget]);

  // Attendance Tracker
  const attendanceData = useMemo(() => {
      try {
        const start = parseISO(startDate);
        const end = parseISO(endDate);
        const days = eachDayOfInterval({ start, end });
        
        const attendanceMap = new Set(filteredData.map(r => {
            const d = parseSafeDate(r.date);
            return d ? format(d, 'yyyy-MM-dd') : '';
        }));
        
        let presentCount = 0;
        const trend = days.map(d => {
            const dateStr = format(d, 'yyyy-MM-dd');
            const isPresent = attendanceMap.has(dateStr);
            if(isPresent) presentCount++;
            return {
                date: format(d, 'dd MMM'),
                present: isPresent ? 1 : 0
            };
        });

        return { trend, presentCount, totalDays: days.length };
      } catch(e) {
          return { trend: [], presentCount: 0, totalDays: 0 };
      }
  }, [filteredData, startDate, endDate]);

  // Overall YoY comparison
  const yearlyData = useMemo(() => {
      const yearlyList = localOpfData.reduce((acc, row) => {
          const d = parseSafeDate(row.date);
          if (d) {
              const date = new Date(d);
              const year = date.getFullYear();
              const month = date.getMonth();
              const fyStartYear = month < 3 ? year - 1 : year;
              const fyLabel = `FY ${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`;
              acc[fyLabel] = (acc[fyLabel] || 0) + (row.grossSales || 0);
          }
          return acc;
      }, {} as Record<string, number>);
      
      return Object.keys(yearlyList).sort().map(fy => ({ 
          fy, 
          sales: yearlyList[fy],
          target: comparisonData.yearlyTargetMap[fy] || 0
      }));
  }, [localOpfData, comparisonData.yearlyTargetMap]);

  const getAchColor = (p: number) => {
    if (p >= 90) return 'text-emerald-500';
    if (p >= 70) return 'text-amber-600';
    return 'text-red-500';
  };

  const buttonClass = "px-4 py-2 rounded-xl text-sm font-semibold transition-all border";
  const activeClass = "bg-slate-900/90 backdrop-blur-md text-white border-white/20 hover:bg-slate-800";
  const inactiveClass = "glass-input text-slate-700 hover:bg-white/50";

  return (
    <div className="space-y-6 pb-12">
      {/* Filters Header */}
      <div className="luxury-card p-4 md:p-6 flex flex-col lg:flex-row gap-4 lg:gap-6 justify-between items-stretch lg:items-center">
        <div className="flex flex-wrap gap-1.5 md:gap-2 items-center">
            <Filter size={16} className="text-slate-400 mr-1 hidden sm:block" />
            <button 
                onClick={() => setQuickFilter('thisMonth')} 
                className={`${buttonClass} px-3 py-1.5 md:px-4 md:py-2 flex-1 sm:flex-none ${activeFilter === 'thisMonth' ? activeClass : inactiveClass}`}
            >
                Month
            </button>
            <button 
                onClick={() => setQuickFilter('thisYear')} 
                className={`${buttonClass} px-3 py-1.5 md:px-4 md:py-2 flex-1 sm:flex-none whitespace-nowrap ${activeFilter === 'thisYear' ? activeClass : inactiveClass}`}
            >
                This FY
            </button>
            <button 
                onClick={() => setQuickFilter('lastYear')} 
                className={`${buttonClass} px-3 py-1.5 md:px-4 md:py-2 flex-1 sm:flex-none whitespace-nowrap ${activeFilter === 'lastYear' ? activeClass : inactiveClass}`}
            >
                Last FY
            </button>
            <button 
                onClick={() => setQuickFilter('allTime')} 
                className={`${buttonClass} px-3 py-1.5 md:px-4 md:py-2 flex-1 sm:flex-none ${activeFilter === 'allTime' ? activeClass : inactiveClass}`}
            >
                All
            </button>
        </div>
        <div className="flex gap-2 md:gap-4 items-center justify-between">
            <div className="flex gap-2 items-center flex-1">
                <Calendar size={16} className="text-slate-400 hidden sm:block" />
                <input 
                    type="date" 
                    value={startDate} 
                    onChange={e => {
                        setStartDate(e.target.value);
                        setActiveFilter('custom');
                    }} 
                    className="w-full p-2 glass-input outline-none text-[13px] md:text-sm text-slate-700 min-w-0"
                />
                <span className="text-slate-400 font-medium text-xs">to</span>
                <input 
                    type="date" 
                    value={endDate} 
                    onChange={e => {
                        setEndDate(e.target.value);
                        setActiveFilter('custom');
                    }} 
                    className="w-full p-2 glass-input outline-none text-[13px] md:text-sm text-slate-700 min-w-0"
                />
            </div>
        </div>
      </div>
      
      {/* Regional Manager Salesperson Breakup Panel */}
      {user?.isManager && (
        <div className="luxury-card p-5 md:p-6 bg-white/60 shadow-sm border border-slate-100 flex flex-col gap-6">
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center border-b border-slate-100 pb-4 gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 bg-indigo-500 rounded-full animate-pulse"></span>
                Location Performance Breakup
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Comparing target vs achievement breakdown for each salesperson in your location. Click on a showroom or salesperson row to view their detailed metrics.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full xl:w-auto self-stretch xl:self-auto justify-between xl:justify-end">
              <div className="flex items-center gap-2 flex-1 sm:flex-none">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Showroom:</span>
                <select
                  value={selectedShowroom}
                  onChange={(e) => handleShowroomChange(e.target.value)}
                  className="p-2 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 cursor-pointer w-full sm:w-48"
                >
                  <option value="all">🏢 All Showrooms</option>
                  {availableShowrooms.map(room => (
                    <option key={room} value={room}>🏢 {room}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 flex-1 sm:flex-none">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Salesperson:</span>
                <select
                  value={selectedSalesperson}
                  onChange={(e) => setSelectedSalesperson(e.target.value)}
                  className="p-2 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 cursor-pointer w-full sm:w-48"
                >
                  <option value="all">📍 Showroom Consolidated ({selectedShowroom === 'all' ? 'All' : selectedShowroom})</option>
                  {tableSalespersons.map(s => (
                    <option key={s.id} value={s.name.trim()}>👤 {s.name} ({s.id})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Salesperson</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Showroom</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Role</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Target</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Achievement</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Achievement %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* 1. Showroom Consolidated Row */}
                <tr 
                  onClick={() => setSelectedSalesperson('all')}
                  className={`cursor-pointer transition-all hover:bg-slate-50/50 ${
                    selectedSalesperson === 'all' 
                      ? 'bg-indigo-50/60 font-semibold border-l-4 border-indigo-600 pl-3' 
                      : 'border-l-4 border-transparent'
                  }`}
                >
                  <td className="px-4 py-3.5 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-extrabold text-xs">
                      CON
                    </div>
                    <div>
                      <div className="text-sm font-extrabold text-slate-900">Showroom Consolidated</div>
                      <div className="text-[10px] text-slate-400">Total region target & sales sum</div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-xs font-semibold text-slate-600">
                    {effectiveShowroom === 'all' ? 'All Showrooms' : effectiveShowroom}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-indigo-100 text-indigo-800 uppercase tracking-widest border border-indigo-200">
                      Showroom
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right font-extrabold text-slate-700">
                    {formatIndianCurrency(
                      tableSalespersons.reduce((totalSum, s) => totalSum + getSalespersonTargetsForPeriod(s.name), 0)
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right font-black text-indigo-600">
                    {formatIndianCurrency(
                      tableSalespersons.reduce((totalSum, s) => totalSum + getSalespersonSalesForPeriod(s.name), 0)
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {(() => {
                      const totalT = tableSalespersons.reduce((totalSum, s) => totalSum + getSalespersonTargetsForPeriod(s.name), 0);
                      const totalA = tableSalespersons.reduce((totalSum, s) => totalSum + getSalespersonSalesForPeriod(s.name), 0);
                      const percent = totalT > 0 ? Math.round((totalA / totalT) * 100) : 0;
                      return (
                        <div className="inline-flex flex-col items-end">
                          <span className={`text-sm font-extrabold ${getAchColor(percent)}`}>{percent}%</span>
                          <div className="w-24 bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
                            <div className={`h-full bg-indigo-600`} style={{ width: `${Math.min(percent, 100)}%` }}></div>
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                </tr>

                {/* 2. Individual Salesperson Rows */}
                {tableSalespersons.map(s => {
                  const sNameLower = s.name.trim().toLowerCase();
                  const sTargetsForPeriod = getSalespersonTargetsForPeriod(s.name);
                  const sSales = getSalespersonSalesForPeriod(s.name);
                  const sPercent = sTargetsForPeriod > 0 ? Math.round((sSales / sTargetsForPeriod) * 100) : 0;
                  const isCurSel = selectedSalesperson.toLowerCase() === sNameLower;

                  return (
                    <tr 
                      key={s.id} 
                      onClick={() => setSelectedSalesperson(s.name.trim())}
                      className={`cursor-pointer transition-all hover:bg-slate-50/50 ${
                        isCurSel 
                          ? 'bg-indigo-50/40 font-semibold border-l-4 border-indigo-600 pl-3' 
                          : 'border-l-4 border-transparent'
                      }`}
                    >
                      <td className="px-4 py-3.5 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
                          {s.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{s.name}</div>
                          <div className="text-[10px] text-slate-400">Salesperson ID: {s.id}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-sm content-center text-slate-700 font-medium whitespace-nowrap">
                        <div>{effectiveShowroom !== 'all' ? effectiveShowroom : (s.showroom || 'N/A')}</div>
                        {s.showroom && effectiveShowroom !== 'all' && !isMatchingRoom(s.showroom, effectiveShowroom) ? (
                          <div className="text-[10px] text-indigo-600 font-semibold">Current: {s.showroom}</div>
                        ) : s.region ? (
                          <div className="text-[10px] text-slate-400">{s.region}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          s.isManager 
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' 
                            : 'bg-slate-50 text-slate-500 border border-slate-100'
                        }`}>
                          {s.active === false ? 'Left' : s.isManager ? 'Manager' : 'Rep'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-slate-600">
                        {formatIndianCurrency(sTargetsForPeriod)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-extrabold text-slate-900">
                        {formatIndianCurrency(sSales)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex flex-col items-end">
                          <span className={`text-sm font-bold ${getAchColor(sPercent)}`}>
                            {sPercent}%
                          </span>
                          <div className="w-24 bg-slate-100 h-1.5 rounded-full mt-1 overflow-hidden">
                            <div 
                              className={`h-full ${sPercent >= 100 ? 'bg-emerald-500' : sPercent >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                              style={{ width: `${Math.min(sPercent, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="luxury-card p-5 md:p-8 bg-blue-50/30 overflow-hidden relative border-blue-100">
            <TrendingUp size={100} className="absolute -right-4 -bottom-4 text-blue-100/50" />
            <div className="relative z-10">
                <p className="text-slate-500 text-xs md:text-sm font-semibold mb-1">Total Sales</p>
                <p className="text-2xl md:text-3xl font-extrabold text-blue-600 tracking-tight">
                    {formatIndianCurrency(kpis.totalSales)}
                </p>
            </div>
        </div>
        <div className="luxury-card p-5 md:p-8 bg-emerald-50/30 overflow-hidden relative border-emerald-100">
            <CheckCircle2 size={100} className="absolute -right-4 -bottom-4 text-emerald-100/50" />
            <div className="relative z-10">
                <p className="text-slate-500 text-xs md:text-sm font-semibold mb-1">Target Achievement</p>
                <div className="flex items-baseline gap-2">
                    <p className={`text-2xl md:text-3xl font-extrabold tracking-tight ${getAchColor(kpis.targetCompletion)}`}>
                        {kpis.targetCompletion}%
                    </p>
                    <span className="text-[10px] md:text-sm font-medium text-slate-400">completed</span>
                </div>
            </div>
        </div>
        <div className="luxury-card p-5 md:p-8 bg-amber-50/30 overflow-hidden relative border-amber-100">
            <Target size={100} className="absolute -right-4 -bottom-4 text-amber-100/50" />
            <div className="relative z-10">
                <p className="text-slate-500 text-xs md:text-sm font-semibold mb-1">Period Target</p>
                <p className="text-2xl md:text-3xl font-extrabold text-amber-600 tracking-tight">
                    {formatIndianCurrency(kpis.target)}
                </p>
            </div>
        </div>
        <div className="luxury-card p-5 md:p-8 bg-purple-50/30 overflow-hidden relative border-purple-100 sm:col-span-2 lg:col-span-1">
            <ShieldCheck size={100} className="absolute -right-4 -bottom-4 text-purple-100/50" />
            <div className="relative z-10">
                <p className="text-slate-500 text-xs md:text-sm font-semibold mb-1">Attendance</p>
                <div className="flex items-baseline gap-2">
                    <p className="text-2xl md:text-3xl font-extrabold text-purple-600 tracking-tight">
                        {attendanceData.presentCount}<span className="text-purple-300 mx-1">/</span>{attendanceData.totalDays}
                    </p>
                    <span className="text-[10px] md:text-sm font-medium text-slate-400">active days</span>
                </div>
            </div>
        </div>
      </div>

      {/* Monthly Target vs Achievement Table */}
      <div className="luxury-card overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="text-lg font-bold text-slate-800 tracking-tight">Monthly Performance Target vs Achievement</h3>
            <p className="text-slate-400 text-sm">Detailed breakdown of targets vs actual achievement.</p>
          </div>
          <Target className="text-emerald-500" size={24} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Month</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Target</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Achievement</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Achievement %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {comparisonData.monthly.map((row) => (
                <tr key={row.monthKey} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm font-semibold text-slate-700">{row.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 font-medium">{formatIndianCurrency(row.target)}</td>
                  <td className="px-6 py-4 text-sm text-slate-900 font-bold">{formatIndianCurrency(row.actual)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden max-w-[100px] hidden sm:block">
                        <div 
                          className={`h-full rounded-full ${row.percent >= 100 ? 'bg-emerald-500' : row.percent >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                          style={{ width: `${Math.min(row.percent, 100)}%` }}
                        />
                      </div>
                      <span className={`text-sm font-bold ${getAchColor(row.percent)}`}>
                        {row.percent}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {comparisonData.monthly.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-sm italic">
                    No data available for the selected period.
                  </td>
                </tr>
              )}
            </tbody>
            {comparisonData.monthly.length > 0 && (
              <tfoot className="bg-slate-50/80 font-bold">
                <tr>
                  <td className="px-6 py-4 text-sm text-slate-800">Total Period</td>
                  <td className="px-6 py-4 text-sm text-slate-800">{formatIndianCurrency(comparisonData.periodTarget)}</td>
                  <td className="px-6 py-4 text-sm text-slate-900">{formatIndianCurrency(comparisonData.periodActual)}</td>
                  <td className="px-6 py-4">
                    <span className={`text-sm ${getAchColor(Math.round((comparisonData.periodActual / comparisonData.periodTarget) * 100 || 0))}`}>
                      {Math.round((comparisonData.periodActual / comparisonData.periodTarget) * 100 || 0)}%
                    </span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* YoY Comparison Table */}
      {(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const thisFYStartYear = currentMonth >= 3 ? now.getFullYear() : now.getFullYear() - 1;
        const lastFYStartYear = thisFYStartYear - 1;
        
        const lastFYLabel = `FY ${lastFYStartYear}-${String(lastFYStartYear + 1).slice(-2)}`;
        const thisFYLabel = `FY ${thisFYStartYear}-${String(thisFYStartYear + 1).slice(-2)}`;

        const fyMonths = [
          { name: 'April', index: 3 },
          { name: 'May', index: 4 },
          { name: 'June', index: 5 },
          { name: 'July', index: 6 },
          { name: 'August', index: 7 },
          { name: 'September', index: 8 },
          { name: 'October', index: 9 },
          { name: 'November', index: 10 },
          { name: 'December', index: 11 },
          { name: 'January', index: 0 },
          { name: 'February', index: 1 },
          { name: 'March', index: 2 }
        ];

        const fyComparison = fyMonths.map(m => {
          const lastYear = m.index < 3 ? lastFYStartYear + 1 : lastFYStartYear;
          const thisYear = m.index < 3 ? thisFYStartYear + 1 : thisFYStartYear;

          const lastFYActual = opfData.reduce((sum, row) => {
            const d = parseSafeDate(row.date);
            if (d && d.getMonth() === m.index && d.getFullYear() === lastYear) {
              return sum + (row.grossSales || 0);
            }
            return sum;
          }, 0);

          const thisFYActual = opfData.reduce((sum, row) => {
            const d = parseSafeDate(row.date);
            if (d && d.getMonth() === m.index && d.getFullYear() === thisYear) {
              return sum + (row.grossSales || 0);
            }
            return sum;
          }, 0);

          const growth = lastFYActual > 0 ? Math.round(((thisFYActual - lastFYActual) / lastFYActual) * 100) : 0;

          return {
            month: m.name,
            lastFYActual,
            thisFYActual,
            growth
          };
        });

        const totalLastFY = fyComparison.reduce((sum, r) => sum + r.lastFYActual, 0);
        const totalThisFY = fyComparison.reduce((sum, r) => sum + r.thisFYActual, 0);
        const totalGrowth = totalLastFY > 0 ? Math.round(((totalThisFY - totalLastFY) / totalLastFY) * 100) : 0;

        return (
          <div className="luxury-card overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-lg font-bold text-slate-800 tracking-tight">Year-over-Year (YoY) Growth Analysis</h3>
                <p className="text-slate-400 text-sm">Comparing {lastFYLabel} against {thisFYLabel} performance.</p>
              </div>
              <TrendingUp className="text-emerald-500" size={24} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Month</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Last {lastFYLabel}</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">This {thisFYLabel}</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">% Growth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fyComparison.map((row) => (
                    <tr key={row.month} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-semibold text-slate-700">{row.month}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 font-medium">{formatIndianCurrency(row.lastFYActual)}</td>
                      <td className="px-6 py-4 text-sm text-slate-900 font-bold">{formatIndianCurrency(row.thisFYActual)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${row.growth > 0 ? 'text-emerald-600' : row.growth < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                            {row.growth > 0 ? '+' : ''}{row.growth}%
                          </span>
                          {row.growth !== 0 && (
                            <TrendingUp 
                              size={14} 
                              className={row.growth > 0 ? 'text-emerald-500' : 'text-rose-500 rotate-180'} 
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50/80 font-bold">
                  <tr>
                    <td className="px-6 py-4 text-sm text-slate-800">Total FY</td>
                    <td className="px-6 py-4 text-sm text-slate-800">{formatIndianCurrency(totalLastFY)}</td>
                    <td className="px-6 py-4 text-sm text-slate-900">{formatIndianCurrency(totalThisFY)}</td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-bold ${totalGrowth > 0 ? 'text-emerald-600' : totalGrowth < 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        {totalGrowth > 0 ? '+' : ''}{totalGrowth}%
                      </span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Target vs Achievement Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="luxury-card p-8">
            <h3 className="text-lg font-bold mb-1 text-slate-800 tracking-tight">Month-wise Target vs Sales</h3>
            <p className="text-slate-400 text-sm mb-8">Performance tracking against set monthly goals.</p>
            <ResponsiveContainer width="100%" height={320}>
                <BarChart data={comparisonData.monthly}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} tickFormatter={(v) => v >= 100000 ? `₹${(v/100000).toFixed(1)}L` : `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip 
                        cursor={{fill: '#f8fafc'}} 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                        formatter={(val: number, name: string, props: any) => {
                            const data = props.payload;
                            if (name === 'Actual' && data.target > 0) {
                                const ach = Math.round((val / data.target) * 100);
                                return [
                                    <span>{formatIndianCurrency(val)} <span className={`${getAchColor(ach)} text-[10px] font-bold ml-1`}>({ach}%)</span></span>, 
                                    name
                                ];
                            }
                            return [formatIndianCurrency(val), name];
                        }}
                    />
                    <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '20px' }} />
                    <Bar name="Target" dataKey="target" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar name="Actual" dataKey="actual" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>

        <div className="luxury-card p-8">
            <h3 className="text-lg font-bold mb-1 text-slate-800 tracking-tight">Quarterly Performance</h3>
            <p className="text-slate-400 text-sm mb-8">Aggregated success rate by Indian Financial Quarters.</p>
            <ResponsiveContainer width="100%" height={320}>
                <BarChart data={comparisonData.quarterly} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontWeight: 600, fontSize: 12}} width={80} />
                    <Tooltip 
                        cursor={{fill: '#f8fafc'}} 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(val: number, name: string, props: any) => {
                            const data = props.payload;
                            if (name === 'Actual' && data.target > 0) {
                                const ach = Math.round((val / data.target) * 100);
                                return [
                                    <span>{formatIndianCurrency(val)} <span className={`${getAchColor(ach)} text-[10px] font-bold ml-1`}>({ach}%)</span></span>, 
                                    name
                                ];
                            }
                            return [formatIndianCurrency(val), name];
                        }}
                    />
                    <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '20px' }} />
                    <Bar name="Target" dataKey="target" fill="#94a3b8" radius={[0, 4, 4, 0]} barSize={20} />
                    <Bar name="Actual" dataKey="actual" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
            </ResponsiveContainer>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="luxury-card p-8">
            <h3 className="text-lg font-bold mb-6 text-slate-800 tracking-tight">Daily Sales Trend</h3>
            <ResponsiveContainer width="100%" height={320}>
                <LineChart data={dailyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} tickFormatter={(v) => v >= 100000 ? `₹${(v/100000).toFixed(1)}L` : `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip 
                        cursor={{stroke: '#cbd5e1', strokeWidth: 1}} 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                        formatter={(val: number, name: string, props: any) => {
                            if (name === 'Actual Sales') {
                                const data = props.payload;
                                if (data.targetLine > 0) {
                                    const ach = Math.round((val / data.targetLine) * 100);
                                    return [
                                        <span>{formatIndianCurrency(val)} <span className={`${getAchColor(ach)} text-[10px] font-bold ml-1`}>({ach}%)</span></span>, 
                                        name
                                    ];
                                }
                            }
                            return [formatIndianCurrency(val), name];
                        }}
                    />
                    <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '20px' }} />
                    <Line name="Actual Sales" type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 6}} />
                    <Line name="Avg Daily Goal" type="monotone" dataKey="targetLine" stroke="#64748b" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="luxury-card p-8 flex flex-col">
            <div className="flex justify-between items-start mb-6">
                <h3 className="text-lg font-bold text-slate-800 tracking-tight capitalize border-b border-transparent">
                    Sales by {breakdownKey.replace(/([A-Z])/g, ' $1').trim()}
                </h3>
                <select 
                    value={breakdownKey} 
                    onChange={(e) => setBreakdownKey(e.target.value as keyof OPFData)}
                    className="p-2 px-3 glass-input outline-none font-medium cursor-pointer text-sm text-slate-700 hover:bg-white/50"
                >
                    <option value="segment">Segment</option>
                    <option value="subSegment">Sub-Segment</option>
                    <option value="leadSource">Lead Source</option>
                    <option value="brandName">Brand</option>
                    <option value="model">Model</option>
                    <option value="category">Category</option>
                    <option value="region">Region</option>
                    <option value="city">City</option>
                    <option value="state">State</option>
                </select>
            </div>
            
            <ResponsiveContainer width="100%" height={320}>
                <BarChart data={dynamicSegmentData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11}} dy={10} interval={0} angle={-30} textAnchor="end" height={60} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} tickFormatter={(v) => v >= 100000 ? `₹${(v/100000).toFixed(1)}L` : `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip 
                        cursor={{fill: '#f8fafc'}} 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                        formatter={(val: number, name: string, props: any) => {
                            if (name === 'Sales') return [formatIndianCurrency(val), 'Sales'];
                            return [val, name];
                        }}
                        labelFormatter={(label, items) => {
                            const item = items[0]?.payload;
                            return (
                                <div className="font-bold mb-1">
                                    <div className="text-slate-800">{label}</div>
                                    {item && item.achievement > 0 && (
                                        <div className="text-[10px] text-emerald-500 font-medium whitespace-nowrap">
                                            Contributes {item.achievement.toFixed(1)}% of Total Achievement
                                        </div>
                                    )}
                                </div>
                            );
                        }}
                    />
                    <Bar name="Sales" dataKey="sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
          </div>
      </div>

      {/* Bottom Insights Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="luxury-card p-8">
            <h3 className="text-lg font-bold mb-1 text-slate-800 tracking-tight">Attendance Tracker</h3>
            <p className="text-slate-400 text-sm mb-8">Daily activity mapped within the selected timeframe.</p>
            <ResponsiveContainer width="100%" height={260}>
                <BarChart data={attendanceData.trend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} dy={10} />
                    <YAxis dataKey="present" domain={[0, 1]} ticks={[0, 1]} tickFormatter={(v) => v === 1 ? 'Present' : 'Absent'} axisLine={false} tickLine={false} width={60} tick={{fill: '#94a3b8', fontSize: 10}} />
                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(val: number) => [val === 1 ? 'Yes' : 'No', 'Logged Activity?']} />
                    <Bar dataKey="present" fill={attendanceData.trend.length > 0 ? "#6366f1" : "transparent"} radius={[2, 2, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="luxury-card p-8">
            <h3 className="text-lg font-bold mb-1 text-slate-800 tracking-tight">Year-over-Year History</h3>
            <p className="text-slate-400 text-sm mb-8">Cumulative overview across all recorded years.</p>
            <ResponsiveContainer width="100%" height={260}>
                <BarChart data={yearlyData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="fy" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10}} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} tickFormatter={(v) => v >= 100000 ? `₹${(v/100000).toFixed(1)}L` : `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip 
                        cursor={{fill: '#f8fafc'}} 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                        formatter={(val: number, name: string, props: any) => {
                            const data = props.payload;
                            if (name === 'Actual' && data.target > 0) {
                                const ach = Math.round((val / data.target) * 100);
                                return [
                                    <span>{formatIndianCurrency(val)} <span className={`${getAchColor(ach)} text-[10px] font-bold ml-1`}>({ach}%)</span></span>, 
                                    name
                                ];
                            }
                            return [formatIndianCurrency(val), name];
                        }}
                    />
                    <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '10px' }} iconSize={10} />
                    <Bar name="Target" dataKey="target" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    <Bar name="Actual" dataKey="sales" fill="#0f172a" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
          </div>
      </div>
    </div>
  );
};
