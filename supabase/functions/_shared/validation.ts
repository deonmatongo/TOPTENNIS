// Username validation, shared between check-username and the DB-side
// claim_username() constraint.

export const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/

/** Mirrors the profiles_username_format_chk constraint in the database. */
export function isValidUsername(value: string): boolean {
  return USERNAME_RE.test((value ?? '').trim())
}
