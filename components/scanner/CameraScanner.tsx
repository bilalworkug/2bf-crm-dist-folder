'use client';

// ─── Phase 10: Fast ZXing Camera Scanner ────────────────────────────────────
// Ported from 2bfwms-main/src/CameraScanner.tsx
//
// Architecture:
//   - @zxing/browser BrowserMultiFormatReader (multi-format: Code128, QR, etc.)
//   - requestAnimationFrame scan loop (not setInterval, not html5-qrcode)
//   - Canvas-based decoding with willReadFrequently: true
//   - Camera: environment (rear), 1280×720 ideal, playsInline, muted
//   - 2.5s same-barcode debounce, 1s any-scan debounce
//   - Camera stays OPEN continuously between scans
//   - Permission gate with localStorage persistence
//
// Props:
//   onDetected(barcode: string) — called when a barcode is confirmed
//   active: boolean             — mount/unmount the scanner
//   onClose: () => void         — called when user closes
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Camera, Zap, ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { playScanSuccess } from './audio';

export type ScanState =
  | 'idle'
  | 'starting'
  | 'active'
  | 'detected'
  | 'denied'
  | 'unavailable'
  | 'error';

interface CameraScannerProps {
  onDetected: (barcode: string) => void;
  active: boolean;
  onClose: () => void;
  /** Optional: called in addition to onDetected — useful for triggering workflow */
  onDetectedExtra?: (barcode: string) => void;
}

