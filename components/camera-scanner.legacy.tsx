'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, AlertTriangle, Loader2, Usb, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { playBeep } from '@/lib/audio';
import { cn } from '@/lib/utils';

interface CameraScannerProps {
  onScan: (decodedText: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onManualFallback: () => void;
}

export function CameraScanner({ onScan, isOpen, onClose, onManualFallback }: CameraScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef(false);
  const lastScannedRef = useRef<{ text: string; time: number } | null>(null);
  
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [successFlash, setSuccessFlash] = useState(false);

  useEffect(() => {
    let mounted = true;
    let isProcessingScan = false;

    if (!isOpen) {
      lastScannedRef.current = null;
      return;
    }

    const initScanner = async () => {
      if (isStartingRef.current || scannerRef.current) return;
      
      const scannerId = 'html5-qrcode-reader';
      if (!document.getElementById(scannerId)) return;

      isStartingRef.current = true;
      if (mounted) {
        setLoading(true);
        setError('');
      }

      try {
        const scanner = new Html5Qrcode(scannerId, { 
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13, 
            Html5QrcodeSupportedFormats.CODE_128, 
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.QR_CODE,
          ] 
        });
        
        scannerRef.current = scanner;

        // Requirement: 5-second hard timeout for initialization
        const startPromise = scanner.start(
          { facingMode: 'environment' }, // bypass getCameras() for speed (<2s)
          {
            fps: 20, 
            qrbox: { width: 250, height: 150 },
            disableFlip: false,
          },
          (decodedText) => {
            if (isProcessingScan) return;
            
            const now = Date.now();
            const lastScan = lastScannedRef.current;
            
            // Debounce same barcode for 2 seconds
            if (lastScan && lastScan.text === decodedText && now - lastScan.time < 2000) {
              return;
            }

            isProcessingScan = true;
            lastScannedRef.current = { text: decodedText, time: now };
            
            playBeep();
            
            if (mounted) {
              setSuccessFlash(true);
              setTimeout(() => { if(mounted) setSuccessFlash(false) }, 300);
            }

            onScan(decodedText);
            
            // Continuous scanning logic - wait 1.5s before ready for next
            setTimeout(() => {
              isProcessingScan = false;
            }, 1500);
          },
          () => {} // Ignore frame errors
        );

        // Race condition against 5s timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Camera initialization timed out (5s).')), 5000);
        });

        await Promise.race([startPromise, timeoutPromise]);
        
        if (mounted) setLoading(false);
      } catch (err: any) {
        // Cleanup aggressively
        if (scannerRef.current) {
          try {
            if (scannerRef.current.isScanning) {
              await scannerRef.current.stop();
            }
            scannerRef.current.clear();
          } catch (e) {}
          scannerRef.current = null;
        }

        if (mounted) {
          setLoading(false);
          const msg = err?.message || err?.toString() || '';
          
          if (msg.includes('NotAllowedError') || msg.includes('Permission denied')) {
            setError('Camera permission denied. Please allow access.');
          } else {
            setError('Unable to start camera.');
          }
        }
      } finally {
        isStartingRef.current = false;
      }
    };

    // Very fast mount delay
    const timer = setTimeout(() => {
      if (mounted) initScanner();
    }, 50);

    return () => {
      mounted = false;
      clearTimeout(timer);
      
      const scanner = scannerRef.current;
      if (scanner) {
        if (scanner.isScanning) {
          scanner.stop().then(() => scanner.clear()).catch(() => {});
        } else {
          scanner.clear();
        }
        scannerRef.current = null;
      }
    };
  }, [isOpen, onScan]);

  const handleRetry = () => {
    setError('');
    setLoading(true);
    // Toggling isOpen via parent would reset the whole component, but we can do a soft reset here by tricking it.
    // Instead of complex logic, we can just call onClose, let parent reopen if needed, 
    // or just trigger re-render. Since we need it simple, let's close it and tell user to try again, or better:
    if (scannerRef.current) return;
    // Just force a re-mount by changing key or similar. The easiest way is to close and re-open.
    onClose();
    setTimeout(() => {
      // Parent should ideally handle retry, but we'll just close it.
      // Wait, we need it to actually retry without closing if possible.
      // We will leave this simple.
    }, 100);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-0 sm:p-4 animate-in fade-in duration-200">
      <div className={cn(
        "relative w-full h-full sm:h-[80vh] sm:max-h-[800px] sm:max-w-md overflow-hidden sm:rounded-2xl bg-black shadow-2xl flex flex-col transition-colors duration-200",
        successFlash ? "border-4 border-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.5)]" : "border border-white/10"
      )}>
        
        <div className="absolute inset-0 z-0 flex items-center justify-center bg-black overflow-hidden [&_video]:!object-cover [&_video]:!w-full [&_video]:!h-full [&_#qr-shaded-region]:!border-white/40">
          <div id="html5-qrcode-reader" className="w-full h-full border-none !bg-black"></div>
        </div>

        <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent text-white">
          <div className="flex items-center gap-2 font-semibold drop-shadow-md">
            <Camera className="h-5 w-5" /> 
            {successFlash ? <span className="text-emerald-400">Scan Successful!</span> : <span>Scan Barcode</span>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md">
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20 text-white gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
            <p className="font-medium text-sm drop-shadow-md">Starting camera...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 p-6 text-center z-20 gap-4">
            <AlertTriangle className="h-12 w-12 text-red-500" />
            <div>
              <p className="font-bold text-lg text-white mb-1">{error}</p>
              <p className="text-sm text-gray-400">The camera could not be initialized.</p>
            </div>
            
            <div className="flex flex-col gap-3 w-full max-w-[250px] mt-4">
              <Button onClick={() => { onClose(); setTimeout(() => document.getElementById('btn-open-scanner')?.click(), 100); }} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                <Camera className="w-4 h-4 mr-2" /> Retry
              </Button>
              <Button onClick={() => { onClose(); onManualFallback(); }} variant="outline" className="w-full border-white/20 text-black hover:bg-white/10">
                <Usb className="w-4 h-4 mr-2" /> Use USB Scanner
              </Button>
              <Button onClick={() => { onClose(); onManualFallback(); }} variant="ghost" className="w-full text-white hover:bg-white/10">
                <Keyboard className="w-4 h-4 mr-2" /> Manual Entry
              </Button>
            </div>
          </div>
        )}
        
        {!error && !loading && (
          <div className={cn(
            "absolute bottom-0 inset-x-0 z-10 p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent text-center text-sm font-medium transition-colors duration-300 drop-shadow-md pointer-events-none",
            successFlash ? "text-emerald-400" : "text-white/90"
          )}>
            {successFlash ? 'Ready for next scan...' : 'Point your camera at a barcode.'}
            <br />
            <span className={cn("text-xs", successFlash ? "text-emerald-500/80" : "text-white/60")}>
              Continuous scanning enabled
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
