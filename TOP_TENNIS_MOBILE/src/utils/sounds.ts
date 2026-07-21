import { Audio } from 'expo-av'

/**
 * Central sound-effects helper that respects the user's `sound_effects` setting.
 *
 * Mirrors utils/haptics: a module-level flag (kept in sync by useAppSettings) lets
 * any call site play a short tap without importing expo-av directly, and a single
 * switch silences everything. The sound is lazy-loaded on first use so nothing is
 * loaded at import time (and so tests without an asset transformer stay safe).
 */

let enabled = true
let loaded: Audio.Sound | null = null
let loading = false

export function setSoundEnabled(value: boolean): void {
  enabled = value
}

export function areSoundsEnabled(): boolean {
  return enabled
}

async function ensureLoaded(): Promise<void> {
  if (loaded || loading) return
  loading = true
  try {
    // Configure so effects still play when the ringer is on silent (iOS).
    await Audio.setAudioModeAsync?.({ playsInSilentModeIOS: true }).catch(() => {})
    const { sound } = await Audio.Sound.createAsync(
      require('@/assets/sounds/tap.wav'),
      { volume: 0.4 },
    )
    loaded = sound
  } catch {
    /* asset/codec unavailable — silently no-op */
  } finally {
    loading = false
  }
}

/** Short tap — key actions / primary buttons. No-op when sounds are off. */
export function playTap(): void {
  if (!enabled) return
  void (async () => {
    try {
      await ensureLoaded()
      await loaded?.replayAsync()
    } catch { /* ignore playback errors */ }
  })()
}

export const sounds = { playTap, setSoundEnabled, areSoundsEnabled }
