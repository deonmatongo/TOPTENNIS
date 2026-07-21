import * as Haptics from 'expo-haptics'

/**
 * Central haptics helper that respects the user's `haptics_enabled` setting.
 *
 * Call sites (buttons, tab bar, settings toggles) use these helpers instead of
 * importing expo-haptics directly, so a single flag can silence all feedback.
 * The flag is kept in a module-level variable (not React state) so non-component
 * code can read it synchronously; `useAppSettings` keeps it in sync.
 */

let enabled = true

export function setHapticsEnabled(value: boolean): void {
  enabled = value
}

export function areHapticsEnabled(): boolean {
  return enabled
}

/** Light tap — button presses. */
export function impact(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light): void {
  if (!enabled) return
  Haptics.impactAsync(style).catch(() => {})
}

/** Selection tick — toggles, chips, tab changes. */
export function selection(): void {
  if (!enabled) return
  Haptics.selectionAsync().catch(() => {})
}

/** Success / warning / error notification patterns. */
export function notify(type: Haptics.NotificationFeedbackType = Haptics.NotificationFeedbackType.Success): void {
  if (!enabled) return
  Haptics.notificationAsync(type).catch(() => {})
}

export const haptics = { impact, selection, notify, setHapticsEnabled, areHapticsEnabled }
export { Haptics }
