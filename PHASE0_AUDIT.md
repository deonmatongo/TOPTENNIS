# Phase 0 — Migration Audit

**Target:** `TOP_TENNIS_MOBILE/` · **Audited against:** `MOBILE_UI_SPEC.md`
**Status:** audit only, no code written. Awaiting sign-off before Part 1.

---

## 0.1 — Dependency and platform baseline

| Item | Value |
|---|---|
| Expo SDK | `~54.0.36` |
| React Native | `0.81.5` |
| React | `19.1.0` |
| TypeScript | `~5.9.2`, **`strict: false`** |
| Path alias | `@/*` → `./src/*` (tsconfig + babel module-resolver) |
| iOS deployment target | **15.1** (Expo default; no `expo-build-properties`) |
| `userInterfaceStyle` | **`"light"`** — app is locked to light mode at the OS level |
| `supportsTablet` | `true` |
| New Architecture | not set in `app.json` (SDK 54 default applies) |
| Test stack | Jest + `jest-expo` + Testing Library, 16 test files |

### The prompt's two structural assumptions are both wrong

**[ASSUMPTION — CORRECTED] "Is there a navigation library, or is navigation also hand-rolled?"**
React Navigation **v6 is present and fully wired**: `@react-navigation/native`, `native-stack`, `bottom-tabs`, `stack`. All 44 routes are registered in `src/App.tsx`. Phase 3 is therefore **restyle, not replace** — the smaller job. But see 0.4: every navigator sets `headerShown: false`, so the *native header* is switched off everywhere and re-implemented in JS.

**[ASSUMPTION — CORRECTED] "No UI framework, no design-token layer, styles written per-file."**
Both exist, and both are half-adopted:

- **Tamagui v2 (`2.0.0-rc.41`)** is installed, has a babel compiler plugin, a `tamagui.config.ts`, and `<TamaguiProvider defaultTheme="light">` mounted at the root. It is imported by only **6 files** — and 4 of those (`Button`, `Card`, `Input`, `Badge`) have **zero importers**. Effectively: a UI framework was started and abandoned. It is on a release candidate, not a stable release.
- **`src/theme/colors.ts`** is a real token layer: `Palette`, `Colors`, `LightColors`, `DarkColors`, `Spacing`, `Radius`, `FontSize`, `FontWeight`, `Font`, `Shadow`.
- **`src/contexts/ThemeContext.tsx`** implements full light/dark switching with persistence and `Appearance` listening, and exports `useTheme`, `useThemeColors`, `useThemedStyles`. `ThemeProvider` **is** mounted.

**And yet the app has no working dark mode.** `useThemeColors` has **zero consumers** outside its own definition; 52 files import the static `Colors` object instead. `app.json` pins `userInterfaceStyle: "light"`, and `AppPreferencesSection` exposes no appearance control. The dark-mode machinery is complete, unwired, and unreachable — this is the single largest piece of *existing* work the migration can reuse.

### Installed vs. the prompt's dependency tiers

**Already present — do not install:**
`react-native-safe-area-context` `~5.6.0` · `react-native-screens` `~4.16.0` · `react-native-gesture-handler` `~2.28.0` · `react-native-reanimated` `~4.1.1` (+ `react-native-worklets`) · `@react-navigation/*` v6 · `libphonenumber-js` · `expo-haptics` · `expo-calendar` · `expo-image-picker` · `expo-image` · `expo-font` · `expo-clipboard` is **absent** · `sonner-native` (toasts, covers Spec §6 Toast) · `react-native-svg` · `@expo/vector-icons`

**Tier 0 still needed:** `expo-symbols` only.
**Tier 1 still needed:** `expo-glass-effect`, `expo-blur`, `@gorhom/bottom-sheet`, `@react-native-segmented-control/segmented-control`, `@react-native-menu/menu`, `@shopify/flash-list`, `expo-clipboard`.
**Not needed:** `expo-router` (React Navigation is in place and working — switching router is a rewrite, not a migration), `react-hook-form`/`zod` (defer; see 0.4).

