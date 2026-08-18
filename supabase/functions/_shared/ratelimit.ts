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

  /** Security-question lookups on the reset flow. Per email. */
  securityQuestionPerEmail: { bucket: 'security_question:email', limit: 5, windowSeconds: 3600 },
  /** Security-question lookups on the reset flow. Per IP. */
  securityQuestionPerIp: { bucket: 'security_question:ip', limit: 20, windowSeconds: 3600 },

  /** Security-answer submissions. Per email — this is the guess-the-answer brake. */
  securityAnswerPerEmail: { bucket: 'security_answer:email', limit: 5, windowSeconds: 3600 },
  /** Security-answer submissions. Per IP. */
  securityAnswerPerIp: { bucket: 'security_answer:ip', limit: 20, windowSeconds: 3600 },
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

