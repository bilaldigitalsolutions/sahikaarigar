// =============================================================================
// SahiKaarigar auth-server — strict ID validation (page 3: Trust in data)
// =============================================================================
// Shared validators used BEFORE anything is written to Supabase:
//   verhoeffPasses()  — the UIDAI Aadhaar checksum (Verhoeff algorithm)
//   isValidAadhaar()  — 12 digits + checksum (may be optional, never fake)
//   isBlockedFakeSequence() — obviously fake phone/test sequences
// =============================================================================

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
 * digit) passes. Callers enforce lengths on top of the algorithm itself.
 */
export function verhoeffPasses(digits) {
  let checksum = 0;
  // Digits right→left; position i (0-based from the right) uses row i % 8.
  for (let i = 0; i < digits.length; i += 1) {
    const digit = Number(digits[digits.length - 1 - i]);
    checksum = D[checksum][P[i % 8][digit] ?? digit];
  }
  return INV[checksum] === 0;
}

/**
 * Aadhaar format check — exactly 12 digits AND the UIDAI Verhoeff checksum.
 * Non-blocking fake-register data (1234…, repeated digits) fails Verhoeff,
 * so no extra blocklist is needed here.
 */
export function isValidAadhaar(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length !== 12) return false;
  // 000000000000 / 111111111111 etc. can slip past some checksums — block.
  if (/^(\d)\1{11}$/.test(digits)) return false;
  return verhoeffPasses(digits);
}

/**
 * Known fake/test phone sequences we refuse:
 *   0000000000, 1111111111 … 9999999999 (all-same-digit),
 *   0123456789 / 1234567890 / 9876543210 (straight runs).
 */
export function isBlockedFakeSequence(phone) {
  if (!/^\d{10}$/.test(phone)) return false;
  if (/^(\d)\1{9}$/.test(phone)) return true; // 0000000000 … 9999999999
  const chars = [...String(phone)].map(Number);
  // Cyclic runs — 0123456789 / 1234567890 / 9876543210 / 9012345678 …
  const ascending = chars.every((d, i) => i === 0 || d === (chars[i - 1] + 1) % 10);
  const descending = chars.every((d, i) => i === 0 || d === (chars[i - 1] + 9) % 10);
  return ascending || descending;
}