**One live-wire:** `react-native-gesture-handler` is installed but **`GestureHandlerRootView` is not mounted anywhere**. Bottom sheets and swipe actions will silently fail until it wraps the app root. This is a one-line Phase 1 fix.

---

## 0.2 — Component inventory and old → new mapping

23 reusable components. `Restyle` 9 · `Replace` 9 · `Retire` 5.

| Component | File | Importers | Spec §6 target | Outcome |
|---|---|---|---|---|
| `Avatar` | `ui/Avatar.tsx` | 11 | Avatar | **Restyle** — add size scale (30–88), deterministic per-name tint palette, presence dot, hairline ring. Currently one shared orange + `LinearGradient`. |
| `AuthShell` | `auth/AuthShell.tsx` | 6 | (auth chrome) | **Restyle** — drop navy gradient for `bg`, Large Title. |
| `PlayerProfileSheet` | `ui/PlayerProfileSheet.tsx` | 5 | E · Player Profile Sheet | **Replace** — RN `Modal` → page sheet. |
| `OtpInput` | `auth/OtpInput.tsx` | 2 | A5 OTP control | **Restyle** — 46×56 boxes, radius 14, 4 states, tabular Title 2. |
| `ReportSheet` | `ui/ReportSheet.tsx` | 2 | E · Report Sheet | **Replace** — → native action sheet. |
| `PlayerProfileModal` | `ui/PlayerProfileModal.tsx` | 2 | E · Player Profile Modal | **Replace** — → bottom sheet. |
| `_shared.tsx` (`SectionCard`, `NavRow`, `SettingRow`, `ChipRow`, `LabelRow`, `SectionPageHeader`, `SettingsSafeScreen`) | `screens/settings/_shared.tsx` | 7 | Lists (Section, Nav/Toggle/Value/Action Row) | **Restyle + promote** — this is already 80% of the Spec §6 list system, but scoped to settings. Move to `components/lists/`, add Swipeable Row, inset separators, sentence-case Footnote headers. **Highest-leverage single file in the migration.** |
| `ScreenHeader` | `ui/ScreenHeader.tsx` | 1 | Nav Bar | **Replace** — native-stack large titles. Cannot reproduce collapse or scroll edge effect. |
| `TabBar` | `navigation/TabBar.tsx` | 1 | Tab Bar + iPad sidebar | **Replace** — already implements the sidebar split at 768pt; keep that logic, swap the presentation for the glass pill. |
| `PhoneField` | `auth/PhoneField.tsx` | 1 | A4 Phone Field + Country Picker | **Replace** — picker `Modal` → page sheet with search. Formatting logic (`libphonenumber-js`) stays. |
| `MatchBooking` | `chat/MatchBooking.tsx` | 1 | E · Match Booking | **Replace** — → bottom sheet. |
| `NetworkBanner` | `ui/NetworkBanner.tsx` | 1 | Toast | **Restyle** — reconcile with `sonner-native`. |
| `AnimatedCounter` | `ui/AnimatedCounter.tsx` | 1 | (stat numbers) | **Restyle** — tabular figures, honour Reduce Motion. |
| `motion.tsx` | `ui/motion.tsx` | 1 | (animation helpers) | **Restyle** — add a Reduce Motion gate. |
| `ErrorBoundary` | `components/ErrorBoundary.tsx` | 1 | Error State | **Restyle** |
| 7 remaining modals¹ | `ui/*Modal.tsx` | 1–2 each | E · modals | **Replace** — page / bottom / action sheets per Spec §7E rule. |
| `Button` | `ui/Button.tsx` | **0** | Button | **Retire** — dead Tamagui code. Rebuild per spec (6 variants × 3 sizes × 4 states). |
| `Card` | `ui/Card.tsx` | **0** | Card | **Retire** — dead. |
| `Input` | `ui/Input.tsx` | **0** | Text Field | **Retire** — dead. |
| `Badge` | `ui/Badge.tsx` | **0** | Badge | **Retire** — dead. |
| `ProgressRing` | `ui/ProgressRing.tsx` | **0** | — (spec uses a bar) | **Retire** — dead, and no spec equivalent. |

