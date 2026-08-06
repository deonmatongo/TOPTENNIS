// Auth event logging.
//
// Every row carries a correlation ID so one request can be followed across
// functions. What must never appear in here:
//   * OTP codes
//   * passwords
//   * access or refresh tokens
//   * full phone numbers  (only phoneLast4 is accepted, and the auth_events
//                          CHECK constraint enforces that independently)
//
// Logging is best-effort. A failure to write an audit row must not fail the
// request that triggered it.

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { phoneLast4, subjectHash } from './security.ts'

export type AuthEvent =
  | 'username_check'
  | 'login_attempt'
  | 'login_success'
  | 'login_failure'
  | 'reset_requested'
  | 'rate_limit_trip'

export type Outcome = 'ok' | 'denied' | 'error' | 'throttled'

/** Service-role client. Bypasses RLS, so it never leaves an Edge Function. */
export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function logEvent(
  admin: SupabaseClient,
  args: {
    correlationId: string
    event: AuthEvent
    outcome: Outcome
    userId?: string | null
    /** Full E.164 accepted here and immediately reduced to its last 4 digits. */
    phone?: string | null
    /** Raw IP or identifier; hashed before storage. */
    subject?: string | null
    detail?: Record<string, unknown>
  },
): Promise<void> {
  try {
    await admin.from('auth_events').insert({
      correlation_id: args.correlationId,
      event: args.event,
      outcome: args.outcome,
      user_id: args.userId ?? null,
      phone_last4: args.phone ? phoneLast4(args.phone) : null,
      subject_hash: args.subject ? await subjectHash(args.subject) : null,
      detail: args.detail ?? null,
    })
  } catch (err) {
    console.error(`[audit] ${args.correlationId} failed to record ${args.event}:`, err)
  }
}

/** Structured console line, mirroring the row without any PII. */
export function logLine(correlationId: string, event: string, outcome: string, extra = '') {
  console.log(`[auth] cid=${correlationId} event=${event} outcome=${outcome} ${extra}`.trim())
}
