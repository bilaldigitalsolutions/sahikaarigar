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
export async function getOrCreateUserByAuthId(authUserId, phone, name) {
  const { data: existing, error } = await db
    .from('users')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const cleanName = typeof name === 'string' ? name.trim() : '';

  if (existing) {
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
        availability: 'available',
      },
      { onConflict: 'user_id' },
    )
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Update the editable profile fields of the signed-in user.
 * Only whitelisted columns are ever written.
 */
export async function updateUser(userId, input = {}) {
  const row = {};

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
