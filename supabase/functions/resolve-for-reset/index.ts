// Supabase Edge Function — resolve-for-reset
//
// Step 1 of "forgot password". Takes a username or phone number, resolves it
// server-side, and sends an SMS OTP. No auth required.
//
// The response is IDENTICAL whether or not the account exists — same body, same
// status, same padded duration. The caller learns nothing. This is the whole
// reason the endpoint exists instead of the client calling signInWithOtp.
//
// This is also the one OTP send path the spec's per-phone and per-IP limits can
// actually be enforced on, because the send happens here. Signup OTPs are sent
// by GoTrue in response to a direct client signUp call, so those are bounded by
// the project's [auth.rate_limit] sms_sent setting, Twilio Verify's own
// per-number caps, and the Turnstile captcha instead.
//
// Required Supabase secrets:
//   AUTH_HASH_SALT
//
// Request:   { identifier: string, defaultCountry?: string }
// Response:  { ok: true }   200  — always, for any input
//            { error }      429 / 400

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { clientIp, json, preflight, readJson, respondUniform } from '../_shared/http.ts'
import { classifyIdentifier } from '../_shared/phone.ts'
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

  const body = await readJson<{ identifier?: string; defaultCountry?: string }>(req)
  if (!body) return json({ error: 'Invalid JSON body' }, 400)

  const identifier = String(body.identifier ?? '').trim()
  const defaultCountry = String(body.defaultCountry ?? 'US')

  // Per-IP ceiling first, so an attacker cannot walk a username list from one
  // host. This is the only branch that may return non-200 for a well-formed
  // request, and it depends on the caller's own behaviour, not on the target.
  const perIp = await consume(admin, LIMITS.otpSendPerIp, ip)
  if (!perIp.allowed) {
    logLine(cid, 'reset_requested', 'throttled', `scope=ip hits=${perIp.hits}`)
    await logEvent(admin, {
      correlationId: cid,
      event: 'rate_limit_trip',
      outcome: 'throttled',
      subject: ip,
      detail: { bucket: LIMITS.otpSendPerIp.bucket },
    })
    return json({ error: 'Too many requests. Please try again later.' }, 429, {
      'Retry-After': String(perIp.retryAfterSeconds),
    })
  }

  const parsed = classifyIdentifier(identifier, defaultCountry)

  // From here every exit is the same 200 { ok: true }. `sent` is recorded in the
  // audit log so you can still see what really happened.
  let sent = false
  let reason = 'unknown_identifier'
  let resolvedPhone: string | null = null

  if (parsed.kind !== 'invalid') {
    const lookup = parsed.kind === 'phone' ? parsed.e164 : parsed.username
    const { data: phoneE164, error: resolveError } = await admin.rpc('resolve_phone_for_identifier', {
      p_identifier: lookup,
    })

    if (resolveError) {
      console.error(`[resolve-for-reset] cid=${cid} resolve failed: ${resolveError.message}`)
      reason = 'resolve_error'
    } else if (phoneE164) {
      resolvedPhone = phoneE164 as string

      // Per-phone ceiling: 3 sends per number per hour, so a known number
      // cannot be used to spam someone's handset.
      const perPhone = await consume(admin, LIMITS.otpSendPerPhone, resolvedPhone)
      if (!perPhone.allowed) {
        reason = 'phone_throttled'
        logLine(cid, 'rate_limit_trip', 'throttled', 'scope=phone')
        await logEvent(admin, {
          correlationId: cid,
          event: 'rate_limit_trip',
          outcome: 'throttled',
          phone: resolvedPhone,
          detail: { bucket: LIMITS.otpSendPerPhone.bucket },
        })
      } else {
        const authClient = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_ANON_KEY')!,
          { auth: { autoRefreshToken: false, persistSession: false } },
        )

        // shouldCreateUser:false — a reset must never bring a new account into
        // existence for an unrecognised number.
        const { error: otpError } = await authClient.auth.signInWithOtp({
          phone: resolvedPhone,
          options: { shouldCreateUser: false },
        })

        if (otpError) {
          console.error(`[resolve-for-reset] cid=${cid} otp send failed: ${otpError.message}`)
          reason = 'otp_send_failed'
        } else {
          sent = true
          reason = 'sent'
        }
      }
    }
  } else {
    reason = 'malformed_identifier'
  }

  logLine(cid, 'reset_requested', sent ? 'ok' : 'denied', `reason=${reason}`)
  await logEvent(admin, {
    correlationId: cid,
    event: 'reset_requested',
    outcome: sent ? 'ok' : 'denied',
    phone: resolvedPhone,
    subject: ip,
    detail: { reason, kind: parsed.kind },
  })

  // Identical for every input. Do not add a branch above this line that returns
  // a different body or status for a well-formed identifier.
  return await respondUniform(startedAt, { ok: true })
})
