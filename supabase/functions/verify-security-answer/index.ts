// Supabase Edge Function — verify-security-answer
//
// Step 2 of "forgot password": check the answer against the stored hash and,
// if it matches, mint a short-lived session so the client can call
// updateUser({ password }) same as it does today. No auth required.
//
// Minting the session reuses admin.generateLink({ type: 'recovery' }), which
// creates a recovery token without sending any email — nothing is dispatched
// here, it is purely a server-side token mint. The anon client then exchanges
// that token for a session via verifyOtp(), exactly mirroring how the old
// phone flow turned a verified OTP into a session. No SMS, no email, no cost.
//
// Required Supabase secrets:
//   AUTH_HASH_SALT
//
// Request:   { email: string, answer: string }
// Response:  { session, user }   200
//            { error }           401 / 429 / 400 / 500

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { clientIp, json, preflight, readJson, respondUniform } from '../_shared/http.ts'
import { LIMITS, consume } from '../_shared/ratelimit.ts'
import { adminClient, logEvent, logLine } from '../_shared/audit.ts'
import { correlationId } from '../_shared/security.ts'

/** One message for every failure mode: wrong answer, no such account, no question set. */
const GENERIC_FAILURE = 'That answer is incorrect. Try again.'

Deno.serve(async (req: Request) => {
  const startedAt = Date.now()
  if (req.method === 'OPTIONS') return preflight()
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const cid = correlationId()
  const ip = clientIp(req)
  const admin = adminClient()

  const body = await readJson<{ email?: string; answer?: string }>(req)
  if (!body) return json({ error: 'Invalid JSON body' }, 400)

  const email = String(body.email ?? '').trim()
  const answer = String(body.answer ?? '').trim()

  if (!email || !answer) {
    return await respondUniform(startedAt, { error: GENERIC_FAILURE }, 401)
  }

  // Per-IP ceiling on verification attempts — bounds sweeping across many
  // accounts from one host.
  const perIp = await consume(admin, LIMITS.securityAnswerPerIp, ip)
  if (!perIp.allowed) {
    logLine(cid, 'rate_limit_trip', 'throttled', 'fn=verify-security-answer scope=ip')
    await logEvent(admin, {
      correlationId: cid,
      event: 'rate_limit_trip',
      outcome: 'throttled',
      subject: ip,
      detail: { bucket: LIMITS.securityAnswerPerIp.bucket, fn: 'verify-security-answer' },
    })
    return json({ error: 'Too many attempts. Please try again shortly.' }, 429, {
      'Retry-After': String(perIp.retryAfterSeconds),
    })
  }

  const { data: userId, error: resolveError } = await admin.rpc('resolve_user_id_by_email', {
    p_email: email,
  })

  if (resolveError) {
    console.error(`[verify-security-answer] cid=${cid} resolve failed: ${resolveError.message}`)
    return await respondUniform(startedAt, { error: 'Something went wrong. Try again.' }, 500)
  }

  if (!userId) {
    logLine(cid, 'login_failure', 'denied', 'fn=verify-security-answer reason=unknown_email')
    return await respondUniform(startedAt, { error: GENERIC_FAILURE }, 401)
  }

  // Per-email ceiling: this is the actual brake on guessing the answer. Only
  // applied once the account is known to exist, same reasoning as
  // get-security-question.
  const perEmail = await consume(admin, LIMITS.securityAnswerPerEmail, email.toLowerCase())
  if (!perEmail.allowed) {
    logLine(cid, 'rate_limit_trip', 'throttled', 'fn=verify-security-answer scope=email')
    await logEvent(admin, {
      correlationId: cid,
      event: 'rate_limit_trip',
      outcome: 'throttled',
      subject: email.toLowerCase(),
      detail: { bucket: LIMITS.securityAnswerPerEmail.bucket, fn: 'verify-security-answer' },
    })
    return json({ error: 'Too many attempts. Please try again shortly.' }, 429, {
      'Retry-After': String(perEmail.retryAfterSeconds),
    })
  }

  const { data: correct, error: verifyError } = await admin.rpc('verify_security_answer', {
    p_user_id: userId,
    p_answer: answer,
  })

  if (verifyError) {
    console.error(`[verify-security-answer] cid=${cid} verify failed: ${verifyError.message}`)
    return await respondUniform(startedAt, { error: 'Something went wrong. Try again.' }, 500)
  }

  if (!correct) {
    logLine(cid, 'login_failure', 'denied', 'fn=verify-security-answer reason=bad_answer')
    await logEvent(admin, {
      correlationId: cid,
      event: 'login_failure',
      outcome: 'denied',
      userId,
      subject: email.toLowerCase(),
      detail: { fn: 'verify-security-answer', reason: 'bad_answer' },
    })
    return await respondUniform(startedAt, { error: GENERIC_FAILURE }, 401)
  }

  // Mint a session for the verified account. No email is sent — generateLink
  // only creates the token; nothing here dispatches it anywhere.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
  })

  const hashedToken = link?.properties?.hashed_token
  if (linkError || !hashedToken) {
    console.error(`[verify-security-answer] cid=${cid} generateLink failed: ${linkError?.message}`)
    return await respondUniform(startedAt, { error: 'Could not verify that answer. Try again.' }, 500)
  }

  const authClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: verified, error: exchangeError } = await authClient.auth.verifyOtp({
    email,
    token: hashedToken,
    type: 'recovery',
  })

  if (exchangeError || !verified.session) {
    console.error(`[verify-security-answer] cid=${cid} token exchange failed: ${exchangeError?.message}`)
    return await respondUniform(startedAt, { error: 'Could not verify that answer. Try again.' }, 500)
  }

  logLine(cid, 'login_success', 'ok', 'fn=verify-security-answer')
  await logEvent(admin, {
    correlationId: cid,
    event: 'login_success',
    outcome: 'ok',
    userId: verified.user?.id ?? null,
    subject: email.toLowerCase(),
    detail: { fn: 'verify-security-answer', purpose: 'password_reset' },
  })

  // Only the two tokens setSession needs — see the same note in the old
  // verify-reset-code about not shipping the nested user object wholesale.
  return await respondUniform(startedAt, {
    session: {
      access_token: verified.session.access_token,
      refresh_token: verified.session.refresh_token,
    },
    user: { id: verified.user?.id },
  })
})
