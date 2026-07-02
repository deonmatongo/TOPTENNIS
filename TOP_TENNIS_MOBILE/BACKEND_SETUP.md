# Mobile Backend Setup — required deploy steps

The mobile app now matches the live Supabase schema (verified against project
`qrhladnnblgbobcnxjsz` on 2026-07-02). Three backend pieces must be deployed
by someone with project access — everything else already works.

## 1. Run the alignment migration (SQL editor or CLI)

File: `../supabase/migrations/20260702000001_mobile_backend_alignment.sql`

Idempotent. It fixes/creates:
- `notifications` type CHECK — adds `score_reminder` (currently **rejected** —
  both web and mobile write it) plus the union of all types either app uses
- `user_league_matches` view — adds `league_name` + `duration_minutes` alias
- `calls` table RLS + indexes (codifies the ad-hoc table) — **calls realtime
  will not work without the publication entries this adds**
- Realtime publication for `calls`, `league_matches`, `division_assignments`,
  `players`, `matches`
- `chat-media` storage bucket + policies — image/voice messages currently
  **fail** because the bucket does not exist
- `league_registrations.is_demo` column

Apply via dashboard SQL editor, or:
```bash
supabase link --project-ref qrhladnnblgbobcnxjsz
supabase db push
```

## 2. Deploy the mobile edge functions

Both live in `../supabase/functions/` (canonical copies) and are **not yet
deployed** (verified: the live project 404s on them):

```bash
supabase functions deploy livekit-token     # voice/video calls
supabase functions deploy delete-account    # account deletion (App Store requirement)
```

Secrets needed (Dashboard → Edge Functions → Secrets):
```
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```
(`SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SERVICE_ROLE_KEY` are injected
automatically.)

Then set the mobile env var (in `.env` and EAS env):
```
EXPO_PUBLIC_LIVEKIT_URL=wss://<your-project>.livekit.cloud
```

`send-push` is already deployed and working (Expo push via
`profiles.push_token`, fired by DB trigger on every notification insert).

## 3. Nothing else

All RPCs the mobile app calls were verified live: `insert_notification_safe`,
`accept_invite_and_lock_slot`, `unlock_slots_for_invite`,
`submit/confirm/dispute_league_match_score`, `create_league_match_with_invite`,
`get_division_opponents`, `assign_player_to_division`, `get_or_create_dm`,
`create_group_chat`, `block_user`/`unblock_user`/`get_blocked_users`.
The `league_standings` view now powers both mobile leaderboards (same points
formula as web: `wins*3 + floor(matches_completed/2)`).
