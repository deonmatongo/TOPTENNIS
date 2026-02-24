# Top Tennis Mobile — Production Checklist

> **Target: 1 week to launch**
> Work through this list top-to-bottom. Items marked ✅ are already done by Cascade.

---

## ✅ Already Done (Automated)

- [x] `eas.json` created with development / preview / production build profiles
- [x] `app.json` — all iOS `infoPlist` permission strings added (camera, photos, calendar, notifications, location)
- [x] `app.json` — Android permissions declared
- [x] `app.json` — `userInterfaceStyle` set to `"light"` (no dark mode crash)
- [x] `app.json` — `expo-image-picker`, `expo-calendar`, `expo-notifications` plugins configured
- [x] Forgot Password flow added to `AuthScreen` (Supabase `resetPasswordForEmail`)
- [x] Supabase migration: `app_settings` table with RLS
- [x] Supabase migration: `notification_settings` table with RLS
- [x] Network connectivity banner (`NetworkBanner` + `useNetworkStatus`)
- [x] Casual match result fixed (`'played'` instead of misleading `'win'`)
- [x] `.env.example` updated with setup instructions

---

## 🔴 Day 1 — Expo & EAS Setup (30 min)

### 1. Create / log into Expo account
```bash
eas login
# or create account at https://expo.dev
```

### 2. Link project to EAS (gets you a projectId)
```bash
cd TOP_TENNIS_MOBILE
eas init
```
Copy the `projectId` from the output and paste it into `app.json`:
```json
"extra": {
  "eas": {
    "projectId": "PASTE_YOUR_PROJECT_ID_HERE"
  }
}
```

### 3. Set EAS secrets (so builds can access Supabase)
```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://yourproject.supabase.co"
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "your-anon-key"
```

---

## 🔴 Day 1-2 — Push Notifications (1-2 hours)

Push notifications require platform credentials. Without these, notifications will NOT work in production.

### iOS (APNs)
1. Go to [Apple Developer Portal](https://developer.apple.com) → Certificates → Keys
2. Create a new key with **Apple Push Notifications service (APNs)** enabled
3. Download the `.p8` file
4. In EAS: `eas credentials` → iOS → Push Notifications → upload the key
   - Or upload via [Expo Dashboard](https://expo.dev) → Project → Credentials

### Android (FCM)
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a project (or use existing) → Project Settings → Cloud Messaging
3. Download `google-services.json` and place it at:
   ```
   TOP_TENNIS_MOBILE/google-services.json
   ```
4. Copy the **Server Key** from Firebase → paste into EAS:
   ```bash
   eas credentials
   # → Android → Push Notifications → FCM API Key
   ```

---

## 🔴 Day 2 — App Store Connect Setup (iOS)

1. Log in to [App Store Connect](https://appstoreconnect.apple.com)
2. Create a new app:
   - Bundle ID: `com.top.tennis`
   - Name: `Top Tennis`
3. Fill in `eas.json` submit section:
   ```json
   "appleId": "your@apple.com",
   "ascAppId": "YOUR_APP_ID_FROM_ASC",
   "appleTeamId": "YOUR_TEAM_ID"
   ```
4. Prepare App Store listing:
   - Screenshots (6.7" iPhone required, iPad optional)
   - App description, keywords, support URL
   - Privacy policy URL (required): create at https://www.privacypolicygenerator.info

---

## 🔴 Day 2 — Google Play Console Setup (Android)

1. Log in to [Google Play Console](https://play.google.com/console)
2. Create a new app → package: `com.top.tennis`
3. Create a service account for automated submission:
   - Play Console → Setup → API access → Create service account
   - Download `google-service-account.json` → place at `TOP_TENNIS_MOBILE/google-service-account.json`
4. Fill in the store listing (description, screenshots, content rating)

---

## 🟡 Day 3 — First Build & Test

### Build for internal testing
```bash
# iOS (TestFlight)
eas build --platform ios --profile preview

# Android (APK for direct install)
eas build --platform android --profile preview
```

### Submit to TestFlight / Play Internal Testing
```bash
eas submit --platform ios
eas submit --platform android
```

### Test on real devices via TestFlight / Play Internal
- Invite 5-10 beta testers
- Test: sign up, onboarding, match invite, score submission, notifications

---

## 🟡 Day 4-5 — Production Build

Once testing is clean:
```bash
# Build production
eas build --platform all --profile production

# Submit to stores
eas submit --platform all --profile production
```

---

## 🟡 Day 5-6 — App Store Review

- iOS review typically takes **24-48 hours**
- Android review typically takes **1-3 days** for first submission
- Submit early to account for rejections

Common rejection reasons to avoid:
- [ ] Privacy policy URL must be live and accessible
- [ ] All permission strings must match actual usage
- [ ] No placeholder content visible in screenshots
- [ ] App must work without a network connection (show error, not crash)

---

## 🟢 Optional but Recommended Before Launch

### Crash Reporting (Sentry) — 30 min
```bash
npx expo install @sentry/react-native
```
Then wrap your app in `Sentry.init()` — see https://docs.sentry.io/platforms/react-native/

### Analytics (PostHog) — 30 min
```bash
npm install posthog-react-native
```

### OTA Updates (already configured via runtimeVersion)
After launch, push JS-only fixes without App Store review:
```bash
eas update --branch production --message "Fix: score display"
```

---

## 📋 Pre-Launch Checklist

- [ ] EAS project linked (`projectId` in `app.json`)
- [ ] EAS secrets set (Supabase URL + key)
- [ ] APNs key uploaded to EAS
- [ ] `google-services.json` in project root
- [ ] FCM key in EAS credentials
- [ ] App Store Connect app created
- [ ] Google Play Console app created
- [ ] Privacy policy URL live
- [ ] App icon is final (not placeholder)
- [ ] Splash screen is final
- [ ] `eas.json` submit section filled in
- [ ] Internal build tested on real iOS + Android device
- [ ] Push notifications tested end-to-end
- [ ] Password reset email tested
- [ ] Sign up → onboarding → first match flow tested

---

## 🗓 Suggested Timeline

| Day | Task |
|-----|------|
| Day 1 (today) | EAS login + init, set secrets, Firebase setup |
| Day 2 | App Store Connect + Play Console setup, APNs key |
| Day 3 | First preview build, TestFlight/Play internal |
| Day 4 | Beta testing, fix any issues |
| Day 5 | Production build + submit to both stores |
| Day 6-7 | Review period (iOS 24-48h, Android 1-3 days) |
| Day 7 | **Launch** 🎾 |
