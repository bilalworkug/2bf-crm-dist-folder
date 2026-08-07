'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats, CameraDevice } from 'html5-qrcode';
import { Camera, X, RefreshCcw, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { playBeep } from '@/lib/audio';

interface CameraScannerProps {
  onScan: (decodedText: string) => void;
  isOpen: boolean;
  onClose: () => void;
  batchMode?: boolean;
}

export function CameraScanner({ onScan, isOpen, onClose, batchMode = false }: CameraScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef(false);
  const lastScannedRef = useRef<{ text: string; time: number } | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let isProcessingScan = false;

    if (!isOpen) {
      lastScannedRef.current = null;
      return;
    }

    const initScanner = async (retryCount = 0) => {
      if (isStartingRef.current || scannerRef.current) return;
      
      const scannerId = 'html5-qrcode-reader';
      if (!document.getElementById(scannerId)) return;

      isStartingRef.current = true;
      if (mounted) {
        setLoading(true);
        setError('');
      }

      try {
        // 1. Enumerate cameras
        const availableCameras = await Html5Qrcode.getCameras();
        if (mounted && availableCameras && availableCameras.length > 0) {
          setCameras(availableCameras);
        }

        const scanner = new Html5Qrcode(scannerId, { 
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13, 
            Html5QrcodeSupportedFormats.CODE_128, 
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.CODABAR,
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
            Html5QrcodeSupportedFormats.AZTEC,
            Html5QrcodeSupportedFormats.PDF_417,
          ] 
        });
        
        scannerRef.current = scanner;

        // Determine which camera to use
        let cameraConfig: string | MediaTrackConstraints = { facingMode: 'environment' };
        
        if (activeCameraId) {
          cameraConfig = activeCameraId;
        } else if (availableCameras && availableCameras.length > 0) {
          // If a back camera exists, prefer it, otherwise use the first one
          const backCamera = availableCameras.find(c => c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('environment'));
          if (backCamera) {
            cameraConfig = backCamera.id;
            if (mounted) setActiveCameraId(backCamera.id);
          } else {
            cameraConfig = availableCameras[0].id;
            if (mounted) setActiveCameraId(availableCameras[0].id);
          }
        }

        await scanner.start(
          cameraConfig,
          {
            fps: 15, // slightly higher FPS for faster detection
            qrbox: { width: 250, height: 100 },
            disableFlip: false,
          },
          (decodedText) => {
            if (isProcessingScan) return;
            
            const now = Date.now();
            const lastScan = lastScannedRef.current;
            
            // Ignore repeated detections of the SAME barcode for 2 seconds
            if (lastScan && lastScan.text === decodedText && now - lastScan.time < 2000) {
              return;
            }

            isProcessingScan = true;
            lastScannedRef.current = { text: decodedText, time: now };
            
            playBeep();
            
            // Vibrate on supported devices
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              navigator.vibrate(200);
            }

            onScan(decodedText);
            
            if (!batchMode) {
              // If not in batch mode, close the scanner immediately after one successful scan
              onClose();
            } else {
              // In batch mode, allow scanning another barcode after a short pause
              setTimeout(() => {
                if (mounted) isProcessingScan = false;
              }, 2000);
            }
          },
          (err) => {
            // Ignored as html5-qrcode calls this on every frame that doesn't have a barcode
          }
        );
        
        if (mounted) setLoading(false);
      } catch (err: any) {
        // If it fails, clean up the instance immediately so we can retry safely
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
            setError('Camera permission denied. Please allow camera access in your browser settings.');
          } else if (msg.includes('NotFoundError') || msg.includes('Requested device not found')) {
            setError('No camera found on this device.');
          } else if (retryCount === 0) {
            // Automatically retry once if initialization randomly fails (common race condition in Chrome)
            isStartingRef.current = false;
            setTimeout(() => initScanner(1), 500);
            return;
          } else {
            setError('Could not start camera: ' + msg);
          }
        }
      } finally {
        isStartingRef.current = false;
      }
    };

    // Small delay to ensure DOM is fully painted and bypass React strict-mode double mount issues
    const timer = setTimeout(() => {
      if (mounted) initScanner();
    }, 150);

    return () => {
      mounted = false;
      clearTimeout(timer);
      
      const scanner = scannerRef.current;
      if (scanner) {
        // We must stop the scanner asynchronously to release the MediaStream tracks
        if (scanner.isScanning) {
          scanner.stop().then(() => {
            scanner.clear();
          }).catch((err) => {
            console.error('Error stopping scanner:', err);
          });
        } else {
          scanner.clear();
        }
        scannerRef.current = null;
      }
    };
  }, [isOpen, onScan, activeCameraId]);

  const switchCamera = () => {
    if (cameras.length < 2) return;
    const currentIndex = cameras.findIndex(c => c.id === activeCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    
    // Changing activeCameraId will trigger the useEffect cleanup and restart
    setActiveCameraId(cameras[nextIndex].id);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full h-full sm:h-[80vh] sm:max-h-[800px] sm:max-w-md overflow-hidden sm:rounded-2xl bg-black shadow-2xl flex flex-col">
        
        {/* Full-bleed Camera Container */}
        <div className="absolute inset-0 z-0 flex items-center justify-center bg-black overflow-hidden [&_video]:!object-cover [&_video]:!w-full [&_video]:!h-full [&_#qr-shaded-region]:!border-white/40">
          <div id="html5-qrcode-reader" className="w-full h-full border-none !bg-black"></div>
        </div>

        {/* Floating Header */}
        <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent text-white">
          <div className="flex items-center gap-2 font-semibold drop-shadow-md">
            <Camera className="h-5 w-5" /> Scan Barcode
          </div>
          <div className="flex items-center gap-2">
            {cameras.length > 1 && (
              <Button variant="secondary" size="sm" onClick={switchCamera} title="Switch Camera" className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-md">
                <RefreshCcw className="h-4 w-4 mr-2" /> Switch
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md">
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20 text-white gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
            <p className="font-medium text-sm drop-shadow-md">Starting camera...</p>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 p-6 text-center text-red-400 z-20 gap-3">
            <AlertTriangle className="h-10 w-10 text-red-500" />
            <p className="font-medium text-sm drop-shadow-md">{error}</p>
            <Button variant="outline" size="sm" onClick={() => { setActiveCameraId(null); setError(''); }} className="mt-4 border-white/20 text-white hover:bg-white/10">
              Retry Connection
            </Button>
          </div>
        )}
        
        {/* Floating Footer */}
        <div className="absolute bottom-0 inset-x-0 z-10 p-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent text-center text-sm font-medium text-white/90 drop-shadow-md pointer-events-none">
          Point your camera at a barcode.
          <br />
          <span className="text-white/60 text-xs">It will scan automatically.</span>
        </div>
      </div>
    </div>
  );
}

