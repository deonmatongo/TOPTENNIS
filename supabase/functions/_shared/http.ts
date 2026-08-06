// Shared HTTP helpers for the auth Edge Functions.
//
// `respondUniform` is a security control, not a convenience: every auth
// response is padded to the same minimum duration so an attacker cannot tell a
// non-existent account from a wrong password by timing the reply. Any early
// return that skips it reopens the enumeration channel.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** Every auth reply takes at least this long, whatever actually happened. */
const UNIFORM_FLOOR_MS = 600

export function preflight(): Response {
  return new Response('ok', { headers: corsHeaders })
}

export function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  })
}

/**
 * Pad the response so its total wall-clock duration is at least
 * UNIFORM_FLOOR_MS measured from `startedAt`. Callers pass the timestamp taken
 * as the very first thing in the handler.
 */
export async function respondUniform(
  startedAt: number,
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  const elapsed = Date.now() - startedAt
  if (elapsed < UNIFORM_FLOOR_MS) {
    await new Promise((resolve) => setTimeout(resolve, UNIFORM_FLOOR_MS - elapsed))
  }
  return json(body, status, extraHeaders)
}

/**
 * Best-effort client IP. Behind Supabase's edge the left-most entry of
 * x-forwarded-for is the caller. It is attacker-controlled, so it is only ever
 * used as a rate-limit key (hashed) and never as an identity.
 */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers.get('cf-connecting-ip') ?? 'unknown'
}

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T
  } catch {
    return null
  }
}
