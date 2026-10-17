// =============================================================================
// SahiKaarigar auth-server — Supabase access (service_role, server only)
// =============================================================================
// Same tables and same validation rules as supabase/functions/auth/index.ts,
// except users are now keyed on `auth_user_id` (the SuperTokens user id).
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
}

export const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Firebase/Telecom styles -> the 10-digit Indian format stored in Postgres. */
export function normalizeIndianPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

export function isValidIndianPhone(phone) {
  return /^[6-9]\d{9}$/.test(phone);
}

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
}

function asNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Find the `users` row for this SuperTokens user, creating it on first sign-in.
 */
export async function getOrCreateUserByAuthId(
  authUserId,
  phone,
  name,
  { allowInactive = false } = {},
) {
  const { data: existing, error } = await db
    .from('users')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const cleanName = typeof name === 'string' ? name.trim() : '';

  if (existing) {
    if (!existing.is_active && !allowInactive) {
      const error = new Error('Account suspended hai. Admin se sampark karein.');
      error.statusCode = 403;
      throw error;
    }
    if (cleanName.length >= 2 && cleanName !== existing.name) {
      const { data: updated, error: updateError } = await db
        .from('users')
        .update({ name: cleanName })
        .eq('id', existing.id)
        .select('*')
        .single();
      if (updateError) throw new Error(updateError.message);
      return updated;
    }
    return existing;
  }

  if (!isValidIndianPhone(phone)) {
    throw new Error(`Phone number "${phone}" is missing or invalid in the auth session`);
  }

  const { data: created, error: insertError } = await db
    .from('users')
    .insert({
      auth_user_id: authUserId,
      phone,
      name: cleanName.length >= 2 ? cleanName : 'User',
      role: 'employer',
    })
    .select('*')
    .single();

  if (insertError) throw new Error(insertError.message);
  return created;
}

/** Create/update the worker profile and promote the account to role=worker. */
export async function upsertWorkerProfile(userId, input = {}) {
  const skills = asStringArray(input.skills);
  if (skills.length === 0) throw new Error('At least one skill is required');

  const experience = asNumber(input.experience) ?? 0;
  if (experience < 0 || experience > 50) {
    throw new Error('Experience must be between 0 and 50 years');
  }

  const hourlyRate = asNumber(input.hourlyRate) ?? 0;
  if (hourlyRate < 50 || hourlyRate > 10000) {
    throw new Error('Hourly rate must be between Rs.50 and Rs.10,000');
  }

  const serviceAreas = asStringArray(input.serviceAreas);
  if (serviceAreas.length === 0) throw new Error('At least one service area is required');

  const { error: roleError } = await db
    .from('users')
    .update({ role: 'worker' })
    .eq('id', userId);
  if (roleError) throw new Error(roleError.message);

  const { data, error } = await db
    .from('worker_profiles')
    .upsert(
      {
        user_id: userId,
        skills,
        experience,
        description:
          typeof input.description === 'string' && input.description.trim()
            ? input.description.trim()
            : null,
        hourly_rate: hourlyRate,
        service_areas: serviceAreas,
        lat: asNumber(input.lat),
        lng: asNumber(input.lng),
        is_approved: false,
        verification_status: 'pending',
        admin_notes: null,
        ...(input.aadhaarPhotoPath ? { aadhaar_photo_path: input.aadhaarPhotoPath } : {}),
        availability: 'available',
      },
      { onConflict: 'user_id' },
    )
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

function decodeImageDataUrl(value, label) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error(`${label} must be a JPEG, PNG, or WebP image`);
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) {
    throw new Error(`${label} must be smaller than 5 MB`);
  }
  return { buffer, contentType: match[1] };
}

/** Store worker profile photos privately/publicly as appropriate. */
export async function uploadWorkerImages(
  userId,
  { aadhaarPhotoDataUrl, profilePhotoDataUrl } = {},
) {
  const images = {};
  const aadhaar = decodeImageDataUrl(aadhaarPhotoDataUrl, 'Aadhaar photo');
  if (aadhaar) {
    const path = `${userId}/aadhaar`;
    const { error } = await db.storage.from('aadhaar-documents').upload(path, aadhaar.buffer, {
      contentType: aadhaar.contentType,
      upsert: true,
    });
    if (error) throw new Error(`Aadhaar photo upload failed: ${error.message}`);
    images.aadhaarPhotoPath = path;
  }

  const profilePhoto = decodeImageDataUrl(profilePhotoDataUrl, 'Profile photo');
  if (profilePhoto) {
    const path = `${userId}/profile`;
    const { error } = await db.storage.from('avatars').upload(path, profilePhoto.buffer, {
      contentType: profilePhoto.contentType,
      upsert: true,
    });
    if (error) throw new Error(`Profile photo upload failed: ${error.message}`);
    const { data } = db.storage.from('avatars').getPublicUrl(path);
    const { error: userError } = await db
      .from('users')
      .update({ avatar: data.publicUrl })
      .eq('id', userId);
    if (userError) throw new Error(userError.message);
    images.profilePhotoUrl = data.publicUrl;
  }

  return images;
}

