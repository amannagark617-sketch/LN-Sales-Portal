import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { UPDATE_EVENT, applyUpdate, hasWaitingUpdate } from '../pwa';

let deferred: any = null;
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;

/** "Install app" button. Shows only when the phone can install the app and it is not installed yet. */
export function InstallButton({ compact = false }: { compact?: boolean }) {
  const [canPrompt, setCanPrompt] = useState(!!deferred);
  const [installed, setInstalled] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); deferred = e; setCanPrompt(true); };
    const onInstalled = () => { deferred = null; setCanPrompt(false); setInstalled(true); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  if (installed || isStandalone()) return null;
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
