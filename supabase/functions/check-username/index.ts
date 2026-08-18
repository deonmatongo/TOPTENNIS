// Supabase Edge Function — check-username
//
// Debounced username availability for the signup screen. No auth required.
//
// Deliberately an Edge Function rather than a client-side table read: the
// profiles SELECT policy would let a client enumerate every handle in the
// database, and the anon key would let it do so without a rate limit.
//
// Required Supabase secrets:
//   AUTH_HASH_SALT
//   (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the platform)
//
// Request:   { username: string }
// Response:  { available: boolean }               200
//            { available: false, reason: string } 200  — malformed handle
//            { error: string }                   429 / 500

import { clientIp, json, preflight, readJson, respondUniform } from '../_shared/http.ts'
import { isValidUsername } from '../_shared/validation.ts'
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

  const body = await readJson<{ username?: string }>(req)
  if (!body) return json({ error: 'Invalid JSON body' }, 400)

  const username = String(body.username ?? '').trim()

  const perIp = await consume(admin, LIMITS.usernameCheckPerIp, ip)
  if (!perIp.allowed) {
    logLine(cid, 'username_check', 'throttled', `ip_hits=${perIp.hits}`)
    await logEvent(admin, {
      correlationId: cid,
      event: 'rate_limit_trip',
      outcome: 'throttled',
      subject: ip,
      detail: { bucket: LIMITS.usernameCheckPerIp.bucket },
    })
    return json({ error: 'Too many requests. Please slow down.' }, 429, {
      'Retry-After': String(perIp.retryAfterSeconds),
    })
  }

  // Format is checked here as well as in the DB CHECK constraint. Returning
  // early is safe: a malformed handle reveals nothing about who exists.
  if (!isValidUsername(username)) {
    return json({
      available: false,
      reason: '3–20 characters, letters, numbers and underscores only.',
    })
  }

  // citext column, so this comparison is already case-insensitive.
  const { data, error } = await admin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle()

  if (error) {
    console.error(`[check-username] cid=${cid} lookup failed: ${error.message}`)
    return json({ error: 'Could not check that username. Try again.' }, 500)
  }

  const available = data === null

  logLine(cid, 'username_check', 'ok', `available=${available}`)
  await logEvent(admin, {
    correlationId: cid,
    event: 'username_check',
    outcome: 'ok',
    subject: ip,
    detail: { available },
  })

  // Padded so availability cannot be inferred from response time, only from the
  // (intentionally public) boolean.
  return await respondUniform(startedAt, { available })
})
