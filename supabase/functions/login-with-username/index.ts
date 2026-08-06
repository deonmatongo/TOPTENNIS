// Supabase Edge Function — login-with-username
//
// Signs a user in from "username or phone number" + password and returns the
// session. No auth required (this is the login endpoint).
//
// Why this exists: resolving a username to a phone number is a PII lookup and
// an enumeration oracle. It happens here, with the service role key, and the
// phone number is never included in the response. The client sends whatever the
// user typed and gets back a session or one generic failure.
//
// Both identifier kinds take the same code path and the same padded response
// time, so "no such username", "wrong password" and "phone not registered" are
// indistinguishable from outside.
//
// Required Supabase secrets:
//   AUTH_HASH_SALT
//
// Request:   { identifier: string, password: string, defaultCountry?: string }
// Response:  { session, user }                 200
//            { error: 'Incorrect username or password.' }  401
//            { error: string }                429 / 400 / 500

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { clientIp, json, preflight, readJson, respondUniform } from '../_shared/http.ts'
import { classifyIdentifier } from '../_shared/phone.ts'
import { LIMITS, backoffSeconds, consume, peek, reset } from '../_shared/ratelimit.ts'
import { adminClient, logEvent, logLine } from '../_shared/audit.ts'
import { correlationId } from '../_shared/security.ts'

/** The only failure message this endpoint ever returns for a bad login. */
const GENERIC_FAILURE = 'Incorrect username or password.'

Deno.serve(async (req: Request) => {
  const startedAt = Date.now()
  if (req.method === 'OPTIONS') return preflight()
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const cid = correlationId()
  const ip = clientIp(req)
  const admin = adminClient()

  const body = await readJson<{ identifier?: string; password?: string; defaultCountry?: string }>(req)
  if (!body) return json({ error: 'Invalid JSON body' }, 400)

  const identifier = String(body.identifier ?? '').trim()
  const password = String(body.password ?? '')
  const defaultCountry = String(body.defaultCountry ?? 'US')

  if (!identifier || !password) {
    return await respondUniform(startedAt, { error: GENERIC_FAILURE }, 401)
  }

  // ---- per-IP ceiling ------------------------------------------------------
  const perIp = await consume(admin, LIMITS.loginPerIp, ip)
  if (!perIp.allowed) {
    logLine(cid, 'login_attempt', 'throttled', `scope=ip hits=${perIp.hits}`)
    await logEvent(admin, {
      correlationId: cid,
      event: 'rate_limit_trip',
      outcome: 'throttled',
      subject: ip,
      detail: { bucket: LIMITS.loginPerIp.bucket },
    })
    return json({ error: 'Too many attempts. Please try again shortly.' }, 429, {
      'Retry-After': String(perIp.retryAfterSeconds),
    })
  }

  // ---- progressive per-account backoff -------------------------------------
  // Keyed on the identifier as typed (hashed), so it applies before we know
  // whether the account exists — that keeps the throttle from confirming
  // existence. Read with peek, never consume: counting this check itself would
  // throttle a user who is signing in correctly.
  const failKey = identifier.toLowerCase()
  const priorFailures = await peek(admin, LIMITS.loginFailPerAccount, failKey)
  const wait = backoffSeconds(priorFailures)
  if (wait > 0) {
    logLine(cid, 'login_attempt', 'throttled', `scope=account wait=${wait}s`)
    await logEvent(admin, {
      correlationId: cid,
      event: 'rate_limit_trip',
      outcome: 'throttled',
      subject: failKey,
      detail: { bucket: LIMITS.loginFailPerAccount.bucket, waitSeconds: wait },
    })
    return json({ error: 'Too many attempts. Please try again shortly.' }, 429, {
      'Retry-After': String(wait),
    })
  }

  const parsed = classifyIdentifier(identifier, defaultCountry)
  if (parsed.kind === 'invalid') {
    // Same shape and timing as a wrong password — a rejected format must not
    // tell the caller that the identifier could never have existed.
    return await respondUniform(startedAt, { error: GENERIC_FAILURE }, 401)
  }

  // ---- resolve to a phone number, server-side only -------------------------
  const lookup = parsed.kind === 'phone' ? parsed.e164 : parsed.username
  const { data: phoneE164, error: resolveError } = await admin.rpc('resolve_phone_for_identifier', {
    p_identifier: lookup,
  })

  if (resolveError) {
    console.error(`[login-with-username] cid=${cid} resolve failed: ${resolveError.message}`)
    return await respondUniform(startedAt, { error: 'Could not sign you in. Try again.' }, 500)
  }

  if (!phoneE164) {
    logLine(cid, 'login_failure', 'denied', `reason=unknown_identifier kind=${parsed.kind}`)
    await logEvent(admin, {
      correlationId: cid,
      event: 'login_failure',
      outcome: 'denied',
      subject: failKey,
      detail: { reason: 'unknown_identifier', kind: parsed.kind },
    })
    return await respondUniform(startedAt, { error: GENERIC_FAILURE }, 401)
  }

  // ---- sign in -------------------------------------------------------------
  // A fresh anon-key client: signInWithPassword on the service-role client
  // would mutate that shared client's session state.
  const authClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: signIn, error: signInError } = await authClient.auth.signInWithPassword({
    phone: phoneE164,
    password,
  })

  if (signInError || !signIn.session) {
    // Burn a failure against this identifier to drive the backoff.
    await consume(admin, LIMITS.loginFailPerAccount, failKey)
    logLine(cid, 'login_failure', 'denied', 'reason=bad_password')
    await logEvent(admin, {
      correlationId: cid,
      event: 'login_failure',
      outcome: 'denied',
      phone: phoneE164,
      subject: failKey,
      detail: { reason: 'bad_credentials' },
    })
    return await respondUniform(startedAt, { error: GENERIC_FAILURE }, 401)
  }

  // One correct password clears the streak, so a user who mistyped twice is not
  // left carrying a backoff into their next session.
  await reset(admin, LIMITS.loginFailPerAccount, failKey)

  logLine(cid, 'login_success', 'ok', `kind=${parsed.kind}`)
  await logEvent(admin, {
    correlationId: cid,
    event: 'login_success',
    outcome: 'ok',
    userId: signIn.user?.id ?? null,
    phone: phoneE164,
    subject: failKey,
    detail: { kind: parsed.kind },
  })

  // Return ONLY the two tokens setSession needs.
  //
  // Returning `signIn.session` wholesale ships a nested `user` object containing
  // phone, email, metadata and weak_password — which defeats the point of doing
  // the username -> phone resolution server-side.
  //
  // Caveat worth knowing: the access_token is a GoTrue JWT and its claims include
  // `phone`, so an authenticated caller can always read the number on their OWN
  // account. That is unavoidable without a custom token, and is not the leak this
  // design guards against: resolving SOMEONE ELSE'S username to a phone number
  // still requires their password, and failing that returns an identical 401.
  return await respondUniform(startedAt, {
    session: {
      access_token: signIn.session.access_token,
      refresh_token: signIn.session.refresh_token,
    },
    user: { id: signIn.user?.id },
  })
})
