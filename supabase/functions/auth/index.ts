// =============================================================================
// SahiKaarigar — Supabase Edge Function: auth
// =============================================================================
// The whole backend for login + registration, so the site can stay a static
// bundle on Firebase Hosting (free Spark plan).
//
//   Browser (Firebase Phone Auth) -> Firebase ID token
//        -> POST /functions/v1/auth  { action, token, ... }
//              -> verifies the token against Google's public keys
//              -> reads/writes public.users + public.worker_profiles
//                    (service_role key, server-side only)
//
// Actions
//   login             { token, name? }               -> { user }
//   register-worker   { token, name?, profile{} }    -> { user, workerProfile }
//
// SAFETY: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically by
// the Supabase runtime. The service_role key is NEVER sent to the browser.
// =============================================================================

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { json, preflight } from './_shared/cors.ts';
import { verifyFirebaseToken, type FirebaseUser } from './_shared/firebase.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface WorkerProfileInput {
  skills?: unknown;
  experience?: unknown;
  description?: unknown;
  hourlyRate?: unknown;
  serviceAreas?: unknown;
  lat?: unknown;
  lng?: unknown;
}

interface AuthBody {
  action?: string;
  token?: string;
  name?: string;
  profile?: WorkerProfileInput;
}

function badRequest(message: string): Response {
  return json(400, { ok: false, code: 'VALIDATION_ERROR', message });
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

async function getOrCreateUser(fb: FirebaseUser, name?: string) {
  const { data: existing, error } = await db
    .from('users')
    .select('*')
    .eq('firebase_uid', fb.uid)
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

  if (!fb.phone) {
    throw new Error('Phone number is missing from the Firebase token');
  }

  const { data: created, error: insertError } = await db
    .from('users')
    .insert({
      firebase_uid: fb.uid,
      phone: fb.phone,
      name: cleanName.length >= 2 ? cleanName : 'User',
      role: 'employer',
    })
    .select('*')
    .single();

  if (insertError) throw new Error(insertError.message);
  return created;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item).trim().toLowerCase())
    .filter(Boolean);
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function upsertWorkerProfile(userId: string, input: WorkerProfileInput) {
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
  if (serviceAreas.length === 0) {
    throw new Error('At least one service area is required');
  }

  // Promote the account to the worker role.
  const { error: roleError } = await db
    .from('users')
    .update({ role: 'worker' })
    .eq('id', userId);
  if (roleError) throw new Error(roleError.message);

  // New profiles stay unapproved until an admin reviews them.
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

// -----------------------------------------------------------------------------
// Handler
// -----------------------------------------------------------------------------

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return preflight();

  if (req.method !== 'POST') {
    return json(405, {
      ok: false,
      code: 'METHOD_NOT_ALLOWED',
      message: 'Use POST with a JSON body.',
    });
  }

  let body: AuthBody;
  try {
    body = await req.json();
  } catch {
    return badRequest('Body must be valid JSON.');
  }

  const action = body.action ?? 'login';
  const token = typeof body.token === 'string' ? body.token.trim() : '';

  if (!token) return badRequest('token is required.');

  let firebaseUser: FirebaseUser;
  try {
    firebaseUser = await verifyFirebaseToken(token);
  } catch (error) {
    console.error('Firebase token verification failed:', error);
    return json(401, {
      ok: false,
      code: 'UNAUTHORIZED',
      message: 'Invalid or expired Firebase token.',
    });
  }

  try {
    const user = await getOrCreateUser(firebaseUser, body.name);

    if (action === 'register-worker') {
      const workerProfile = await upsertWorkerProfile(user.id, body.profile ?? {});
      return json(200, { ok: true, user, workerProfile });
    }

    if (action !== 'login') {
      return badRequest(`Unknown action "${action}".`);
    }

    return json(200, { ok: true, user });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    console.error('auth function error:', message);
    return json(400, { ok: false, code: 'BAD_REQUEST', message });
  }
});
