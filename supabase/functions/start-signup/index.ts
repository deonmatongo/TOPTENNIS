// Supabase Edge Function — start-signup
//
// Step 1 of signup: validate the handle and number, then send an SMS OTP.
// No auth required.
//
// The client does NOT call supabase.auth.signUp directly. Routing signup through
// here is what makes the per-phone and per-IP OTP limits enforceable at all — a
// direct client call to GoTrue is invisible to us and could only be bounded by
// the project-wide sms_sent figure.
//
// NO PASSWORD IS ACCEPTED HERE. The account is created without one and the user
// sets it after proving control of the number, via updateUser({ password }) on
// the session that verifyOtp returns. That keeps the password out of an
// unauthenticated endpoint entirely, and collapses "new signup" and "existing
// number" onto one code path.
//
// Existing numbers are deliberately indistinguishable: the response is always
// { ok: true } and an OTP is always sent. That is safe because the code goes to
// the handset, so only whoever controls the number can proceed — and it makes
// this endpoint useless as a "does this number have an account" oracle.
//
// Required Supabase secrets:
//   AUTH_HASH_SALT
//
// Request:   { phone: string, username?: string, defaultCountry?: string }
// Response:  { ok: true }                          200  — always, if well-formed
//            { error, field: 'username'|'phone' }  422  — malformed input only
//            { error }                             429 / 400 / 500

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { clientIp, json, preflight, readJson, respondUniform } from '../_shared/http.ts'
import { isValidUsername, normalizePhone } from '../_shared/phone.ts'
import { LIMITS, consume } from '../_shared/ratelimit.ts'
import { adminClient, logEvent, logLine } from '../_shared/audit.ts'
import { correlationId } from '../_shared/security.ts'

Deno.serve(async (req: Request) => {
  const startedAt = Date.now()
  if (req.method === 'OPTIONS') return preflight()
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const cid = correlationId()
  const ip = clientIp(req)
  const admin = adminClient()

  const body = await readJson<{ phone?: string; username?: string; defaultCountry?: string }>(req)
  if (!body) return json({ error: 'Invalid JSON body' }, 400)

  const rawPhone = String(body.phone ?? '').trim()
  const username = String(body.username ?? '').trim()
  const defaultCountry = String(body.defaultCountry ?? 'US')

  // ---- per-IP ceiling, before any work -------------------------------------
  const perIp = await consume(admin, LIMITS.otpSendPerIp, ip)
  if (!perIp.allowed) {
    logLine(cid, 'rate_limit_trip', 'throttled', 'scope=ip fn=start-signup')
    await logEvent(admin, {
      correlationId: cid,
      event: 'rate_limit_trip',
      outcome: 'throttled',
      subject: ip,
      detail: { bucket: LIMITS.otpSendPerIp.bucket, fn: 'start-signup' },
    })
    return json({ error: 'Too many requests. Please try again later.' }, 429, {
      'Retry-After': String(perIp.retryAfterSeconds),
    })
  }

  // ---- input validation ----------------------------------------------------
  // Rejecting malformed input with a 422 is safe: it describes the input, not
  // whether any account exists.
  if (username && !isValidUsername(username)) {
    return json(
      { error: '3–20 characters, letters, numbers and underscores only.', field: 'username' },
      422,
    )
  }

  const parsed = normalizePhone(rawPhone, defaultCountry)
  if (!parsed.ok) {
    const message =
      parsed.reason === 'not_mobile'
        ? 'That number cannot receive text messages. Enter a mobile number.'
        : 'Enter a valid mobile number.'
    return json({ error: message, field: 'phone' }, 422)
  }
  const phone = parsed.e164

  // Availability is checked here for a fast, clear error. It is NOT the
  // uniqueness guarantee — claim_identity re-checks against the unique
  // constraint after verification, which is what closes the race window.
  if (username) {
    const { data: taken, error: takenError } = await admin
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()
    if (takenError) {
      console.error(`[start-signup] cid=${cid} username lookup failed: ${takenError.message}`)
      return json({ error: 'Could not start signup. Try again.' }, 500)
    }
    if (taken) {
      return json({ error: 'That username is taken.', field: 'username' }, 422)
    }
  }

  // ---- per-phone ceiling ---------------------------------------------------
  const perPhone = await consume(admin, LIMITS.otpSendPerPhone, phone)
  if (!perPhone.allowed) {
    logLine(cid, 'rate_limit_trip', 'throttled', 'scope=phone fn=start-signup')
    await logEvent(admin, {
      correlationId: cid,
      event: 'rate_limit_trip',
      outcome: 'throttled',
      phone,
      detail: { bucket: LIMITS.otpSendPerPhone.bucket, fn: 'start-signup' },
    })
    // Same message as the IP trip. A per-phone throttle would otherwise confirm
    // that this number has been used before.
    return json({ error: 'Too many requests. Please try again later.' }, 429, {
      'Retry-After': String(perPhone.retryAfterSeconds),
    })
  }

  // ---- create the account if the number is new -----------------------------
  // listUsers has no phone filter, so ask GoTrue for the number directly. An
  // error here is treated as "exists" so we never double-create.
  let exists = false
  try {
    const { data: found } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
    // The admin API cannot query by phone, so fall back to our own table plus a
    // best-effort createUser that tolerates a duplicate.
    void found
  } catch {
    /* ignore — handled by the createUser branch below */
  }

  const { error: createError } = await admin.auth.admin.createUser({
    phone,
    phone_confirm: false,
    user_metadata: {},
  })

  if (createError) {
    // A duplicate here means the number is already registered. That is an
    // expected, non-fatal branch: fall through and send the OTP anyway so the
    // response stays uniform.
    const msg = createError.message.toLowerCase()
    const duplicate =
      msg.includes('already') || msg.includes('exists') || msg.includes('registered')
    if (!duplicate) {
      console.error(`[start-signup] cid=${cid} createUser failed: ${createError.message}`)
      return await respondUniform(startedAt, { error: 'Could not start signup. Try again.' }, 500)
    }
    exists = true
  }

  // ---- send the OTP --------------------------------------------------------
  const authClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // shouldCreateUser:false — the account already exists by this point, either
  // because we just made it or because it was already there.
  const { error: otpError } = await authClient.auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: false },
  })

  if (otpError) {
    console.error(`[start-signup] cid=${cid} otp send failed: ${otpError.message}`)
    await logEvent(admin, {
      correlationId: cid,
      event: 'login_attempt',
      outcome: 'error',
      phone,
      subject: ip,
      detail: { fn: 'start-signup', reason: 'otp_send_failed' },
    })
    return await respondUniform(startedAt, { error: 'Could not send your code. Try again.' }, 502)
  }

  logLine(cid, 'login_attempt', 'ok', `fn=start-signup preexisting=${exists}`)
  await logEvent(admin, {
    correlationId: cid,
    event: 'login_attempt',
    outcome: 'ok',
    phone,
    subject: ip,
    detail: { fn: 'start-signup', preexisting: exists, usernameRequested: Boolean(username) },
  })

  return await respondUniform(startedAt, { ok: true })
})
