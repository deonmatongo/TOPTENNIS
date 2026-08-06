// Server-side rate limiting, backed by public.consume_rate_limit().
//
// The counter increments in a single SQL statement, so two concurrent requests
// cannot both observe a stale count and both conclude they are under the limit.
// Client-side timers (the 30s resend cooldown, for example) are UX only and are
// never trusted here.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { subjectHash } from './security.ts'

export type Limit = { bucket: string; limit: number; windowSeconds: number }

/** Named limits, so every call site reads the same numbers. */
export const LIMITS = {
  /** Debounced availability lookups while the user types. Per IP. */
  usernameCheckPerIp: { bucket: 'username_check:ip', limit: 120, windowSeconds: 3600 },

  /** OTP sends we control: the password-reset path. Per phone number. */
  otpSendPerPhone: { bucket: 'otp_send:phone', limit: 3, windowSeconds: 3600 },
  /** OTP sends we control: the password-reset path. Per IP. */
  otpSendPerIp: { bucket: 'otp_send:ip', limit: 10, windowSeconds: 3600 },

  /** Login attempts per IP, regardless of which account is targeted. */
  loginPerIp: { bucket: 'login:ip', limit: 30, windowSeconds: 900 },
  /** Failed logins per account. Drives the progressive backoff below. */
  loginFailPerAccount: { bucket: 'login_fail:account', limit: 5, windowSeconds: 900 },
} as const satisfies Record<string, Limit>

export type RateResult = {
  allowed: boolean
  hits: number
  retryAfterSeconds: number
}

/**
 * Increment and test one counter. `subject` is hashed before it is stored, so a
 * phone number or IP never lands in the table in the clear.
 *
 * Fails OPEN on a database error: an outage in the ledger must not lock every
 * user out of signing in. The trip is logged by the caller either way.
 */
export async function consume(
  admin: SupabaseClient,
  limit: Limit,
  subject: string,
): Promise<RateResult> {
  const hash = await subjectHash(subject)
  const { data, error } = await admin.rpc('consume_rate_limit', {
    p_bucket: limit.bucket,
    p_subject_hash: hash,
    p_limit: limit.limit,
    p_window_seconds: limit.windowSeconds,
  })

  if (error) {
    console.error(`[ratelimit] ${limit.bucket} ledger error: ${error.message}`)
    return { allowed: true, hits: 0, retryAfterSeconds: 0 }
  }

  const row = Array.isArray(data) ? data[0] : data
  return {
    allowed: row?.allowed ?? true,
    hits: row?.hits ?? 0,
    retryAfterSeconds: row?.retry_after_seconds ?? 0,
  }
}

/**
 * Read the current window's count without incrementing it.
 *
 * Use this to decide whether to throttle; use `consume` only to record an event
 * that should count against the limit. Reading with `consume` would make every
 * successful login count as a failure.
 */
export async function peek(
  admin: SupabaseClient,
  limit: Limit,
  subject: string,
): Promise<number> {
  const hash = await subjectHash(subject)
  const { data, error } = await admin.rpc('peek_rate_limit', {
    p_bucket: limit.bucket,
    p_subject_hash: hash,
    p_window_seconds: limit.windowSeconds,
  })
  if (error) {
    console.error(`[ratelimit] ${limit.bucket} peek error: ${error.message}`)
    return 0
  }
  return typeof data === 'number' ? data : 0
}

/** Clear a counter — called when a correct password ends a failure streak. */
export async function reset(
  admin: SupabaseClient,
  limit: Limit,
  subject: string,
): Promise<void> {
  const hash = await subjectHash(subject)
  const { error } = await admin.rpc('reset_rate_limit', {
    p_bucket: limit.bucket,
    p_subject_hash: hash,
  })
  if (error) console.error(`[ratelimit] ${limit.bucket} reset error: ${error.message}`)
}

/**
 * Progressive backoff for repeated login failures against one account.
 *
 * Doubles per failure past the threshold and caps at 5 minutes. The window
 * expires on its own, so an account is slowed but never permanently locked —
 * a permanent lock would hand any attacker a denial-of-service primitive
 * against a known username.
 */
export function backoffSeconds(failureHits: number, threshold = LIMITS.loginFailPerAccount.limit): number {
  if (failureHits <= threshold) return 0
  const over = failureHits - threshold
  return Math.min(2 ** over, 300)
}
