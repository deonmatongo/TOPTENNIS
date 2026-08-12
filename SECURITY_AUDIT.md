# Security Audit — Phase 1 Report

**Branch audited:** `feat/phone-username-auth`  
**Audit date:** 2026-08-11 / 2026-08-12  
**Auditor:** Claude Sonnet 4.6 (automated multi-agent + manual review)  
**Remediation branch:** `security/hardening`

---

## Summary

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| C-SEC-01 | **CRITICAL** | Service-role key hardcoded in source (current session) | Fixed (code); **key must be rotated** |
| C-SEC-02 | **CRITICAL** | Older service-role key in git history (prior commits) | **Awaiting user decision** — see below |
| C-SEC-03 | MEDIUM | CORS wildcard on auth endpoints | Fixed |
| C-SEC-04 | **HIGH** | Username bypass via direct PostgREST write | Fixed |
| C-SEC-05 | **HIGH** | `send-push` Edge Function unauthenticated | Fixed |
| C-SEC-06 | MEDIUM | Mobile admin reset gated by client-side state only | Open — next sprint |
| C-SEC-07 | MEDIUM | Rate limit fails open on DB error | Accepted (by design) |
| C-SEC-08 | LOW | `start-signup` working-tree change would leak E.164 phone | Open — do not commit |
| C-SEC-09 | LOW | No request body size/schema limits on Edge Functions | Open |
| C-SEC-10 | INFO | Access token JWT carries phone in JWT claims | Known/Accepted |

---

## C-SEC-01 — Service-role key hardcoded in source (CRITICAL) ✅ Fixed

**File:** `scripts/create-demo-account.mjs` (written in this session)  
**Commit:** `fdb036a`

Script had the Supabase service-role key, demo phone, and password as string literals. Removed; script now reads `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_PHONE`, `DEMO_PASSWORD` from environment variables. Added `scripts/.env.example`.

**Required action:** Rotate the service-role key in Supabase dashboard → Settings → API → Regenerate. Removing it from source does not revoke it.

---

## C-SEC-02 — Older service-role key in git history (CRITICAL) ⚠️ User decision required

**Commits:** `33bc234` (added scripts with key), `42b7b07` (deleted those files, noted rotation needed)

Eleven utility scripts committed in a prior session embed a different service-role key. The `42b7b07` commit message says "ROTATE that key in the dashboard" — but the key remains readable in git history for anyone with a clone.

**What needs to happen:**

