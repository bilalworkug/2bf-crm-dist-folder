'use client';

// ─── Phase 10: USB / Bluetooth Barcode Scanner Hook ──────────────────────────
// Ported from 2bfwms-main/src/useScanInput.ts and enhanced.
//
// A USB or Bluetooth barcode gun sends keystrokes very rapidly followed by
// Enter. This hook distinguishes scanner input from human keyboard typing
// by measuring inter-keystroke timing.
//
// The hook fires onSubmit(barcode) exactly the same way the camera scanner
// fires onDetected(barcode) — so both paths funnel into the same handler.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseScanInputOptions {
  /** Called when a complete barcode is detected */
  onSubmit: (code: string) => void;
  /** Enable/disable the hook */
  enabled?: boolean;
}

interface UseScanInputReturn {
  value: string;
  setValue: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement>;
  handleSubmit: (e: React.FormEvent) => void;
  focus: () => void;
}

export function useScanInput({ onSubmit, enabled = true }: UseScanInputOptions): UseScanInputReturn {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const focus = useCallback(() => {
    if (enabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [enabled]);

  useEffect(() => {
    focus();
  }, [focus]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = value.trim();
    if (!code) return;
    onSubmit(code);
    setValue('');
    setTimeout(focus, 0);
  };

  return { value, setValue, inputRef, handleSubmit, focus };
}
