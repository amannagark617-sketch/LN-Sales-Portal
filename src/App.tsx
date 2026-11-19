/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ReadyStock } from './components/ReadyStock';
import { InstallButton, InstallPrompt, UpdateBanner } from './components/InstallApp';
import { refreshServerData, fetchSalespersons, fetchValidationData, fetchOPFData, fetchUniqueOPFCodeMap, fetchTargets, loginSalesperson } from './services/dataService';
import { Salesperson, ValidationData, OPFData, SalesTarget } from './types';
import { Button } from './components/ui';
import { SaleForm } from './components/SaleForm';
import { NoSaleForm } from './components/NoSaleForm';
import { Dashboard } from './components/Dashboard';
import { LogOut, LayoutDashboard, FileText, Ban, History, RefreshCw, Package, Link2, Users } from 'lucide-react';
import { CrmApp } from './crm/CrmApp';
import { crmAction, fetchCrmQuote } from './crm/api';
import { SHOW_CRM } from './crm/flag';
import { QuickLinks } from './components/QuickLinks';
import { MySubmissions } from './components/MySubmissions';
import { QuotationWizard } from './components/QuotationWizard';
import { LoadingScreen } from './components/LoadingScreen';
import { NotificationProvider, useNotification } from './components/Notification';

export default function App() {
  return (
    <NotificationProvider>
      <MainContent />
    </NotificationProvider>
  );
}

