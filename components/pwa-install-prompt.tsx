'use client';

import { useState, useEffect } from 'react';
import { Download, X, Smartphone, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check if already running in standalone mode (installed app)
    const checkStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(checkStandalone);

    if (checkStandalone) return;

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Register Service Worker safely
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('Service Worker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('Service Worker registration skipped or failed:', err);
        });
    }

    // Android / Chrome PWA install trigger
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Check if user previously dismissed
      const dismissed = localStorage.getItem('2bf_pwa_dismissed');
      if (!dismissed) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('2bf_pwa_dismissed', 'true');
  };

  if (isStandalone || !showPrompt) return null;

  return (
    <aside aria-label="Install 2BF ERP App" className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 bg-slate-900 text-white rounded-xl shadow-2xl border border-sky-500/30 p-4 animate-in slide-in-from-bottom-5">
      <div className="flex items-start justify-between gap-3">
        <div className="p-2 bg-sky-600 rounded-lg text-white">
          <Smartphone className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-slate-100">Install 2BF ERP App</h4>
          <p className="text-xs text-slate-300 mt-0.5">
            {isIOS
              ? "Tap the share button then 'Add to Home Screen' for fast offline scanning."
              : 'Install on your device for full-screen scanner & offline reliability.'}
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-slate-400 hover:text-white p-1 transition-colors"
          aria-label="Dismiss install prompt"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={handleDismiss} className="text-xs text-slate-400 hover:text-white">
          Not now
        </Button>
        {deferredPrompt && (
          <Button size="sm" onClick={handleInstallClick} className="bg-sky-600 hover:bg-sky-500 text-xs font-medium">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Install App
          </Button>
        )}
      </div>
    </aside>
  );
}
