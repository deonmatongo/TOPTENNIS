// Hashing and masking used by the auth Edge Functions.
//
// Required Supabase secret:
//   AUTH_HASH_SALT  — random 32+ byte string, set via `supabase secrets set`
//
// Nothing here is reversible on purpose. Rate-limit rows and audit rows must
// never contain a phone number or an IP address in the clear, so both are
// reduced to a salted digest before they touch the database.

const SALT = Deno.env.get('AUTH_HASH_SALT')

if (!SALT || SALT.length < 16) {
  // Fail loudly at cold start rather than silently writing weakly-salted
  // hashes that would be trivially reversible for a 10-digit number.
  throw new Error('AUTH_HASH_SALT is missing or shorter than 16 characters')
}

/** Salted SHA-256, hex encoded. Used as a rate-limit / audit subject key. */
export async function subjectHash(value: string): Promise<string> {
  const data = new TextEncoder().encode(`${SALT}:${value}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Last 4 digits only — the most that may ever be logged for a phone number. */
export function phoneLast4(phoneE164: string): string | null {
  const digits = phoneE164.replace(/\D/g, '')
  return digits.length >= 4 ? digits.slice(-4) : null
}

/** Correlation ID tying every log line for one request together. */
export function correlationId(): string {
  return crypto.randomUUID()
}