/**
 * Update the editable profile fields of the signed-in user.
 * Only whitelisted columns are ever written.
 */
export async function updateUser(userId, input = {}) {  const row = {};

  if (typeof input.name === 'string' && input.name.trim().length >= 2) {
    row.name = input.name.trim();
  }
  for (const [key, column] of [
    ['address', 'address'],
    ['locationArea', 'location_area'],
    ['locationCity', 'location_city'],
  ]) {
    if (typeof input[key] === 'string' && input[key].trim()) {
      row[column] = input[key].trim();
    }
  }

  if (Object.keys(row).length === 0) {
    const { data, error } = await db.from('users').select('*').eq('id', userId).single();
    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await db
    .from('users')
    .update(row)
    .eq('id', userId)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Store (or clear) the user's Expo push token — used by the mobile app so
 * hire status changes can ping their device (see src/push.js).
 */
export async function savePushToken(userId, token) {
  const { error } = await db
    .from('users')
    .update({ push_token: token })
    .eq('id', userId);
  if (error) throw new Error(error.message);
}

/**
 * Delete the signed-in user's account and everything it owns.
 * Play Store policy needs an in-app delete path; the privacy page promises it.
 *
 * Deletion order matters — media first, child rows next, `users` last.
 * (All FKs are `on delete cascade`, but explicit order keeps behaviour stable
 * even if a constraint is ever relaxed.)
 *   1. private Aadhaar + profile image files
 *   2. reviews they wrote + reviews on their worker profile
 *   3. their worker profile (cascades their hire_requests + those reviews)
 *   4. hire_requests where they are the employer (cascades reviews + platform_feedback)
 *   5. reports for/against them + their platform_feedback
 *   6. the users row itself, then the SuperTokens identity so the number
 *      can never sign back into a ghost row
 */
export async function deleteUserAccount({ userId, authUserId }) {
  const { data: workerProfile } = await db
    .from('worker_profiles')
    .select('id, aadhaar_photo_path')
    .eq('user_id', userId)
    .maybeSingle();
  const workerProfileId = workerProfile?.id ?? null;

  const storedImages = [
    ...(workerProfile?.aadhaar_photo_path
      ? [{ bucket: 'aadhaar-documents', path: workerProfile.aadhaar_photo_path }]
      : []),
    { bucket: 'avatars', path: `${userId}/profile` },
  ];
  for (const { bucket, path } of storedImages) {
    const { error } = await db.storage.from(bucket).remove([path]);
    if (error) throw new Error(`Account image cleanup failed: ${error.message}`);
  }

  // Reviews they wrote (as an employer/customer).
  {
    const { error } = await db.from('reviews').delete().eq('reviewer_id', userId);
    if (error) throw new Error(error.message);
  }

  // Their worker profile + everything attached (hires, reviews on it).
  if (workerProfileId) {
    const { error: reviewsError } = await db
      .from('reviews')
      .delete()
      .eq('worker_id', workerProfileId);
    if (reviewsError) throw new Error(reviewsError.message);

    const { error: profileError } = await db
      .from('worker_profiles')
      .delete()
      .eq('id', workerProfileId);
    if (profileError) throw new Error(profileError.message);
  }

  // Hires where they are the employer (reviews/feedback cascade off these).
  {
    const { error } = await db.from('hire_requests').delete().eq('employer_id', userId);
    if (error) throw new Error(error.message);
  }

  // Reports for or against them + their platform feedback.
  {
    const { error } = await db
      .from('reports')
      .delete()
      .or(`reporter_id.eq.${userId},reported_user_id.eq.${userId}`);
    if (error && error.code !== 'PGRST116') throw new Error(error.message);
  }
  {
    const { error } = await db.from('platform_feedback').delete().eq('user_id', userId);
    if (error) throw new Error(error.message);
  }

  // The user row itself.
  {
    const { error } = await db.from('users').delete().eq('id', userId);
    if (error) throw new Error(error.message);
  }

  // The SuperTokens identity, so the number signs up fresh afterwards.
  try {
    const { default: supertokens } = await import('supertokens-node');
    if (authUserId) {
      await supertokens.deleteUser(authUserId);
    }
  } catch (error) {
    throw new Error(`Account rows deleted, but SuperTokens cleanup failed: ${error.message}`);
  }
}
