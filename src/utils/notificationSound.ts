/**
 * Notification sound — Web Audio API chime
 *
 * Browsers block audio until the user interacts with the page (autoplay policy).
 * This module solves that by:
 *   1. Listening for the first user gesture (click/keydown/touchstart) and
 *      immediately resuming the AudioContext so future plays work.
 *   2. Calling ctx.resume() right before every play() call as a second safety net.
 *   3. Using only the Web Audio API — no MP3 file dependency.
 *
 * Two exported sounds:
 *   playNotificationSound() — two-tone chime for notifications
 *   playMessageSound()      — single soft tone for incoming messages
 */

let ctx: AudioContext | null = null;
let unlocked = false;

// ── AudioContext — created lazily ─────────────────────────────────────────────
function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return ctx;
}

// ── Unlock on first user gesture ──────────────────────────────────────────────
// Browsers suspend AudioContext until the user interacts. We listen for any
// gesture and resume the context so subsequent sounds play instantly.
function handleUnlock() {
  if (unlocked) return;
  const c = getCtx();
  if (c && c.state === 'suspended') {
    c.resume().catch(() => {});
  }
  unlocked = true;
}

if (typeof document !== 'undefined') {
  const opts: AddEventListenerOptions = { passive: true };
  document.addEventListener('click',      handleUnlock, opts);
  document.addEventListener('keydown',    handleUnlock, opts);
  document.addEventListener('touchstart', handleUnlock, opts);
  document.addEventListener('pointerdown', handleUnlock, opts);
}

// ── Internal: ensure context is running before scheduling audio ───────────────
async function ensureRunning(): Promise<AudioContext | null> {
  const c = getCtx();
  if (!c) return null;
  if (c.state === 'suspended') {
    try { await c.resume(); } catch { return null; }
  }
  return c.state === 'running' ? c : null;
}

// ── Two-tone notification chime ───────────────────────────────────────────────
// A5 (880 Hz) followed 120 ms later by C#6 (1108 Hz).
// Both fade out smoothly over ~450 ms.
function scheduleChime(c: AudioContext, volume: number) {
  const now = c.currentTime;

  [
    { freq: 880,  delay: 0 },
    { freq: 1108, delay: 0.12 },
  ].forEach(({ freq, delay }) => {
    const start = now + delay;
    const osc   = c.createOscillator();
    const gain  = c.createGain();

    osc.connect(gain);
    gain.connect(c.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume * 0.35, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);

    osc.start(start);
    osc.stop(start + 0.46);
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Play the two-tone notification chime.
 * Safe to call at any time — silently no-ops if audio is unavailable.
 */
export const playNotificationSound = async (volume: number = 0.5): Promise<void> => {
  try {
    const c = await ensureRunning();
    if (!c) return;
    scheduleChime(c, Math.max(0, Math.min(1, volume)));
  } catch {
    // Never throw — sound is non-critical
  }
};

/**
 * Play a single soft tone for incoming chat messages.
 * Shorter and quieter than the notification chime.
 */
export const playMessageSound = async (volume: number = 0.35): Promise<void> => {
  try {
    const c = await ensureRunning();
    if (!c) return;

    const now  = c.currentTime;
    const osc  = c.createOscillator();
    const gain = c.createGain();

    osc.connect(gain);
    gain.connect(c.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046, now); // C6

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume * 0.3, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

    osc.start(now);
    osc.stop(now + 0.31);
  } catch {
    // Degrade silently
  }
};

export const isAudioSupported = (): boolean =>
  typeof window !== 'undefined' &&
  (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined');
