'use client';

// ─── Phase 10: ZXing Scanner Audio ───────────────────────────────────────────
// Ported from 2bfwms-main/src/audio.ts
// Three distinct sounds + speech synthesis for scan feedback.
// No external audio files required — all synthesized via Web Audio API.
// ─────────────────────────────────────────────────────────────────────────────

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Success: clear rising chirp (sine, 880 → 1760 Hz) */
export function playScanSuccess() {
  try {
    const audioCtx = getAudioContext();
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.1);

    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
  } catch {
    // ignore audio errors
  }

  try {
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance('Scanned');
    msg.rate = 1.2;
    window.speechSynthesis.speak(msg);
  } catch {
    // ignore
  }
}

/** Duplicate: descending sawtooth warning (300 → 150 Hz) */
export function playScanAlreadyExists() {
  try {
    const audioCtx = getAudioContext();
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.2);

    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  } catch {
    // ignore
  }

  try {
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance('Already scanned');
    msg.rate = 1.2;
    window.speechSynthesis.speak(msg);
  } catch {
    // ignore
  }
}

/** Error: low square wave (150 Hz) */
export function playScanError() {
  try {
    const audioCtx = getAudioContext();
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);

    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  } catch {
    // ignore
  }

  try {
    window.speechSynthesis.cancel();
    const msg = new SpeechSynthesisUtterance('Error');
    msg.rate = 1.2;
    window.speechSynthesis.speak(msg);
  } catch {
    // ignore
  }
}

/** Backwards-compatible alias for existing pages that call playBeep() */
export { playScanSuccess as playBeep };
