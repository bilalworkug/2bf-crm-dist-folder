'use client';

// ─── Phase 10: Legacy Compatibility Shim ──────────────────────────────────────
//
// The original html5-qrcode based scanner has been replaced by the fast
// ZXing/RAF scanner (components/scanner/CameraScanner.tsx).
//
// This shim re-exports the new scanner using the OLD interface so that
// any page that previously imported from this path continues to work
// without modification during the transition period.
//
// OLD interface:  onScan / isOpen / onClose / onManualFallback
// NEW interface:  onDetected / active / onClose
//
// TO REVERT: delete this file and restore components/camera-scanner.legacy.tsx
// ─────────────────────────────────────────────────────────────────────────────

import { CameraScanner as NewCameraScanner } from './scanner/CameraScanner';

interface LegacyCameraScannerProps {
  onScan: (decodedText: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onManualFallback?: () => void;
}

/**
 * Legacy-compatible wrapper around the new ZXing scanner.
 * Maps: isOpen→active, onScan→onDetected.
 * onManualFallback is accepted but no longer triggers an error overlay — 
 * the new scanner's close button handles fallback intent.
 */
export function CameraScanner({ onScan, isOpen, onClose, onManualFallback: _ }: LegacyCameraScannerProps) {
  return (
    <NewCameraScanner
      active={isOpen}
      onDetected={onScan}
      onClose={onClose}
    />
  );
}
