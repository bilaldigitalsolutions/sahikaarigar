import { getAdminAuth } from '@/lib/firebase-admin';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { mapUser } from '@/lib/mappers';
import { normalizeIndianPhone } from '@/utils';
import type { User, UserRole } from '@/types';

export interface AuthUser {
  uid: string;
  phone: string;
  email?: string;
}

/**
 * Verify a Firebase ID token issued by the client-side Phone Auth flow.
 * The returned `phone` is normalised to the 10-digit Indian format stored in
 * Postgres.
 */
export async function verifyFirebaseToken(token: string): Promise<AuthUser> {
  try {
    const decodedToken = await getAdminAuth().verifyIdToken(token);
    return {
      uid: decodedToken.uid,
      phone: normalizeIndianPhone(decodedToken.phone_number || ''),
      email: decodedToken.email,
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    throw new Error('Invalid or expired token');
  }
}

/**
 * Get (or lazily create) the app user that maps to a Firebase account.
 */
export async function getOrCreateUser(firebaseUser: AuthUser): Promise<User> {
  const supabase = getSupabaseAdmin();

  const { data: existing, error: findError } = await supabase
    .from('users')
    .select('*')
    .eq('firebase_uid', firebaseUser.uid)
    .maybeSingle();

  if (findError) throw new Error(findError.message);
  if (existing) return mapUser(existing);

  const phone = normalizeIndianPhone(firebaseUser.phone);
  if (!phone) {
    throw new Error('Phone number is missing from the Firebase token');
  }

  const { data: created, error: insertError } = await supabase
    .from('users')
    .insert({
      firebase_uid: firebaseUser.uid,
      phone,
      name: 'User', // updated during registration
      role: 'employer', // default role
    })
    .select('*')
    .single();

  if (insertError) throw new Error(insertError.message);
  return mapUser(created);
}

/**
 * Get user by Firebase UID
 */
export async function getUserByFirebaseUid(firebaseUid: string): Promise<User | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('users')
    .select('*')
    .eq('firebase_uid', firebaseUid)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapUser(data) : null;
}

/**
 * Update user role
 */
export async function updateUserRole(firebaseUid: string, role: UserRole): Promise<User | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('users')
    .update({ role })
    .eq('firebase_uid', firebaseUid)
    .select('*')
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapUser(data) : null;
}