¹ `MatchScoringModal`, `CasualMatchScoringModal`, `ScoreConfirmationModal`, `MatchInviteResponseModal`, `ProposeNewTimeModal`, `ScheduleLeagueMatchModal`, `LeagueRegistrationModal`.

**Missing entirely from the codebase** (Spec §6, must be built new): Icon Button · Chip · Count Pip · Divider · Swipeable Row · Segmented Control · Search Bar · Nav Bar (native) · Bottom Sheet · Action Sheet · Empty State · Error State · Loading State · Skeleton · Selection Card (A8) · Day Cell (B2) · Leaderboard Row (C3) · Bracket Node (C3).

---

## 0.3 — The hidden token set

### Colour

| Metric | Count |
|---|---|
| Hex literal occurrences outside `theme/` | **578** |
| Distinct hex values | **85** |
| `rgba()` occurrences outside `theme/` | **181** |
| Distinct `rgba()` values | **45** |
| **Total colour literals to codemod** | **759** across **130 distinct values** |

**Top literals and their spec token:**

| Literal | Count | Spec §2 token | Note |
|---|---|---|---|
| `#fff` / `#ffffff` | **309** | `label/on-accent`, `bg/tertiary`, `bg/grouped-secondary` | **Ambiguous — context-dependent. Not safely codemoddable.** See risk below. |
| `#0f1e38` | 24 | `brand/navy-700` | Retained as brand. |
| `#ea580c` | 21 | `accent` (light) | Direct map. |
| `#f59e0b` | 16 | `warning` → `#FF9500` | Value change (Tailwind amber → Apple orange). |
| `#16a34a` | 11 | `success` → `#34C759` | Value change. |
| `#ef4444` / `#dc2626` | 9 | `danger` → `#FF3B30` | Value change. |
| `#3b82f6` / `#2563eb` / `#1d4ed8` / `#1e40af` | 21 | `info` → `#007AFF` | Four blues collapse to one token. |
| `#fff7ed` `#f0fdf4` `#dcfce7` `#bbf7d0` `#fef3c7` `#fef2f2` `#eff6ff` `#dbeafe` … | ~60 | `*/muted` companions | Tailwind 50/100/200 tints → semantic muted at 12–18%. |
| `rgba(255,255,255,α)` × 24 distinct α | **~145** | `label/secondary`, `label/tertiary`, `fill/*`, `glass/*` | Alpha-on-white ladder — the de facto content hierarchy. Maps cleanly to `label/*`, but only on dark surfaces. |

**Diagnosis:** the palette is **Tailwind, not Apple.** `#f59e0b`, `#16a34a`, `#ef4444`, `#3b82f6` are Tailwind's amber/green/red/blue-500. Every status colour changes value under Spec §2.2. This is a visible, intentional change across the whole app — expect every screenshot diff to show it.

**Gaps — frequent literals with no spec token (your call, not mine):**

| Literal | Count | Where | Question |
|---|---|---|---|
| `#8b5cf6` / `#6d28d9` / `#ede9fe` (purple) | 11 | achievements, gradients | Spec §2 has **no purple**. Achievements currently use it as a tier colour. Add a token, or re-map to `info`? |
| `#166534` / `#f0fdf4` (deep court green) | 13 | match/court context | Spec has `brand/court-700 #166139` but no *light* court tint. Add `court/muted`? |
| `#0f1e38` (navy-700) | 24 | AuthShell, hero surfaces | Spec §2.1 keeps this as brand, but Spec §7 B1/A2 **removes** the surfaces that use it. Does navy survive anywhere outside the intro wordmark? |
| `'monospace'` | 2 | score display | Spec asks for **tabular figures**, not a mono face. Confirm the swap. |

