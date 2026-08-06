// Supabase Edge Function — verify-reset-code
//
// Step 2 of "forgot password": exchange the SMS code for a short-lived session.
// No auth required.
//
// This function exists because verifyOtp needs the phone number, and on the
// username path the client never learns it — resolve-for-reset deliberately
// hides it. Without this, "reset by username" could not work at all: the client
// would be holding a code for a number it cannot name.
//
// Mirrors login-with-username: resolve server-side, act server-side, return only
// the session.
//
// Required Supabase secrets:
//   AUTH_HASH_SALT
//
// Request:   { identifier: string, token: string, defaultCountry?: string }
// Response:  { session, user }   200
//            { error }           401 / 429 / 400 / 500

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { clientIp, json, preflight, readJson, respondUniform } from '../_shared/http.ts'
import { classifyIdentifier } from '../_shared/phone.ts'
import { LIMITS, consume } from '../_shared/ratelimit.ts'
import { adminClient, logEvent, logLine } from '../_shared/audit.ts'
import { correlationId } from '../_shared/security.ts'

/** One message for every failure mode: wrong code, expired code, no such account. */
const GENERIC_FAILURE = 'That code is incorrect or has expired. Request a new one.'

Deno.serve(async (req: Request) => {
  const startedAt = Date.now()
  if (req.method === 'OPTIONS') return preflight()
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const cid = correlationId()
  const ip = clientIp(req)
  const admin = adminClient()

  const body = await readJson<{ identifier?: string; token?: string; defaultCountry?: string }>(req)
  if (!body) return json({ error: 'Invalid JSON body' }, 400)

  const identifier = String(body.identifier ?? '').trim()
  const token = String(body.token ?? '').trim()
  const defaultCountry = String(body.defaultCountry ?? 'US')

  if (!/^\d{4,8}$/.test(token)) {
    return await respondUniform(startedAt, { error: GENERIC_FAILURE }, 401)
  }

  // Per-IP ceiling on verification attempts. Twilio Verify independently caps
  // checks per code and invalidates it after too many, which is the control that
  // stops brute force against one code; this bounds sweeping across many.
  const perIp = await consume(admin, LIMITS.loginPerIp, ip)
  if (!perIp.allowed) {
    logLine(cid, 'rate_limit_trip', 'throttled', 'fn=verify-reset-code scope=ip')
    await logEvent(admin, {
      correlationId: cid,
      event: 'rate_limit_trip',
      outcome: 'throttled',
      subject: ip,
      detail: { bucket: LIMITS.loginPerIp.bucket, fn: 'verify-reset-code' },
    })
    return json({ error: 'Too many attempts. Please try again shortly.' }, 429, {
      'Retry-After': String(perIp.retryAfterSeconds),
    })
  }

  const parsed = classifyIdentifier(identifier, defaultCountry)
  if (parsed.kind === 'invalid') {
    return await respondUniform(startedAt, { error: GENERIC_FAILURE }, 401)
  }

  const lookup = parsed.kind === 'phone' ? parsed.e164 : parsed.username
  const { data: phoneE164, error: resolveError } = await admin.rpc('resolve_phone_for_identifier', {
    p_identifier: lookup,
  })

  if (resolveError) {
    console.error(`[verify-reset-code] cid=${cid} resolve failed: ${resolveError.message}`)
    return await respondUniform(startedAt, { error: 'Something went wrong. Try again.' }, 500)
  }

  if (!phoneE164) {
    logLine(cid, 'login_failure', 'denied', 'fn=verify-reset-code reason=unknown_identifier')
    return await respondUniform(startedAt, { error: GENERIC_FAILURE }, 401)
  }

  const authClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: verified, error: verifyError } = await authClient.auth.verifyOtp({
    phone: phoneE164 as string,
    token,
    type: 'sms',
  })

  if (verifyError || !verified.session) {
    logLine(cid, 'login_failure', 'denied', 'fn=verify-reset-code reason=bad_code')
    await logEvent(admin, {
      correlationId: cid,
      event: 'login_failure',
      outcome: 'denied',
      phone: phoneE164 as string,
      subject: ip,
      detail: { fn: 'verify-reset-code', reason: 'bad_or_expired_code' },
    })
    return await respondUniform(startedAt, { error: GENERIC_FAILURE }, 401)
  }

  logLine(cid, 'login_success', 'ok', 'fn=verify-reset-code')
  await logEvent(admin, {
    correlationId: cid,
    event: 'login_success',
    outcome: 'ok',
    userId: verified.user?.id ?? null,
    phone: phoneE164 as string,
    subject: ip,
    detail: { fn: 'verify-reset-code', purpose: 'password_reset' },
  })

  return await respondUniform(startedAt, {
    session: verified.session,
    user: { id: verified.user?.id },
  })
})
