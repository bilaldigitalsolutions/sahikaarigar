// Aadhaar number validation — Verhoeff algorithm.
//
// UIDAI validates Aadhaar numbers with the Verhoeff checksum, so a 12-digit
// string that fails it can never be a real Aadhaar number. The lookup tables
// below are the standard Verhoeff tables; see
// https://en.wikipedia.org/wiki/Verhoeff_algorithm.

/** Verhoeff digit multiplication table. */
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

/** Verhoeff digit permutation table. */
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 2, 0, 5, 8, 7, 3, 1, 6],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/** Verhoeff modular-inverse index used for the final checksum test. */
const INV = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

/**
 * Verhoeff checksum test — true when the digit string (including its check
 * digit) passes. Any length is accepted by the algorithm itself; callers
 * enforce the 12-digit Aadhaar length on top of it.
 */
export function verhoeffPasses(digits: string): boolean {
  let checksum = 0;
  // Walk the digits right→left; position i (0-based from the right) uses
  // permutation row i % 8 — the standard Verhoeff validation loop.
  for (let i = 0; i < digits.length; i += 1) {
    const digit = Number(digits[digits.length - 1 - i]);
    checksum = D[checksum][P[i % 8][digit] ?? digit];
  }
  return INV[checksum] === 0;
}

export interface AadhaarValidation {
  valid: boolean;
  /** User-facing Hinglish error, null when valid. */
  error: string | null;
}

/**
 * Validate an Aadhaar number: exactly 12 digits + the UIDAI Verhoeff checksum.
 * Returns the raw verdict — the UI maps `error` to the red helper text.
 */
export function validateAadhaar(aadhaar: string): AadhaarValidation {
  const digits = String(aadhaar ?? '').replace(/\D/g, '');
  if (digits.length !== 12) {
    return { valid: false, error: 'Kripya valid 12-digit Aadhaar number daalein.' };
  }
  // 000000000000 / 111111111111 etc. can slip past some checksums — block.
  if (/^(\d)\1{11}$/.test(digits)) {
    return { valid: false, error: 'Kripya valid 12-digit Aadhaar number daalein.' };
  }
  if (!verhoeffPasses(digits)) {
    return { valid: false, error: 'Kripya valid 12-digit Aadhaar number daalein.' };
  }
  return { valid: true, error: null };
}

/** True only for a genuinely valid 12-digit Aadhaar number. */
export function isValidAadhaar(aadhaar: string): boolean {
  return validateAadhaar(aadhaar).valid;
}

/** Format 12 digits as the official XXXX XXXX XXXX layout for typing. */
export function formatAadhaar(aadhaar: string): string {
  const digits = String(aadhaar ?? '').replace(/\D/g, '');
  return [digits.slice(0, 4), digits.slice(4, 8), digits.slice(8, 12)]
    .filter(Boolean)
    .join(' ');
}
