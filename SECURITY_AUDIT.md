# Security Audit — Phase 1 Report

**Branch audited:** `feat/phone-username-auth`  
**Audit date:** 2026-08-11  
**Auditor:** Claude Sonnet 4.6 (automated + manual review)  
**Remediation branch:** `security/hardening`

---

## Summary

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| C-SEC-01 | **CRITICAL** | Service-role key hardcoded in source | Fixed |
| C-SEC-02 | MEDIUM | CORS wildcard on auth endpoints | Fixed |
| C-SEC-03 | LOW | `x-forwarded-for` attacker-controllable | Accepted |
| C-SEC-04 | INFO | Access token carries phone in JWT claims | Known/Accepted |

---

## C-SEC-01 — Service-role key hardcoded in source (CRITICAL)

**File:** `scripts/create-demo-account.mjs`  
**Lines:** 10–13

`scripts/create-demo-account.mjs` had the Supabase service-role key, the demo account phone number, and the demo account password as plain string literals. Any clone of the repository — or any future `git log --all -p` — would expose a credential with unrestricted write access to the production database, including the ability to create admin users, bypass RLS, and read every row in every table.

**Fix (commit `fdb036a`):** Script now reads `SUPABASE_SERVICE_ROLE_KEY`, `DEMO_PHONE`, and `DEMO_PASSWORD` from environment variables. It exits with a clear error message if any are absent. Added `scripts/.env.example` as a template; `scripts/.env` is covered by the root `.gitignore` (`.env` pattern).

**Required action (cannot be done in code):** The service-role key that was in the file must be rotated in the Supabase dashboard: **Settings → API → Regenerate service role key**. Removing it from source does not revoke it. Until it is rotated, anyone who has a copy of the repo at that commit retains admin access to production.

---

## C-SEC-02 — CORS wildcard on auth endpoints (MEDIUM)

**File:** `supabase/functions/_shared/http.ts`, line 9

`'Access-Control-Allow-Origin': '*'` was set on all auth Edge Function responses. This allows any web page to make cross-origin requests to the login, signup, username-check, and password-reset endpoints and read the full responses — including session tokens returned by `login-with-username` and `verify-reset-code`.

The wildcard doesn't enable CSRF (credentials must still be known to login, and the OTP must still arrive on the victim's handset for reset). The primary risk is that a malicious page could silently consume auth API responses in a victim's browser session, or that phishing kit could relay login responses without detection.

**Fix (commit `7b7405c`):** Changed to `Deno.env.get('ALLOWED_ORIGIN') ?? 'https://toptennis.app'` with a `Vary: Origin` header. Mobile clients are unaffected — CORS is a browser-only mechanism. For local development, set `ALLOWED_ORIGIN=http://localhost:5173` in `supabase/functions/.env`.

---

## C-SEC-03 — `x-forwarded-for` is attacker-controllable (LOW / Accepted)

**File:** `supabase/functions/_shared/http.ts`, `clientIp()` function

Rate-limit buckets keyed on IP use `x-forwarded-for`, which a caller can spoof. An attacker could set `x-forwarded-for: 1.2.3.4` to make their requests count against a different IP bucket.

**Why accepted:** The IP rate limit is a secondary control. The primary controls are per-account failure tracking (keyed on the identifier the attacker must guess, not on IP) and GoTrue's own per-phone OTP limits. IP spoofing does allow a single host to evade the per-IP bucket, but it provides no path to account compromise. Per-account backoff still applies regardless of the IP.

Fixing this would require relying on a Supabase-injected header rather than the forwarded-for chain. This is a platform-level constraint. Documented here for awareness; no code change required.

---

## C-SEC-04 — Access token JWT carries phone number (INFO / Known)

**File:** `supabase/functions/login-with-username/index.ts`, line 173–180

GoTrue's issued `access_token` is a standard JWT. Its claims include the `phone` field for accounts created via phone auth. This means that after a successful login, a user can decode their own access token and read their phone number.

This is noted explicitly in a code comment in `login-with-username`. It is an unavoidable property of Supabase's GoTrue JWT schema without a custom JWT secret or a token-translation layer. It is not the privacy leak the server-side username→phone resolution is designed to prevent — that resolution only makes it harder for one user to learn another user's phone number. An authenticated user can always read their own number via their own token, and that is fine.

No fix required or planned.

---

## Checks that passed (no action required)

| Check | Finding |
|-------|---------|
| **C03 — SQL injection** | All queries use parameterised Supabase client calls or RPCs. No raw SQL in Edge Functions. |
| **C04 — RLS coverage** | `user_phone_identities`, `auth_rate_limits`, `auth_events` all have RLS enabled with zero permissive policies and explicit revokes from `anon`/`authenticated`. |
| **C05 — Username enumeration** | `check-username` returns only `{ available: boolean }`. Login path returns one generic message for all failure modes with uniform response padding. |
| **C06 — PII in logs** | `logEvent()` stores only `phoneLast4`, salted-SHA-256 subject hashes. Full phone and IP never reach the `auth_events` table. |
| **C07 — Session token leak** | `login-with-username` and `verify-reset-code` return only `access_token` + `refresh_token`. The full GoTrue session (with nested `user.phone`) is not forwarded. |
| **C08 — Rate limiting** | All five auth functions enforce per-IP and/or per-account limits via `consume_rate_limit()`. `check-username` has its own IP limit. |
| **C09 — Response timing** | `respondUniform()` pads all auth responses to ≥600 ms. Rate-limit and malformed-body 4xx branches bypass this intentionally (they reveal nothing about account state). |
| **C10 — Auth hash salt** | `security.ts` reads `AUTH_HASH_SALT` from `Deno.env` and throws at cold start if missing or shorter than 16 chars. No hardcoded salt. |
| **C11 — Admin key in Edge Functions** | `audit.ts` reads `SUPABASE_SERVICE_ROLE_KEY` from `Deno.env`. No hardcoded key in deployed functions. |
| **C12 — Claim identity race** | `claim_identity()` RPC validates `phone_confirmed_at` and reads the phone server-side inside a single transaction. No client-supplied phone accepted. |
| **C13 — IDOR on profiles** | Username lookup in `check-username` and `start-signup` uses the service-role client; the anon client's RLS policies on `profiles` are not bypassed. |
| **C14 — Input validation** | `classifyIdentifier()` rejects malformed identifiers; `isValidUsername()` enforces format; `normalizePhone()` validates and E.164-normalises phone numbers. |

---

## Pending user action

1. **Rotate the service-role key** in Supabase dashboard → Settings → API → Regenerate service role key. This is the only action that actually revokes the credential that was in source. Code changes alone do not help if the old key is still valid.

2. **Set `ALLOWED_ORIGIN` in production Supabase secrets** if the web app ever runs at any origin other than `https://toptennis.app`:
   ```bash
   supabase secrets set ALLOWED_ORIGIN=https://toptennis.app
   ```
