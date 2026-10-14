// =============================================================================
// SahiKaarigar — verify a Firebase ID token inside an Edge Function
// =============================================================================
// Uses Google's public JWKS for the project, so no service-account key (and no
// firebase-admin dependency) is needed at runtime.
// =============================================================================

import { createRemoteJWKSet, jwtVerify } from 'https://esm.sh/jose@5';

const FIREBASE_PROJECT_ID = 'sahi-kaarigar';

const JWKS = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  ),
);

export interface FirebaseUser {
  uid: string;
  phone: string;
  email?: string;
}

/**
 * Firebase returns phone numbers as "+919876543210" while Postgres stores the
 * 10-digit Indian format ("9876543210").
 */
export function normalizeIndianPhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

export async function verifyFirebaseToken(token: string): Promise<FirebaseUser> {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    audience: FIREBASE_PROJECT_ID,
  });

  const uid = String(payload.sub ?? payload.user_id ?? '');
  if (!uid) throw new Error('Token does not contain a user id');

  return {
    uid,
    phone: normalizeIndianPhone(String(payload.phone_number ?? '')),
    email: payload.email ? String(payload.email) : undefined,
  };
}