1. Verify whether the key from commit `33bc234` is already rotated. If it is, anyone with an old clone has a dead credential — no further impact.
2. If it has NOT been rotated, rotate it immediately in the Supabase dashboard.
3. To make the key permanently unreachable: rewrite git history with [BFG Repo Cleaner](https://rtyley.github.io/bfg-repo-cleaner/) or `git filter-repo`. This is destructive: all collaborators must re-clone, and any open PRs will need rebasing.

**This is a user decision** — git history rewriting affects all collaborators and the remote repo. I have not done it automatically.

---

## C-SEC-03 — CORS wildcard on auth endpoints (MEDIUM) ✅ Fixed

**File:** `supabase/functions/_shared/http.ts`  
**Commit:** `7b7405c`

`'Access-Control-Allow-Origin': '*'` replaced with `Deno.env.get('ALLOWED_ORIGIN') ?? 'https://toptennis.app'`. Added `Vary: Origin` header. Set `ALLOWED_ORIGIN` in Supabase secrets for any additional origins.

---

## C-SEC-04 — Username bypass via direct PostgREST write (HIGH) ✅ Fixed

**Files:** `supabase/migrations/20260812000001_block_direct_username_write.sql`, `TOP_TENNIS_MOBILE/src/hooks/useProfile.ts`  
**Commit:** `b02f93a`

The `profiles` UPDATE RLS policy checked `auth.uid() = id` but had no column restriction. Any authenticated user could `PATCH /rest/v1/profiles?id=eq.<their_id>` with `{ username: "anyFreeHandle" }` and claim it without phone verification — bypassing `claim_identity()` entirely.

**Fix:** Two-layer defence:
1. `guard_username_change()` BEFORE UPDATE trigger raises `insufficient_privilege` for any non-service_role caller that changes `username`.
2. `useProfile.ts` strips `username`, `id`, `user_id`, `phone`, `wins`, `losses` before any PostgREST UPDATE.

---

## C-SEC-05 — `send-push` Edge Function unauthenticated (HIGH) ✅ Fixed

**File:** `supabase/functions/send-push/index.ts`  
**Commit:** `fa04f44`

Function was deployed with `--no-verify-jwt` and had no other authentication. Any caller that knew a victim's user UUID could send arbitrary push notifications to their device (phishing / harassment vector).

**Fix:** Added `PUSH_SECRET` env var check. Callers must include `Authorization: Bearer <PUSH_SECRET>`. Missing or wrong secret → 401. Unset env var → 503 (fail closed).

**Required action:** Set the secret: `supabase secrets set PUSH_SECRET=<strong-random-value>`

---

## C-SEC-06 — Mobile admin reset gated by client-side `isAdmin` only (MEDIUM) 🔵 Open

**File:** `TOP_TENNIS_MOBILE/src/screens/SettingsScreen.tsx`

`handleAdminReset` fires three direct PostgREST mutations (`players`, `match_invites`, `notifications`) after a client-side `isAdmin` check. The RLS policies on those tables limit the blast radius to the caller's own rows, so a non-admin user cannot wipe all data — but the admin-only UX intent is defeated.

**Recommended fix:** Wrap the three mutations in a `SECURITY DEFINER admin_reset_all_data()` RPC that calls `has_role(auth.uid(), 'admin')` at the top and raises if false.

**Not fixed yet** — flagged for next sprint.

---

## C-SEC-07 — Rate limit fails open on DB error (MEDIUM) — Accepted

**File:** `supabase/functions/_shared/ratelimit.ts`

When `consume_rate_limit()` returns a DB error, `consume()` returns `{ allowed: true }` (fail open). The code comment explicitly documents this: *"an outage in the ledger must not lock every user out of signing in."* This is the correct trade-off for an auth endpoint. No change made.

**Future:** Move rate-limit store to Upstash Redis (independent of application DB).

---

## C-SEC-08 — Working-tree `start-signup` would leak E.164 phone (LOW) 🔴 Do not commit

**File:** `supabase/functions/start-signup/index.ts` (working tree, not committed)

Uncommitted change on `feat/phone-username-auth` changes the success response to `{ ok: true, phone }`. Both `AuthContext.tsx` files already have `parsePhoneNumberFromString(phone, defaultCountry)` as a fallback — `data.phone` is not needed. **Do not commit this change.**

---

## C-SEC-09 — No request body size / schema limits on Edge Functions (LOW) 🔵 Open

No Zod or similar schema library; `readJson<T>()` is a plain cast. No max-length guards on `identifier` or `password` before string processing.

**Recommended fix:** Add explicit max-length checks at the top of each handler (e.g. 200 chars for identifier, 1024 for password) before any async work.

---

## C-SEC-10 — Access token JWT carries phone (INFO) — Accepted

GoTrue JWTs include the `phone` claim. This is the user's own number on their own account — not a cross-account leak. Documented in `login-with-username` function comments. No fix planned.

---

## Checks that passed

| Check | Result |
|-------|--------|
| SQL injection | All queries use parameterised Supabase client calls or typed RPCs |
| RLS: `user_phone_identities`, `auth_rate_limits`, `auth_events` | Enabled, zero permissive policies, revoked from anon/authenticated |
| Username/phone enumeration | Generic messages + uniform timing across all failure branches |
| PII in audit logs | `phoneLast4` and salted SHA-256 subject hashes only |
| Session token leak | Only `access_token` + `refresh_token` returned from login/reset functions |
| Auth hash salt | Read from `Deno.env`, throws at cold start if absent or < 16 chars |
| Admin key in deployed functions | Read from `Deno.env`, not hardcoded |
| `claim_identity()` race condition | Single-transaction, phone read server-side, `phone_confirmed_at` required |
| Payment webhooks | None present in codebase |
| Storage bucket RLS | `profile-pictures`: public read, authenticated write, owner-folder-prefix scoped |

---

## Required user actions

| Action | Priority |
|--------|----------|
| **Rotate the current service-role key** (Supabase → Settings → API → Regenerate) | CRITICAL — do this now |
| **Verify / rotate the older key** from commit `33bc234` (check if already rotated) | CRITICAL |
| Consider git history rewrite to remove all key traces (BFG Repo Cleaner) | HIGH — your call |
| Set `PUSH_SECRET` in Supabase secrets: `supabase secrets set PUSH_SECRET=<value>` | HIGH — required for C-SEC-05 fix |
| Set `ALLOWED_ORIGIN` if web client ever runs at a different origin | MEDIUM |
| Do NOT commit the `start-signup` working-tree change that adds `phone` to the response | LOW |
