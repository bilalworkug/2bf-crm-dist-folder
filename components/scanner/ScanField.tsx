'use client';

// ─── Phase 10: Unified Scan Input ────────────────────────────────────────────
// Combines camera scanning and USB/Bluetooth keyboard-wedge input.
// Both paths call the same onSubmit(barcode) handler.
//
// The component does NOT contain any business logic — it is a pure
// input mechanism. The parent page decides what to do with the barcode.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback, useEffect } from 'react';
import { ScanLine, Camera, X } from 'lucide-react';
import { CameraScanner } from './CameraScanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useKeyboardWedge } from '@/hooks/use-keyboard-wedge';

interface ScanFieldProps {
  /** Called with the barcode string when a scan is accepted (camera or USB) */
  onSubmit: (barcode: string) => void;
  /** Input placeholder text */
  placeholder?: string;
  /** Auto-focus the text input on mount */
  autoFocus?: boolean;
  /** Show the camera toggle button (default true) */
  showCamera?: boolean;
  /** Disable the entire field */
  disabled?: boolean;
  /** Label shown above the input */
  label?: string;
  /** Additional class applied to the wrapper */
  className?: string;
}

export function ScanField({
  onSubmit,
  placeholder = 'Scan barcode or type manually…',
  autoFocus = true,
  showCamera = true,
  disabled = false,
  label,
  className,
}: ScanFieldProps) {
  const [value, setValue] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const lastChangeTime = useRef<number>(0);
  const typingSpeedRef = useRef<number[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const focus = useCallback(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled]);

  useEffect(() => {
    if (autoFocus) focus();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [autoFocus, focus]);

  // Global wedge listener for when the input is NOT focused, or when this specific input IS focused
  useKeyboardWedge({
    onScan: (code) => {
      if (disabled) return;
      setValue('');
      onSubmit(code);
      setTimeout(focus, 0);
    },
    minCharacters: 5,
    targetInputId: 'scan-field-input'
  });

  // Handle text input submit (manual / USB scanner via input field)
  const handleSubmit = (e?: React.FormEvent, forceValue?: string) => {
    if (e) e.preventDefault();
    const code = (forceValue ?? value).trim();
    if (!code || disabled) return;
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    typingSpeedRef.current = [];
    lastChangeTime.current = 0;
    
    onSubmit(code);
    setValue('');
    setTimeout(focus, 0);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only update the value. The useKeyboardWedge hook handles USB scanner timing.
    setValue(e.target.value);
  };

  // Handle camera detected barcode
  const handleCameraDetected = (code: string) => {
    onSubmit(code);
    // Refocus text input for next USB scan after camera detects
    setTimeout(focus, 100);
    // Camera stays open — continuous scanning
  };

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          {label}
        </label>
      )}

      {/* Text input + submit + camera toggle */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" size={18} />
          <Input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="off"
            spellCheck={false}
            className="pl-9 font-mono h-11 sm:h-10 text-base sm:text-sm"
            id="scan-field-input"
          />
        </div>

        <Button
          type="submit"
          disabled={disabled || !value.trim()}
          variant="default"
          className="shrink-0 h-11 sm:h-10 px-4 text-xs font-semibold touch-target touch-press"
        >
          Enter
        </Button>

        {showCamera && (
          cameraActive ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setCameraActive(false)}
              className="shrink-0 text-slate-500 h-11 w-11 sm:h-10 sm:w-10 p-0 touch-target touch-press"
              title="Close camera"
            >
              <X size={18} />
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setCameraActive(true)}
              disabled={disabled}
              className="shrink-0 h-11 w-11 sm:h-10 sm:w-10 p-0 touch-target touch-press"
              title="Open camera scanner"
              id="scan-field-camera-btn"
            >
              <Camera size={18} />
            </Button>
          )
        )}
      </form>

      {/* Camera scanner — rendered inline below the input */}
      {showCamera && cameraActive && (
        <div className="mt-3">
          <CameraScanner
            active={cameraActive}
            onDetected={handleCameraDetected}
            onClose={() => setCameraActive(false)}
          />
        </div>
      )}
    </div>
  );
}
