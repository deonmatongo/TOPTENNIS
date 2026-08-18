// Supabase Edge Function — get-security-question
//
// Step 1 of "forgot password". Takes an email, resolves it server-side, and
// returns the security question the user set at signup. No auth required.
//
// The response is a real question for a real account, but a plausible-looking
// GENERIC question for an unknown email or an account with none set. The
// caller cannot use this endpoint to test whether an email is registered.
//
// Required Supabase secrets:
//   AUTH_HASH_SALT
//
// Request:   { email: string }
// Response:  { question: string }   200  — always, for any well-formed email
//            { error }              429 / 400

import { clientIp, json, preflight, readJson, respondUniform } from '../_shared/http.ts'
import { LIMITS, consume } from '../_shared/ratelimit.ts'
import { adminClient, logEvent, logLine } from '../_shared/audit.ts'
import { correlationId } from '../_shared/security.ts'

/** Shown for any email that does not resolve to an account with a question set. */
const FALLBACK_QUESTION = 'What was the name of your first pet?'

Deno.serve(async (req: Request) => {
  const startedAt = Date.now()
  if (req.method === 'OPTIONS') return preflight()
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const cid = correlationId()
  const ip = clientIp(req)
  const admin = adminClient()

  const body = await readJson<{ email?: string }>(req)
  if (!body) return json({ error: 'Invalid JSON body' }, 400)

  const email = String(body.email ?? '').trim()

  // Per-IP ceiling first, so an attacker cannot walk an email list from one
  // host. This is the only branch that may return non-200 for a well-formed
  // request, and it depends on the caller's own behaviour, not on the target.
  const perIp = await consume(admin, LIMITS.securityQuestionPerIp, ip)
  if (!perIp.allowed) {
    logLine(cid, 'reset_requested', 'throttled', `scope=ip fn=get-security-question hits=${perIp.hits}`)
    await logEvent(admin, {
      correlationId: cid,
      event: 'rate_limit_trip',
      outcome: 'throttled',
      subject: ip,
      detail: { bucket: LIMITS.securityQuestionPerIp.bucket, fn: 'get-security-question' },
    })
    return json({ error: 'Too many requests. Please try again later.' }, 429, {
      'Retry-After': String(perIp.retryAfterSeconds),
    })
  }

  let question = FALLBACK_QUESTION
  let found = false

  if (email) {
    const { data: userId, error: resolveError } = await admin.rpc('resolve_user_id_by_email', {
      p_email: email,
    })

    if (resolveError) {
      console.error(`[get-security-question] cid=${cid} resolve failed: ${resolveError.message}`)
    } else if (userId) {
      // Per-email ceiling: only applied once an account is known to exist, so
      // an unknown email never trips a limit that would confirm non-existence.
      const perEmail = await consume(admin, LIMITS.securityQuestionPerEmail, email.toLowerCase())
      if (!perEmail.allowed) {
        logLine(cid, 'rate_limit_trip', 'throttled', 'scope=email fn=get-security-question')
        await logEvent(admin, {
          correlationId: cid,
          event: 'rate_limit_trip',
          outcome: 'throttled',
          subject: email.toLowerCase(),
          detail: { bucket: LIMITS.securityQuestionPerEmail.bucket, fn: 'get-security-question' },
        })
        return json({ error: 'Too many requests. Please try again later.' }, 429, {
          'Retry-After': String(perEmail.retryAfterSeconds),
        })
      }

      const { data: storedQuestion, error: questionError } = await admin.rpc('get_security_question', {
        p_user_id: userId,
      })
      if (questionError) {
        console.error(`[get-security-question] cid=${cid} question lookup failed: ${questionError.message}`)
      } else if (storedQuestion) {
        question = storedQuestion as string
        found = true
      }
    }
  }

  logLine(cid, 'reset_requested', 'ok', `fn=get-security-question found=${found}`)
  await logEvent(admin, {
    correlationId: cid,
    event: 'reset_requested',
    outcome: 'ok',
    subject: ip,
    detail: { fn: 'get-security-question', found },
  })

  // Identical shape for every input. Do not add a branch above this line that
  // returns a different body or status for a well-formed email.
  return await respondUniform(startedAt, { question })
})