export function CameraScanner({ onDetected, active, onClose, onDetectedExtra }: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<any>(null);
  const lastCodeRef = useRef<string>('');
  const lastTimeRef = useRef<number>(0);
  const rafIdRef = useRef<number>(0);
  const cancelledRef = useRef(false);

  const [scanState, setScanState] = useState<ScanState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  // Restore previously-granted permission
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('erp_camera_allowed') === 'true') {
      setPermissionGranted(true);
    }
  }, []);

  const handleAllowCamera = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('erp_camera_allowed', 'true');
    }
    setPermissionGranted(true);
  };

  // ── Debounced detection handler ────────────────────────────────────────────
  const handleDetected = useCallback(
    (code: string) => {
      const now = Date.now();

      // Same barcode: ignore within 2500ms
      if (code === lastCodeRef.current && now - lastTimeRef.current < 2500) return;
      // Any barcode: minimum 1000ms gap
      if (now - lastTimeRef.current < 1000) return;

      lastCodeRef.current = code;
      lastTimeRef.current = now;

      // Flash + status
      setLastScanned(code);
      setFlash(true);
      setScanState('detected');
      setTimeout(() => {
        setFlash(false);
        setScanState('active');
      }, 400);

      // Audio
      playScanSuccess();

      // Haptic vibration feedback for mobile devices
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([60, 40, 60]);
        } catch {
          // Ignore if vibration permissions are restricted
        }
      }

      // Notify parent — business logic handled by page
      onDetected(code);
      onDetectedExtra?.(code);
    },
    [onDetected, onDetectedExtra]
  );

  // ── Camera + RAF scan loop ─────────────────────────────────────────────────
  useEffect(() => {
    if (!active || !permissionGranted) return;

    cancelledRef.current = false;
    setScanState('starting');
    setError(null);

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setScanState('unavailable');
          return;
        }

        // Prefer rear camera on mobile devices
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (cancelledRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        // Dynamic import avoids Next.js SSR issues
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        readerRef.current = new BrowserMultiFormatReader();

        setScanState('active');
        startScanLoop();
      } catch (e: any) {
        if (!cancelledRef.current) {
          if (e?.name === 'NotAllowedError') {
            setScanState('denied');
            setError('Camera permission denied. Please allow camera access in your browser settings.');
          } else if (e?.name === 'NotFoundError') {
            setScanState('unavailable');
            setError('No camera found on this device.');
          } else {
            setScanState('error');
            setError(e?.message || 'Camera access failed.');
          }
        }
      }
    };

    // ── requestAnimationFrame scan loop ─────────────────────────────────────
    const startScanLoop = () => {
      const tick = () => {
        if (cancelledRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const reader = readerRef.current;

        if (video && canvas && reader && video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          // willReadFrequently: true — critical performance flag
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            try {
              const result = reader.decodeFromCanvas(canvas);
              if (result?.getText()) {
                handleDetected(result.getText());
              }
            } catch {
              // No barcode this frame — normal, keep scanning
            }
          }
        }

        rafIdRef.current = requestAnimationFrame(tick);
      };

      rafIdRef.current = requestAnimationFrame(tick);
    };

    startCamera();

    return () => {
      cancelledRef.current = true;
      cancelAnimationFrame(rafIdRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      readerRef.current = null;
      setScanState('idle');
    };
  }, [active, permissionGranted, handleDetected]);

  // ── Render nothing if not active ───────────────────────────────────────────
  if (!active) return null;

  // ── Camera unavailable ─────────────────────────────────────────────────────
  if (scanState === 'unavailable') {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-6 text-center text-sm text-slate-600 dark:text-slate-400">
        <Camera size={32} className="mx-auto mb-2 text-slate-400" />
        <p className="font-semibold">No camera found on this device.</p>
        <p className="mt-1 text-xs text-slate-500">Use a USB/Bluetooth barcode scanner or manual entry.</p>
        <button
          onClick={onClose}
          className="mt-3 text-blue-600 dark:text-blue-400 underline text-sm"
        >
          Close
        </button>
      </div>
    );
  }

  // ── Permission gate ────────────────────────────────────────────────────────
  if (!permissionGranted) {
    return (
      <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-sm flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4 text-blue-600 dark:text-blue-400">
          <Camera size={28} />
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">
          Camera Permission Required
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-sm">
          We need access to your camera to scan barcodes and QR codes. Your camera is only used for scanning — never recorded or transmitted.
        </p>
        <div className="flex gap-3 w-full sm:w-auto">
          <button
            onClick={onClose}
            className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAllowCamera}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
          >
            <ShieldCheck size={16} /> Allow Camera
          </button>
        </div>
      </div>
    );
  }

  // ── Main scanner UI ────────────────────────────────────────────────────────
  return (
    <div className="relative rounded-2xl overflow-hidden bg-black shadow-2xl border border-slate-700">

      {/* Video feed */}
      <video
        ref={videoRef}
        className="w-full block"
        playsInline
        muted
        style={{ maxHeight: '360px', objectFit: 'cover' }}
      />

      {/* Hidden canvas for ZXing decoding */}
      <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

      {/* Green flash overlay on successful scan */}
      {flash && (
        <div
          className="absolute inset-0 bg-emerald-400/40 z-20 pointer-events-none transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* Targeting crosshair / scan guide */}
      <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
        <div className="relative w-64 h-40">
          {/* Corner brackets */}
          <div className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-emerald-400 rounded-tl-md" />
          <div className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-emerald-400 rounded-tr-md" />
          <div className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-emerald-400 rounded-bl-md" />
          <div className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-emerald-400 rounded-br-md" />
          {/* Animated scan line */}
          <div className="absolute left-2 right-2 top-1/2 h-0.5 bg-emerald-400/80 animate-pulse" />
        </div>
      </div>

      {/* Starting overlay */}
      {scanState === 'starting' && (
        <div className="absolute inset-0 z-30 bg-black/80 flex flex-col items-center justify-center gap-3">
          <Loader2 size={28} className="text-white animate-spin" />
          <p className="text-white text-sm font-medium">Starting camera…</p>
        </div>
      )}

      {/* Error overlay */}
      {(scanState === 'error' || scanState === 'denied') && error && (
        <div className="absolute inset-0 z-30 bg-black/90 flex flex-col items-center justify-center text-center p-6 gap-4">
          <AlertTriangle size={36} className="text-red-400" />
          <div>
            <p className="text-white font-semibold text-sm mb-1">
              {scanState === 'denied' ? 'Permission Denied' : 'Camera Error'}
            </p>
            <p className="text-slate-300 text-xs max-w-xs">{error}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl bg-white/10 hover:bg-white/20 px-5 py-2 text-sm text-white font-medium transition-colors"
          >
            Close
          </button>
        </div>
      )}

      {/* Status bar — bottom of scanner */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-black/75 backdrop-blur-sm px-4 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-white text-xs min-w-0">
          {scanState === 'detected' && lastScanned ? (
            <>
              <Zap size={12} className="text-emerald-400 shrink-0" />
              <span className="font-mono text-emerald-300 truncate max-w-[200px]">{lastScanned}</span>
            </>
          ) : scanState === 'active' ? (
            <>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-slate-300">
                {lastScanned ? `Last: ${lastScanned}` : 'Point camera at barcode…'}
              </span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shrink-0" />
              <span className="text-slate-400">Initialising…</span>
            </>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1 rounded-lg bg-white/10 hover:bg-white/20 px-3 py-1.5 text-xs text-white font-medium transition-colors shrink-0"
        >
          <X size={12} /> Stop
        </button>
      </div>
    </div>
  );
}
