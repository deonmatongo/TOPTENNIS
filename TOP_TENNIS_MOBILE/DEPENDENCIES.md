# Dependencies

Every package the UI migration adds, what it does, and what we would hand-roll
if we dropped it. Install with `npx expo install`, never bare `npm install` —
versions must resolve against the Expo SDK.

## Added by the migration

| Package | Version | What it does | If we dropped it |
|---|---|---|---|
| `expo-symbols` | `~1.0.8` | SF Symbols via `SymbolView`. Replaces all 403 Ionicon call sites (Spec §5). | Ship a bundled icon font or SVG set, and hand-maintain ~40 glyphs across weights and sizes. |

**`expo-symbols` caveat — it is iOS/tvOS only in SDK 54.** Android support
(via Material Symbols) landed in a later SDK. Everything must therefore go
through a single `<Icon>` wrapper with an Ionicons fallback on Android, so the
call sites never learn which backend rendered them. The package is also flagged
beta and subject to breaking changes.

## Removed by the migration

| Package | Why |
|---|---|
| `tamagui`, `@tamagui/config`, `@tamagui/native`, `@tamagui/animations-react-native`, `@tamagui/babel-plugin` | Release candidate, half adopted: 6 importers, 4 of which were dead components. Replaced by React Native primitives plus the transitional `components/ui/Stack.tsx` shim. Bundle dropped 2908 → 2444 modules. |

## Already present — do not reinstall

These cover most of the migration's needs and were installed before it began.

`react-native-safe-area-context` · `react-native-screens` ·
`react-native-gesture-handler` · `react-native-reanimated` (+
`react-native-worklets`) · `@react-navigation/native`, `native-stack`,
`bottom-tabs`, `stack` · `libphonenumber-js` · `expo-haptics` ·
`expo-calendar` · `expo-image-picker` · `expo-image` · `expo-font` ·
`sonner-native` (covers Spec §6 Toast) · `react-native-svg` ·
`@expo/vector-icons` (Ionicons — retained as the Android icon fallback)

> `react-native-gesture-handler` is installed but `GestureHandlerRootView` is
> **not mounted**. Bottom sheets and swipe actions will fail silently until it
> wraps the app root. Phase 1 fixes this.

## Planned, not yet installed

Installed at the start of the phase that needs them, one package per commit.

| Phase | Package | Purpose |
|---|---|---|
| 1 | `expo-glass-effect` | `GlassView`, iOS 26+. See the gate below. |
| 1 | `expo-blur` | `BlurView` fallback below iOS 26 — the tier most users will actually see. |
| 3 | `@react-native-segmented-control/segmented-control` | Replaces 6 hand-rolled tab strips. |
| 4 | `@gorhom/bottom-sheet` | Detents and grabbers for the short sheets. |
| 4 | `@react-native-menu/menu` | Native long-press menu in the Messages thread. |
| 5 | `@shopify/flash-list` | Virtualises leaderboards, match history, notifications, messages. |
| 5 | `expo-clipboard` | Copy action in the message context menu. |

**Not planned:** `expo-router` (React Navigation v6 is present and working —
swapping routers is a rewrite, not a migration). `react-hook-form` + `zod`
(forms are hand-managed but well-factored; adopting them is a logic refactor,
which the Prime Directive rules out). Any Material/Paper UI kit.

## The glass gate

`expo-glass-effect` needs **iOS 26+**; this app's deployment target is
**15.1**. Below 26 `GlassView` degrades to a plain `View`, not a blur — so the
three-tier `GlassSurface` (`GlassView` → `BlurView` → opaque
`glass/opaque-fallback`) is mandatory, not a nicety.

The regression history is real but version-specific: the library shipped with
SDK 54 and was stable there, and the **SDK 55** upgrade broke first-frame
cold-mounted views, views inside React Native `Modal`, and views that scroll off
and back. This project is on **SDK 54 — the known-good version**. Treat the
device spike as a gate on any future SDK upgrade rather than on Phase 1.

Never set `opacity` on a `GlassView` or any ancestor; it kills the effect. Use
the built-in `animate` / `animationDuration` props instead.