### Type

| Metric | Value |
|---|---|
| `fontSize:` literals | **139**, across **22 distinct values** |
| `fontFamily:` references | **371 — all Nunito** |
| `FontWeight.*` token references | **174** (already tokenised — good) |
| Raw `fontWeight: '…'` literals | **0** |

Size distribution — `10` (38×), `11` (26×), `13` (11×), `9` (10×), `14` (9×), `15`/`12` (8× each), then a long tail up to `48`. **74 of 139 sizes are ≤ 11pt.** The app's dominant text sizes sit below Apple's smallest ramp step (Caption 2 = 11). Spec §3 raises nearly all of it.

**The typographic headline: the app is 100% Nunito.** Spec §3 mandates **SF Pro everywhere except the wordmark**. That is 371 references to change and a whole-app visual reset — a bigger perceptual change than the colour migration. `FontSize` tokens also don't match the spec ramp (`FontSize.md = 15`, spec Body = 17), so the existing scale is replaced, not remapped.

### Spacing and radius

- `borderRadius:` — **~200 occurrences, 39 distinct values**, including `19`, `23`, `26`, `27`, `34`, `38`, `70`, `75`, `90`, `140`. Most odd values are half-of-width circles (`width: 38, borderRadius: 19`) → all become `full`. Spec §4 allows **7** radii; the codebase uses 39.
- Existing `Radius` tokens are close but not equal to spec: `lg` 18 vs 20, `xl` 24 vs 28, `xxl` 32 vs 36. Spec adds `xxl 36`. **Retune the token values, keep the names** — call sites don't change.
- `Spacing` tokens (`2/4/8/12/16/20/24/32/48`) already match Spec §4 except `xxs: 2`, which the spec's 4/8 grid disallows.

