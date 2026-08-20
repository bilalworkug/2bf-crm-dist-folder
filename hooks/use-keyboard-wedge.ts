'use client';

import { useEffect, useRef } from 'react';

interface UseKeyboardWedgeProps {
  onScan: (barcode: string) => void;
  minCharacters?: number;
  maxTimeMs?: number;
  targetInputId?: string;
}

export function useKeyboardWedge({ onScan, minCharacters = 5, maxTimeMs = 50, targetInputId }: UseKeyboardWedgeProps) {
  const buffer = useRef('');
  const lastKeyTime = useRef(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputFocused = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
      const isTargetFocused = targetInputId && activeElement?.id === targetInputId;

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime.current;
      lastKeyTime.current = currentTime;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      if (e.key === 'Enter') {
        if (buffer.current.length >= minCharacters && timeDiff <= maxTimeMs) {
          if (!isInputFocused || isTargetFocused) {
            e.preventDefault();
            onScan(buffer.current);
          }
        }
        buffer.current = '';
        return;
      }

      // If it took too long between keystrokes, it's a human typing. Reset buffer.
      if (timeDiff > maxTimeMs && buffer.current.length > 0) {
        buffer.current = '';
      }

      // Only allow printable characters
      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        buffer.current += e.key;
        
        // Setup timeout for non-Enter scanners
        if (buffer.current.length >= minCharacters) {
          timeoutRef.current = setTimeout(() => {
            if ((!isInputFocused || isTargetFocused) && buffer.current.length >= minCharacters) {
              onScan(buffer.current);
              buffer.current = '';
            }
          }, 150);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
  }, [onScan, minCharacters, maxTimeMs, targetInputId]);
}