function MainContent() {
  const { showNotification } = useNotification();
  const [user, setUser] = useState<Salesperson | null>(null);
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [salespersons, setSalespersons] = useState<Salesperson[]>([]);
  const [validationData, setValidationData] = useState<ValidationData | null>(null);
  const [opfData, setOpfData] = useState<OPFData[]>([]);
  const [targets, setTargets] = useState<SalesTarget[]>([]);
  const [codeMap, setCodeMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [quoteLead, setQuoteLead] = useState<any>(null);
  const [saleLink, setSaleLink] = useState<{ lead: any; quote?: any; record?: any } | null>(null);
  const [quoteReuse, setQuoteReuse] = useState<{ no: string; asPI: boolean } | null>(null);
  const [view, setView] = useState<'dashboard' | 'sale' | 'noSale' | 'submissions' | 'quotation' | 'stock' | 'links' | 'crm'>('sale');

  useEffect(() => {
    // Check for stored user session
    const storedUser = localStorage.getItem('little_nap_user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } catch (e) {
        console.error('Failed to parse stored user:', e);
        localStorage.removeItem('little_nap_user');
      }
    }
    refreshData(false);
  }, []);

  // Poll every 5 seconds if a user is logged in
  useEffect(() => {
    if (user) {
      // Only while the page is on screen. Hidden tab, minimized window, locked phone or another app on top: no calls.
      const intervalId = setInterval(() => {
        if (document.hidden) return;
        refreshData(true);
      }, 5000);
      // One fetch the moment the person comes back, so the data is current straight away
      const onVisible = () => { if (!document.hidden) refreshData(true); };
      document.addEventListener('visibilitychange', onVisible);
      return () => { clearInterval(intervalId); document.removeEventListener('visibilitychange', onVisible); };
    }
  }, [user]);

  const refreshData = async (silent = false) => {
    const storedUser = localStorage.getItem('little_nap_user');
    if (!storedUser && !user) {
      if (!silent) setLoading(false);
      return;
    }

    if (!silent) setLoading(true);
    try {
      const [salespersonsRes, validationDataRes, opfDataRes, codeMapRes, targetsRes] = await Promise.all([
        fetchSalespersons(), 
        fetchValidationData(), 
        fetchOPFData(), 
        fetchUniqueOPFCodeMap(),
        fetchTargets()
      ]);
      setSalespersons(salespersonsRes);
      setValidationData(validationDataRes);
      setOpfData(opfDataRes);
      setCodeMap(codeMapRes);
      setTargets(targetsRes);
      
      // Update logged-in user with latest spreadsheet info, including manager status!
      const activeUser = user || (storedUser ? JSON.parse(storedUser) : null);
      if (activeUser) {
        const latestInfo = salespersonsRes.find(s => s.id === activeUser.id);
        if (latestInfo) {
          // Compare if any relevant field changed before calling setUser to prevent infinite re-renders & unnecessary state resets
          const hasChanged = !user || 
            user.showroom !== latestInfo.showroom || 
            user.region !== latestInfo.region || 
            user.isManager !== latestInfo.isManager ||
            user.name !== latestInfo.name ||
            user.id !== latestInfo.id;
          
          if (hasChanged) {
            setUser({ ...latestInfo, password: activeUser.password });
          }
        }
      }
    } catch (err) {
      console.error('Failed to refresh data:', err);
      if (!silent) setError('Failed to load data. Please try again.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // 1. Authenticate against server API
      const authenticatedUser = await loginSalesperson(id, password);
      
      // 2. Set current user states & localStorage
      setUser(authenticatedUser);
      localStorage.setItem('little_nap_user', JSON.stringify(authenticatedUser));
      
      // 3. Trigger immediate data refresh
      const [salespersonsRes, validationDataRes, opfDataRes, codeMapRes, targetsRes] = await Promise.all([
        fetchSalespersons(), 
        fetchValidationData(), 
        fetchOPFData(), 
        fetchUniqueOPFCodeMap(),
        fetchTargets()
      ]);
      setSalespersons(salespersonsRes);
      setValidationData(validationDataRes);
      setOpfData(opfDataRes);
      setCodeMap(codeMapRes);
      setTargets(targetsRes);
      
      setView('sale');
    } catch (err: any) {
      console.error('Login failed:', err);
      setError(err.message || 'Invalid ID or Password');
    } finally {
      setLoading(false);
    }
  };

  const submitReport = async (data: any) => {
    const payloadObject = JSON.parse(JSON.stringify(data, (key, value) => {
      if (key && (key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance'))) {
        return undefined;
      }
      if (value && typeof value === 'object' && (value.nodeName || value.preventDefault || value.target)) {
        return undefined;
      }
      return value;
    }));

    console.log('Submitting report via secure proxy');
    
    try {
      const storedUser = localStorage.getItem('little_nap_user');
      let headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed?.id && parsed?.password) {
          headers['X-User-Id'] = parsed.id.trim();
          headers['X-User-Password'] = parsed.password;
        }
      }

      const response = await fetch('/api/submit-report', {
        method: 'POST',
        headers,
        body: JSON.stringify(payloadObject),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Secure submission endpoint rejected transaction.');
      }
      
      showNotification('Report submitted successfully!', 'success');
      if (saleLink?.lead && payloadObject.opfNumber) {
        try {
          await crmAction({ action: 'close-lead', enquiryNo: saleLink.lead.enquiryNo, opf: payloadObject.opfNumber, orderValue: String(payloadObject.grossSales || 0), text: saleLink.quote ? `Sale report submitted against ${saleLink.quote.quoteNo}.` : 'Sale report submitted.' });
          showNotification(`Lead ${saleLink.lead.enquiryNo} is now closed with OPF ${payloadObject.opfNumber}.`, 'success');
        } catch (e: any) {
          showNotification(`The sale is saved, but the lead could not be closed: ${e.message}. Close it from the CRM with OPF ${payloadObject.opfNumber}.`, 'error');
        }
        setSaleLink(null);
      }
      await refreshData(true);
      setView('dashboard');
    } catch (err) {
      console.error('Submission failed:', err);
      showNotification(`Failed to submit report. ${(err as any)?.message || ''}`.trim(), 'error');
    }
  };

  const mySubmissionsData = opfData.filter(o => {
    if (!o.salesperson || !user) return false;
    return o.salesperson.trim().toLowerCase() === user.name.trim().toLowerCase();
  });

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return (
      <div className="min-h-screen premium-bg flex items-center justify-center p-4">
        <div className="w-full max-w-md luxury-card p-10 sm:p-12">
          <div className="flex justify-center mb-10">
            <img 
                src="https://s3.eu-central-1.wasabisys.com/onemessageapp/admin/2025/8/8/images/4b/e9/ec44ce49b54b405e9837db8c55484438.png" 
                alt="Logo" 
                className="h-12 w-auto opacity-90 drop-shadow-sm"
                referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-2xl font-bold mb-2 text-center text-slate-800 tracking-tight">Little Nap Recliners</h1>
          <p className="text-center text-slate-500 text-sm mb-8">Salesperson Portal</p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Salesperson ID</label>
                <input className="w-full p-4 glass-input text-slate-800 placeholder:text-slate-400 outline-none" placeholder="Enter your ID" value={id} onChange={e => setId(e.target.value)} />
            </div>
            <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Password</label>
                <input className="w-full p-4 glass-input text-slate-800 placeholder:text-slate-400 outline-none" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-rose-500 text-sm text-center font-medium bg-rose-50/50 backdrop-blur-sm p-2 rounded-lg">{error}</p>}
            <Button type="submit" className="w-full h-14 mt-4 rounded-xl bg-slate-900/90 backdrop-blur-sm hover:bg-slate-800 text-white font-semibold transition-colors shadow-lg">Sign In</Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen premium-bg p-3 md:p-8" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
      <UpdateBanner />
      {user && <InstallPrompt />}
      <header className="glass-header rounded-2xl shadow-lg p-3 md:p-4 mb-6 md:mb-8 md:sticky md:top-4 z-50">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3 md:gap-4">
          
          {/* Brand/logo row with responsive small Logout */}
          <div className="flex items-center justify-between w-full lg:w-auto gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <img 
                  src="https://s3.eu-central-1.wasabisys.com/onemessageapp/admin/2025/8/8/images/4b/e9/ec44ce49b54b405e9837db8c55484438.png" 
                  alt="Logo" 
                  className="h-8 md:h-9 w-auto shrink-0 opacity-95 drop-shadow-sm"
                  referrerPolicy="no-referrer"
              />
              <h1 className="font-bold text-slate-800 tracking-tight truncate text-sm md:text-base leading-tight">Little Nap Recliners</h1>
            </div>
            
            <button
              onClick={async () => { setRefreshing(true); try { await refreshServerData(); await refreshData(true); } finally { setRefreshing(false); } }}
              disabled={refreshing}
              aria-label="Refresh data"
              className="lg:hidden h-9 w-9 shrink-0 rounded-xl flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all border border-slate-200 disabled:opacity-50"
            >
                <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <div className="lg:hidden"><InstallButton compact /></div>
            <button 
              onClick={() => {
                setUser(null);
                localStorage.removeItem('little_nap_user');
              }} 
              aria-label="Logout"
              className="lg:hidden h-9 w-9 shrink-0 rounded-xl flex items-center justify-center bg-rose-50 hover:bg-rose-100 text-rose-600 transition-all border border-rose-100"
            >
                <LogOut size={16} />
            </button>
          </div>

          {/* Tab bar track: swipable horizontally on mobile/tablets, beautiful grid row on desktop */}
          <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end overflow-hidden">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scrollbar-none pb-1 lg:pb-0 w-full lg:w-auto -mx-1 px-1 lg:mx-0 lg:px-0">
              <div className="flex gap-2 shrink-0 md:gap-2.5">
                  {/* 1. New Sale */}
                  <button 
                    onClick={() => { setSaleLink(null); setView('sale'); }} 
                    className={`h-10 px-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all border text-xs md:text-sm whitespace-nowrap leading-none ${
                      view === 'sale' 
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-250/10' 
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                      <FileText size={15} />
                      <span>New Sale</span>
                  </button>

                  {/* Leads CRM */}
                  {SHOW_CRM && user && user.crmAdmin && (
                    <button
                      onClick={() => setView('crm')}
                      className={`h-10 px-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all border text-xs md:text-sm whitespace-nowrap leading-none ${
                        view === 'crm'
                          ? 'bg-slate-900 text-white border-slate-800 shadow-md'
                          : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <Users size={15} />
                      <span>CRM</span>
                    </button>
                  )}

                  {/* 2. No Sale */}
                  <button 
                    onClick={() => setView('noSale')} 
                    className={`h-10 px-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all border text-xs md:text-sm whitespace-nowrap leading-none ${
                      view === 'noSale' 
                        ? 'bg-rose-600 text-white border-rose-500 shadow-md shadow-rose-250/10' 
                        : 'bg-white text-rose-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                      <Ban size={15} />
                      <span>No Sale</span>
                  </button>

                  {/* 3. Dashboard */}
                  <button 
                    onClick={() => setView('dashboard')} 
                    className={`h-10 px-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all border text-xs md:text-sm whitespace-nowrap leading-none ${
                      view === 'dashboard' 
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-250/10' 
                        : 'bg-white text-indigo-700 border-slate-200 hover:bg-indigo-50 hover:border-indigo-300'
                    }`}
                  >
                      <LayoutDashboard size={15} />
                      <span>Dashboard</span>
                  </button>

                  {/* 4. My Submissions */}
                  <button 
                    onClick={() => setView('submissions')} 
                    className={`h-10 px-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all border text-xs md:text-sm whitespace-nowrap leading-none ${
                      view === 'submissions' 
                        ? 'bg-slate-800 text-white border-slate-700 shadow-md shadow-slate-200/10' 
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                      <History size={15} />
                      <span>My Sale Report Data</span>
                  </button>

                  {/* Ready Stock | La-Z-Boy */}
                  <button 
                    onClick={() => setView('stock')} 
                    className={`h-10 px-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all border text-xs md:text-sm whitespace-nowrap leading-none ${
                      view === 'stock' 
                        ? 'bg-amber-700 text-white border-amber-600 shadow-md shadow-amber-250/10' 
                        : 'bg-white text-amber-800 border-slate-200 hover:bg-amber-50 hover:border-amber-300'
                    }`}
                  >
                      <Package size={15} />
                      <span>Ready Stock | La-Z-Boy</span>
                  </button>

                  {/* 5. Proforma Invoice Generator */}
                  <button 
                    onClick={() => { setQuoteLead(null); setQuoteReuse(null); setView('quotation'); }} 
                    className={`h-10 px-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all border text-xs md:text-sm whitespace-nowrap leading-none ${
                      view === 'quotation' 
                        ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-250/10' 
                        : 'bg-white text-emerald-850 border-slate-200 hover:bg-emerald-50 hover:border-emerald-250'
                    }`}
                  >
                      <FileText size={15} />
                      <span>Proforma Invoice Generator</span>
                  </button>

                  {/* Quick links */}
                  <button 
                    onClick={() => setView('links')} 
                    className={`h-10 px-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all border text-xs md:text-sm whitespace-nowrap leading-none ${
                      view === 'links' 
                        ? 'bg-slate-900 text-white border-slate-800 shadow-md' 
                        : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                  >
                      <Link2 size={15} />
                      <span>Quick Links</span>
                  </button>
              </div>
            </div>
            
            <div className="w-px h-8 bg-slate-200/80 mx-1 hidden lg:block shrink-0"></div>
            
            <div className="hidden lg:block"><InstallButton compact /></div>
            <button
              onClick={async () => { setRefreshing(true); try { await refreshServerData(); await refreshData(true); } finally { setRefreshing(false); } }}
              disabled={refreshing}
              className="hidden lg:flex h-10 px-4 rounded-xl items-center justify-center gap-2 shrink-0 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition-all border border-slate-200 disabled:opacity-50"
            >
                <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
                <span>Refresh data</span>
            </button>
            <button 
              onClick={() => {
                setUser(null);
                localStorage.removeItem('little_nap_user');
              }} 
              className="hidden lg:flex h-10 px-4 rounded-xl items-center justify-center gap-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 font-bold transition-all border border-slate-200 hover:border-rose-100 shrink-0"
            >
                <LogOut size={15} />
                <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto">
        {view === 'dashboard' && (
          <Dashboard 
            opfData={opfData} 
            targets={targets} 
            user={user} 
            salespersons={salespersons} 
          />
        )}
        {view === 'submissions' && <MySubmissions data={mySubmissionsData} />}
        {view === 'stock' && user && <ReadyStock salespersonName={user.name} />}
        {view === 'links' && user && <QuickLinks />}
        {SHOW_CRM && view === 'crm' && user?.crmAdmin && <CrmApp onQuote={(l, reuse) => { setQuoteLead(l); setQuoteReuse(reuse || null); setView('quotation'); }}
          onSale={async (l, quote) => {
            let record: any = null;
            if (quote) { try { record = await fetchCrmQuote(quote.quoteNo); } catch { /* the sale form still fills from the lead */ } }
            setSaleLink({ lead: l, quote, record }); setView('sale');
          }} />}
        {view === 'quotation' && user && (
          <QuotationWizard salesperson={user} lead={quoteLead} reuse={quoteReuse} onLeadChange={l => { setQuoteLead(l); if (!l) setQuoteReuse(null); }} />
        )}
        
        {(view === 'sale' || view === 'noSale') && (
          <div className="">
            {view === 'sale' && validationData && <SaleForm key={saleLink?.lead?.enquiryNo || 'new'} salesperson={user} link={saleLink} validationData={validationData} opfData={opfData} codeMap={codeMap} onSubmit={submitReport} />}
            {view === 'noSale' && <NoSaleForm salesperson={user} onSubmit={submitReport} />}
          </div>
        )}
      </main>
    </div>
  );
}
