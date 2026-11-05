import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { UPDATE_EVENT, applyUpdate, hasWaitingUpdate } from '../pwa';

let deferred: any = null;
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
const isMobile = () => /android|iphone|ipad|ipod/i.test(navigator.userAgent);

// Once the app is installed on this device, the install prompt never shows again.
const INSTALLED_KEY = 'ln_app_installed';
const wasInstalled = () => { try { return localStorage.getItem(INSTALLED_KEY) === '1'; } catch { return false; } };
const markInstalled = () => { try { localStorage.setItem(INSTALLED_KEY, '1'); } catch { /* ignore */ } };
const CAN_INSTALL = 'ln-can-install';
const INSTALLED = 'ln-installed';

// The browser offers installation early, often before login, so it is caught here at start-up and kept.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => { e.preventDefault(); deferred = e; window.dispatchEvent(new Event(CAN_INSTALL)); });
  window.addEventListener('appinstalled', () => { deferred = null; markInstalled(); window.dispatchEvent(new Event(INSTALLED)); });
  if (isStandalone()) markInstalled(); // opened from the installed app
}

/** "Install app" button. Shows only when the phone can install the app and it is not installed yet. */
export function InstallButton({ compact = false }: { compact?: boolean }) {
  const [canPrompt, setCanPrompt] = useState(!!deferred);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const onPrompt = () => setCanPrompt(true);
    const onInstalled = () => { setCanPrompt(false); setInstalled(true); };
    window.addEventListener(CAN_INSTALL, onPrompt);
    window.addEventListener(INSTALLED, onInstalled);
    return () => { window.removeEventListener(CAN_INSTALL, onPrompt); window.removeEventListener(INSTALLED, onInstalled); };
  }, []);

  if (installed || isStandalone() || wasInstalled()) return null;
  const ios = isIOS();
  if (!canPrompt && !ios) return null;

  const click = async () => {
    if (deferred) {
      deferred.prompt();
      try { await deferred.userChoice; } catch { /* ignore */ }
      deferred = null; setCanPrompt(false);
    } else setHelp(true);
  };

  return (
    <>
      <button onClick={click} aria-label="Install app"
        className={`h-9 lg:h-10 ${compact ? 'w-9 lg:w-auto lg:px-4' : 'px-4'} rounded-xl flex items-center justify-center gap-2 bg-slate-900 text-white text-[11px] lg:text-sm font-bold shrink-0 hover:bg-slate-800`}>
        <Download size={15} />
        <span className={compact ? 'hidden lg:inline' : ''}>Install app</span>
      </button>
      {help && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/50 p-4" onClick={() => setHelp(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start">
              <div className="text-lg font-bold text-slate-900">Install on your iPhone</div>
              <button aria-label="Close" onClick={() => setHelp(false)} className="text-slate-500"><X size={20} /></button>
            </div>
            <ol className="mt-4 space-y-3 text-sm text-slate-700 list-decimal pl-5">
              <li>Open this page in <b>Safari</b>.</li>
              <li>Tap the <b>Share</b> button at the bottom of the screen.</li>
              <li>Scroll down and tap <b>Add to Home Screen</b>, then tap <b>Add</b>.</li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}

/** Appears at the top when a newer version of the app has been published. */
export function UpdateBanner() {
  const [show, setShow] = useState(hasWaitingUpdate());
  useEffect(() => {
    const on = () => setShow(true);
    window.addEventListener(UPDATE_EVENT, on);
    return () => window.removeEventListener(UPDATE_EVENT, on);
  }, []);
  if (!show) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-[90] bg-slate-900 text-white px-4 py-3 flex items-center justify-between gap-3 text-sm" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
      <span>A new version of the app is ready.</span>
      <button onClick={applyUpdate} className="h-9 px-4 rounded-lg bg-white text-slate-900 font-bold shrink-0">Update now</button>
    </div>
  );
}

/**
 * A pop-up that asks the person to install the app, with the steps for their phone.
 * It comes back every time the app is opened until it is installed, and never again after that.
 * "Not now" hides it for the rest of that visit.
 */
export function InstallPrompt() {
  const SNOOZE_KEY = 'ln_install_snoozed';
  const [open, setOpen] = useState(false);
  const [, bump] = useState(0);

  useEffect(() => {
    if (isStandalone() || wasInstalled()) return;
    try { if (sessionStorage.getItem(SNOOZE_KEY) === '1') return; } catch { /* ignore */ }
    const onInstalled = () => setOpen(false);
    const onCan = () => bump(n => n + 1);
    window.addEventListener(INSTALLED, onInstalled);
    window.addEventListener(CAN_INSTALL, onCan);
    // a short pause so the browser has time to offer installation first
    const t = setTimeout(() => { if (!wasInstalled() && (deferred || isMobile())) setOpen(true); }, 2500);
    return () => { clearTimeout(t); window.removeEventListener(INSTALLED, onInstalled); window.removeEventListener(CAN_INSTALL, onCan); };
  }, []);

  if (!open) return null;
  const ios = isIOS();
  const close = () => { try { sessionStorage.setItem(SNOOZE_KEY, '1'); } catch { /* ignore */ } setOpen(false); };
  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    let accepted = false;
    try { accepted = (await deferred.userChoice)?.outcome === 'accepted'; } catch { /* ignore */ }
    deferred = null;
    if (accepted) { markInstalled(); setOpen(false); } else bump(n => n + 1);
  };
  const done = () => { markInstalled(); setOpen(false); };

  return (
    <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label="Install the app">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
        <div className="flex items-start gap-4">
          <img src="/icons/icon-192.png" alt="" className="w-14 h-14 rounded-xl border border-slate-200 shrink-0" />
          <div className="min-w-0">
            <div className="text-lg font-bold text-slate-900 leading-tight">Install the Little Nap Sales app</div>
            <p className="mt-1 text-sm text-slate-600">Open it from your home screen like any other app. Updates arrive on their own.</p>
          </div>
        </div>

        {deferred ? (
          <button onClick={install} className="mt-5 w-full h-12 rounded-xl bg-slate-900 text-white font-bold flex items-center justify-center gap-2 hover:bg-slate-800">
            <Download size={18} /> Install now
          </button>
        ) : (
          <div className="mt-5">
            <div className="text-sm font-bold text-slate-900">{ios ? 'How to install on your iPhone' : 'How to install on your phone'}</div>
            <ol className="mt-2 space-y-2 text-sm text-slate-700 list-decimal pl-5">
              {ios ? (
                <>
                  <li>Open this page in <b>Safari</b>.</li>
                  <li>Tap the <b>Share</b> button at the bottom of the screen.</li>
                  <li>Scroll down and tap <b>Add to Home Screen</b>, then tap <b>Add</b>.</li>
                </>
              ) : (
                <>
                  <li>Tap the <b>menu</b> (three dots) at the top right of your browser.</li>
                  <li>Tap <b>Install app</b> or <b>Add to Home screen</b>.</li>
                  <li>Tap <b>Install</b> to confirm.</li>
                </>
              )}
            </ol>
            <button onClick={done} className="mt-4 w-full h-11 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800">I have added it</button>
          </div>
        )}
        <button onClick={close} className="mt-2 w-full h-11 rounded-xl text-slate-600 font-semibold hover:bg-slate-50">Not now</button>
      </div>
    </div>
  );
}
