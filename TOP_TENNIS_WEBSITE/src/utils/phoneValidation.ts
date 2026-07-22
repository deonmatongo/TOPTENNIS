/**
 * Phone validation utilities — US-focused (E.164 preferred).
 * Accepts full E.164 (+12125551234) or local digits (2125551234).
 */

const DIAL_CODES = [
  { dial: '+1', label: 'USA / Canada' },
] as const;

export type DialCode = typeof DIAL_CODES[number]['dial'];

/**
 * Lightly format while the user types — strips non-numeric chars except
 * a leading '+'. Preserves E.164 input like "+263771234567" untouched.
 */
export const formatPhoneNumber = (value: string): string => {
  // If it looks like E.164, don't reformat it
  if (/^\+\d+/.test(value)) return value;
  // Otherwise keep only digits
  return value.replace(/\D/g, '');
};

export const getPhoneValidationError = (phoneNumber: string): string | null => {
  if (!phoneNumber.trim()) return 'Phone number is required';

  const digits = phoneNumber.replace(/\D/g, '');

  if (digits.length < 7)  return 'Phone number is too short';
  if (digits.length > 15) return 'Phone number is too long';

  return null;
};

/**
 * Try to parse a phone string from the registration form into the
 * { dialCode, local } shape expected by WhatsAppOTPVerification.
 * Returns null when no known prefix can be detected.
 */
export const parsePhoneForPrefill = (
  phone: string,
): { dialCode: DialCode; local: string } | null => {
  const cleaned = phone.trim();

  // Match a known E.164 prefix
  for (const { dial } of DIAL_CODES) {
    if (cleaned.startsWith(dial)) {
      return { dialCode: dial as DialCode, local: cleaned.slice(dial.length) };
    }
  }

  // No prefix found — treat as local US digits
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length >= 7) {
    return { dialCode: '+1', local: digits };
  }

  return null;
};