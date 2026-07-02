# TOP TENNIS 🎾

Tennis league management and player matching platform — leagues, divisions,
round-robin scheduling, match invites with availability booking, score
confirmation, leaderboards, messaging, and voice/video calls.

## Apps

| App | Stack | Location |
|-----|-------|----------|
| Web | Vite + React + shadcn/Tailwind | `TOP_TENNIS_WEBSITE/` |
| Mobile (iOS + Android) | Expo / React Native + Tamagui | `TOP_TENNIS_MOBILE/` |

Both share one Supabase backend (Postgres + RLS, Realtime, Storage, Edge
Functions) and one LiveKit project for calls.

## Getting started

### Web
```bash
cd TOP_TENNIS_WEBSITE
npm install
npm run dev          # http://localhost:8080
```

### Mobile
```bash
cd TOP_TENNIS_MOBILE
npm install
cp .env.example .env  # fill in Supabase / LiveKit / Sentry values
npx expo start
```

Mobile production builds go through EAS — see
`TOP_TENNIS_MOBILE/PRODUCTION_CHECKLIST.md` for the store-release runbook and
`TOP_TENNIS_MOBILE/BACKEND_SETUP.md` for one-time backend deploy steps.

## Backend

- Migrations: `supabase/migrations/` (apply with `supabase db push` or the
  dashboard SQL editor)
- Edge functions: `supabase/functions/` — `send-push` (Expo push, fired by DB
  trigger on notification insert), `livekit-token` (call auth),
  `delete-account`
- Historical one-off SQL that was run manually against prod is archived in
  `docs/sql-archive/` for reference; new changes belong in migrations.

## Deployment

Web deploys to Vercel — see `TOP_TENNIS_WEBSITE/DEPLOYMENT.md`. The Vercel
project's **Root Directory** setting must point at `TOP_TENNIS_WEBSITE/`.