**Worst files by colour-literal count** (the codemod's blast radius): `MyLeaguesScreen` 60 · `DashboardScreen` 57 · `MessagesScreen` 51 · `ScheduleScreen` 47 · `PlayerProfileSheet` 29 · `ProfileScreen` 28 · `JoinLeagueScreen` 27 · `CompetitionScreen` 27.

---

## 0.4 — Native-behaviour gap list

| # | Faked in JS today | Native replacement | Drop-in? |
|---|---|---|---|
| 1 | **All navigation headers.** `headerShown: false` on all 4 navigators; headers re-implemented via `ScreenHeader` + inline JSX. | `UINavigationController` large titles via native-stack `headerLargeTitle` | **No — visible change.** Gains large-title collapse, scroll edge effect, and correct back-button behaviour. Every screen's top ~100pt is re-laid-out. Highest-value item in the audit. |
| 2 | **Tab bar.** `tabBar={props => <TabBar/>}` fully overrides the native bar; Ionicons; JS `ZoomIn`/`FadeIn`. | `UITabBarController` / native tabs | **No.** Gains system Liquid Glass, correct safe-area and keyboard behaviour, Reduce Motion compliance. The existing 768pt sidebar logic is sound and should be preserved. |
| 3 | **All 12 modals + 4 screens use RN `<Modal>`** (16 files). | `UISheetPresentationController` (page sheet / detents / grabber) | **No.** Gains drag-to-dismiss, detents, correct stacking. Note: `<Modal>` is also the *worst* host for `expo-glass-effect` — see 0.4 note. |
| 4 | **6 hand-rolled tab strips** — `MessagesScreen`, `MatchesScreen`, `MyLeaguesScreen`, `SocialScreen`, `ManageBookingsScreen`, `PlayerProfileSheet` — all `useState<Tab>` + custom underline. | `UISegmentedControl` | **Mostly.** Same state, new presentation. `MyLeagues` (4 tabs) and `Messages` (4 tabs) are at the segment limit; Spec §7 D4 already concedes chips where 5 segments won't fit. |
| 5 | **Swipe actions: none exist.** Zero `Swipeable`, zero `PanGestureHandler`, zero `Gesture.*` in the codebase. | `UISwipeActionsConfiguration` | **No — new behaviour users have never seen.** Spec requires it on Matches cards and Notifications rows. Blocked on mounting `GestureHandlerRootView`. |
| 6 | **Long-press menus:** only 5 `onLongPress` handlers, no menu UI. | `UIContextMenuInteraction` | **No — new behaviour.** Spec §7 B4 needs Reply · Copy · Report · Delete in the Messages thread. |
| 7 | **Alerts — already native.** 100+ `Alert.alert` calls across 24 files. | `UIAlertController` | **Yes, already done.** Only needs destructive-role audit. This is the one row where the app is already correct. |
| 8 | **Lists are not virtualised.** 34 files use `<ScrollView>`, only 3 use `<FlatList>`, with **113 `.map()` renders** in screens. | `FlashList` | **Yes, behaviourally.** Confirms Spec §8 known-issue 4. Priority: leaderboards (C3), match history (C2), notifications (C7), messages (B4). |
| 9 | **Icons: 403 `<Ionicons>` refs across 40 files.** | SF Symbols via `expo-symbols` | **No.** Glyph shapes change everywhere. Mitigate with a single `<Icon>` wrapper so call sites change once. |
| 10 | **Dark mode is unreachable** — `userInterfaceStyle: "light"`, no appearance control, 0 `useThemeColors` consumers. | `UITraitCollection` | **No — new feature.** Spec D5 requires a System/Light/Dark segmented control that does not exist. |

**Forms:** hand-managed `useState` with inline validation (SignUp, Onboarding 4-step, Profile, scoring modals). It works and is well-factored. **Recommend deferring `react-hook-form`/`zod` indefinitely** — it is a logic refactor, and the Prime Directive says don't.

---

## 0.5 — Screen coverage

**All 30 screens and all 12 modals exist. Nothing is missing; nothing is partial.** The migration is 100% restyle, 0% net-new screens — except the components listed in 0.2 and the appearance control in 0.4 #10.

- **A. Auth (8/8):** AppIntro, Login, SignUp, VerifyCode, ForgotPassword, VerifyResetCode, SetNewPassword, Onboarding. (`PhoneField`/Country Picker is a component, per spec A4.)
- **B. Tab roots (5/5):** Dashboard, Schedule, Matches, Messages, Settings.
- **C. Home stack (10/10):** Profile, Performance, MyLeagues, JoinLeague, CasualMatch, Social, Notifications, NotificationSettings, ManageBookings, Competition.
- **D. Settings stack (7/7):** Account, Privacy, Notifications, MatchPreferences, AppPreferences, Support, SupportChat.
- **E. Modals (12/12):** all present under `components/ui/` + `chat/MatchBooking` + Country Picker inside `PhoneField`.

**`HomeScreen.tsx` — dead code confirmed.** Zero references anywhere in `src/`. Delete in Phase 3, do not migrate. ✅ spec known-issue 2.

**Two duplicate route registrations** (not in the spec, found during the audit):
- `SettingsScreen` is registered as both `HomeStack/Settings` and `SettingsStack/SettingsRoot`.
- `ProfileScreen` is registered in **both** `HomeStack` and `SettingsStack`.

Two stacks can push separate instances of the same screen with divergent back behaviour. Worth resolving during Phase 3, but it is a **navigation-logic** change — flagging rather than folding into a restyle.

---

## [VERIFY] results — where live docs contradict the prompt

**1. `expo-glass-effect` — the regression is in SDK 55, and this project is on SDK 54.**
The prompt warns of "a documented regression history across SDK versions." Confirmed, but the timeline matters: the library shipped with SDK 54 and was **stable there for six months**; the **SDK 55 upgrade** broke exactly the three cases the prompt names — first-frame cold-mount, views inside RN `Modal`, and views that scroll off and back. This project sits on **SDK 54, the known-good version.** The risk is not where we are; it is triggered by upgrading. (Single-source claim from a practitioner write-up, not Expo's own docs — treat as strong signal, not certainty.) The device spike is still worth running, but the finding reframes it: it is an *SDK-upgrade* gate, not a Phase 1 gate.

**2. `expo-glass-effect` requires iOS 26+; this app ships to iOS 15.1.**
`GlassView` falls back to a plain `View` below iOS 26 — not to a blur. Against a 15.1 target, the majority of the installed base would get **no material at all** unless `expo-blur` is wired as the middle tier. The three-tier `GlassSurface` the prompt specifies is therefore mandatory, not optional. Expo also added `isGlassEffectAPIAvailable()` for runtime checks, which corroborates the instability history.

**3. `expo-symbols` handles Android natively.** It maps to Material Symbols on Android/web, so the prompt's "map SF Symbol names behind a single `<Icon>` component if Android parity needs a fallback" is partly solved by the library. A wrapper is still warranted — symbol *names* differ per platform, and animation props are iOS-only. The library is flagged **beta, subject to breaking changes**.

**4. The project is 3 SDK versions behind.** Current Expo latest is SDK 57; this app is on 54. Not in scope for a UI migration, but it bounds which package versions resolve, and it is the event that would trigger finding #1.

---

## Open decisions — I need your call before Part 1

1. **Tamagui: rip out or adopt?** It is a release candidate, imported by 6 files, and 4 of those are dead. Building the Spec §6 library on top of an RC is a risk; keeping it half-adopted is the status quo we're fixing. **Recommendation: retire it** — delete the 4 dead components, migrate `DashboardScreen` and `ScreenHeader` off it, drop the provider and babel plugin. Roughly a one-commit change with a real payoff in build simplicity.
2. **iOS deployment target.** Liquid Glass needs 26+. Do we raise the floor (dropping older devices), or commit to the three-tier fallback with most users on `expo-blur`? This decides how much of the spec's material language actually ships.
3. **Nunito → SF Pro.** 371 references, and it changes the app's entire voice. Confirm this is intended and not just inherited from the Figma brief.
4. **The four token gaps in 0.3** — purple, light court green, navy's survival, and monospace scores.
5. **C8 / D3 consolidation** (spec known-issue 1, and the prompt asks me to flag not resolve). Both exist and overlap: `NotificationSettingsScreen` (Push/Email/Mute All) vs `NotificationsSection` (Delivery + Match/League/Social groups). **`NotificationsSection` is the superset.** Recommendation: keep it, delete `NotificationSettingsScreen`, repoint the Dashboard entry. This deletes a route — a navigation change, so it needs your sign-off.
6. **`#fff` (309 occurrences) cannot be safely codemodded.** It means "text on accent" in one place and "card surface" in another; a blind replace produces white-on-white. Recommendation: the codemod handles the ~450 unambiguous literals and *reports* the `#fff` sites for hand-migration screen by screen.

---

## Recommended Phase 1 scope (revised from the prompt, given the above)

The prompt's Phase 1 assumes a greenfield theme layer. It should instead be a **rebuild of the existing one**, because `ThemeContext` already does the hard part:

1. Retune `theme/` to Spec §2–4: semantic layer (`bg/*`, `label/*`, `fill/*`, `separator`, `accent`, status, `glass/*`) across Light/Dark/**Dark HC** (the third mode does not exist today).
2. Wire the three-mode switch end to end: `userInterfaceStyle: "automatic"` in `app.json`, plus the D5 appearance control — otherwise dark mode stays unreachable and Phase 5 cannot be verified.
3. Typography module with Dynamic Type + tabular figures.
4. `GlassSurface` with all three tiers, and `<Icon>` over `expo-symbols`.
5. **Mount `GestureHandlerRootView`** at the root.
6. Codemod script, dry-run only, with `#fff` sites reported rather than rewritten.
7. `/dev/tokens` screen.

The app builds and looks identical to today throughout, per the Prime Directive.

---

*Audit complete. No code written. Awaiting sign-off.*
