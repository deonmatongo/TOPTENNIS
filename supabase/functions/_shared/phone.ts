// Phone parsing and normalisation.
//
// US-primary but not US-only: the number is parsed with US as the default
// region so a bare 10-digit entry works, while an explicitly international
// number (leading +) is still accepted. This mirrors the client, where the
// country picker defaults to US.
//
// Every validation here is duplicated from the client on purpose. The client
// copy is UX; this copy is the control.

import { parsePhoneNumberFromString } from 'https://esm.sh/libphonenumber-js@1.11.17'

export const E164_RE = /^\+[1-9]\d{7,14}$/

export type PhoneResult =
  | { ok: true; e164: string; country: string | undefined }
  | { ok: false; reason: 'unparseable' | 'invalid' | 'not_mobile' }

/**
 * Parse a user-entered number to E.164.
 *
 * `defaultCountry` is only a hint for numbers typed without a country code; an
 * input starting with + is parsed as-is.
 */
export function normalizePhone(raw: string, defaultCountry = 'US'): PhoneResult {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return { ok: false, reason: 'unparseable' }

  const parsed = parsePhoneNumberFromString(
    trimmed,
    trimmed.startsWith('+') ? undefined : (defaultCountry as never),
  )
  if (!parsed) return { ok: false, reason: 'unparseable' }
  if (!parsed.isValid()) return { ok: false, reason: 'invalid' }

  // A landline cannot receive an SMS, so accepting one guarantees a user who
  // can never complete verification. `getType()` returns undefined when the
  // metadata cannot tell mobile from fixed line — allow those through rather
  // than rejecting legitimate numbers on missing metadata.
  const type = parsed.getType()
  if (type && type !== 'MOBILE' && type !== 'FIXED_LINE_OR_MOBILE') {
    return { ok: false, reason: 'not_mobile' }
  }

  const e164 = parsed.number
  if (!E164_RE.test(e164)) return { ok: false, reason: 'invalid' }

  return { ok: true, e164, country: parsed.country }
}

export const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/

/** Mirrors the profiles_username_format_chk constraint in the database. */
export function isValidUsername(value: string): boolean {
  return USERNAME_RE.test((value ?? '').trim())
}

/**
 * Decide whether a login identifier looks like a phone number or a username.
 * Usernames cannot contain +, spaces or punctuation, so anything that parses as
 * a phone number is treated as one.
 */
export function classifyIdentifier(
  raw: string,
  defaultCountry = 'US',
): { kind: 'phone'; e164: string } | { kind: 'username'; username: string } | { kind: 'invalid' } {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return { kind: 'invalid' }

  // Digit-heavy input is a phone attempt even if it fails to parse, otherwise
  // "5551234567" would be looked up as a username.
  const digitCount = (trimmed.match(/\d/g) ?? []).length
  const looksNumeric = trimmed.startsWith('+') || digitCount >= 7

  if (looksNumeric) {
    const parsed = normalizePhone(trimmed, defaultCountry)
    return parsed.ok ? { kind: 'phone', e164: parsed.e164 } : { kind: 'invalid' }
  }

  return isValidUsername(trimmed) ? { kind: 'username', username: trimmed } : { kind: 'invalid' }
}
