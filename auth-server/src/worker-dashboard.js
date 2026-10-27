// =============================================================================
// SahiKaarigar auth-server — worker dashboard
// =============================================================================
// Everything the "worker" side of the app needs in one round-trip:
//   * their own profile (skills / rate / rating / approval)
//   * the availability switch (available | busy | offline)
//   * job buckets: new requests, jobs in progress, recently completed
//   * headline stats (pending, active, completed, estimated earnings)
//
// Kept in its own module so it can import from both workers.js and hires.js
// without creating a cycle between them.
// =============================================================================

import { db, normalizeAadhaarNumber, uploadWorkerImages } from './users.js';
import { mapWorker } from './workers.js';
import { mapHire, HIRE_SELECT } from './hires.js';

/** Same projection the public worker endpoints use (includes the owner's user row).
 *  `!user_id` pins the FK explicitly so PostgREST never guesses the join path. */
const WORKER_WITH_USER =
  '*, user:users!user_id(id, name, avatar, phone, location_area, location_city, is_verified, trust_score)';

/** Values allowed by the `worker_profiles_availability` check constraint. */
const AVAILABILITY_VALUES = ['available', 'busy', 'offline'];

/** Statuses where a job has been accepted but not finished yet. */
const ACTIVE_STATUSES = ['accepted', 'en_route', 'arrived', 'in_progress'];

/** How many finished jobs the dashboard keeps for display. */
const COMPLETED_LIMIT = 10;

/**
 * The worker's OWN profile — the public `mapWorker` plus the private bits only
 * the owner may see: whether an Aadhaar is on file (masked — the raw number is
 * NEVER sent to the client) and the verification state.
 * @param {object} row  a `worker_profiles` row with the joined user
 */
export function mapOwnWorker(row) {
  if (!row) return null;
  const base = mapWorker(row);
  const aadhaar = row.aadhaar_number ?? null;
  return {
    ...base,
    aadhaarOnFile: Boolean(aadhaar),
    aadhaarMasked: aadhaar ? `XXXX XXXX ${String(aadhaar).slice(-4)}` : null,
    verificationStatus: row.verification_status ?? null,
  };
}

/**
 * The signed-in user's own worker profile (or `null` when they have none).
 * Cheap `GET /worker/profile` for the Edit Profile screen — it avoids the
 * dashboard round-trip (hire history is not needed there).
 * @param {string} userId  `users.id`
 */
export async function getOwnWorkerProfile(userId) {
  const { data, error } = await db
    .from('worker_profiles')
    .select(WORKER_WITH_USER)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapOwnWorker(data) : null;
}

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  // De-dupe so a double-tapped chip can never be stored twice while keeping
  // every distinct selected value.
  return Array.from(
    new Set(value.map((item) => String(item).trim().toLowerCase()).filter(Boolean)),
  );
}

function asNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Update the signed-in worker's editable profile fields — skills, experience,
 * rate, service areas, description. Mirrors the `worker_profiles` check
 * constraints from supabase/migrations/0001_init_schema.sql:
 *   skills non-empty, experience 0..50, hourly_rate 50..10000,
 *   service_areas non-empty, description <= 500 chars.
 * NEVER touches `is_approved` / `verification_status` — editing your profile
 * must not push an approved worker back into the verification queue.
 * @param {string} userId  `users.id`
 */
export async function updateOwnWorkerProfile(userId, input = {}) {
  const row = {};

  const wantsPhotos =
    Boolean(input.profilePhotoDataUrl) ||
    Boolean(input.removeProfilePhoto) ||
    (Array.isArray(input.workPhotoDataUrls) && input.workPhotoDataUrls.length > 0);

  // The Aadhaar number is LOCKED once submitted — changing it would defeat the
  // whole point of the verification, so it can only be ADDED, never replaced.
  if (input.aadhaarNumber !== undefined && String(input.aadhaarNumber || '').trim()) {
    const { data: current, error: currentError } = await db
      .from('worker_profiles')
      .select('aadhaar_number')
      .eq('user_id', userId)
      .maybeSingle();
    if (currentError) throw new Error(currentError.message);
    if (current?.aadhaar_number) {
      throw new Error('Aadhaar number pehle se submit ho chuka hai — use badla nahi ja sakta');
    }
    const aadhaarNumber = normalizeAadhaarNumber(input.aadhaarNumber);
    if (aadhaarNumber) row.aadhaar_number = aadhaarNumber;
  }

  if (input.skills !== undefined) {
    const skills = asStringArray(input.skills);
    if (skills.length === 0) throw new Error('At least one skill is required');
    row.skills = skills;
  }

  if (input.experience !== undefined) {
    const experience = asNumber(input.experience);
    if (experience === null || experience < 0 || experience > 50) {
      throw new Error('Experience must be between 0 and 50 years');
    }
    row.experience = experience;
  }

  if (input.hourlyRate !== undefined) {
    const hourlyRate = asNumber(input.hourlyRate);
    if (hourlyRate === null || hourlyRate < 50 || hourlyRate > 10000) {
      throw new Error('Hourly rate must be between Rs.50 and Rs.10,000');
    }
    row.hourly_rate = hourlyRate;
  }

  if (input.serviceAreas !== undefined) {
    const serviceAreas = asStringArray(input.serviceAreas);
    if (serviceAreas.length === 0) throw new Error('At least one service area is required');
    row.service_areas = serviceAreas;
  }

  if (input.description !== undefined) {
    const description = typeof input.description === 'string' ? input.description.trim() : '';
    if (description.length > 500) {
      throw new Error('Description 500 characters se chhota hona chahiye');
    }
    row.description = description || null;
  }

  // Photos — profile photo (users.avatar) + work photos (worker_profiles.portfolio).
  if (wantsPhotos) {
    const images = await uploadWorkerImages(userId, {
      profilePhotoDataUrl: input.profilePhotoDataUrl,
      removeProfilePhoto: input.removeProfilePhoto,
      workPhotoDataUrls: input.workPhotoDataUrls,
    });
    if (images.workPhotoUrls) {
      // The client sends the URLs it wants to KEEP; new uploads are appended.
      const keep = Array.isArray(input.portfolioToKeep)
        ? input.portfolioToKeep.map((url) => String(url)).filter(Boolean)
        : [];
      row.portfolio = [...keep, ...images.workPhotoUrls];
    }
  }

  if (Object.keys(row).length === 0) {
    if (!wantsPhotos) {
      throw new Error('Kuch bhi badalnay ke liye nahi mila');
    }
    // Photo-only update — nothing to write on the worker_profiles row.
    const { data: existing, error: existingError } = await db
      .from('worker_profiles')
      .select(WORKER_WITH_USER)
      .eq('user_id', userId)
      .maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (!existing) throw new Error('Pehle kaarigar ke roop me register karo');
    return mapOwnWorker(existing);
  }

  const { data, error } = await db
    .from('worker_profiles')
    .update(row)
    .eq('user_id', userId)
    .select(WORKER_WITH_USER)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Pehle kaarigar ke roop me register karo');
  return mapOwnWorker(data);
}

/**
 * Flip the signed-in worker's availability.
 * @param {string} userId  `users.id`
 * @param {string} availability  available | busy | offline
 */
export async function setWorkerAvailability(userId, availability) {
  const value = String(availability || '').trim().toLowerCase();
  if (!AVAILABILITY_VALUES.includes(value)) {
    throw new Error(`Availability "${availability}" valid nahi hai (available / busy / offline)`);
  }

  const { data, error } = await db
    .from('worker_profiles')
    .update({ availability: value })
    .eq('user_id', userId)
    .select(WORKER_WITH_USER)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Pehle kaarigar ke roop me register karo');
  return mapWorker(data);
}

/**
 * The worker dashboard payload, or `null` when the caller has no worker profile.
 * @param {string} userId  `users.id`
 */
export async function getWorkerDashboard(userId) {
  const { data: profile, error } = await db
    .from('worker_profiles')
    .select(WORKER_WITH_USER)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!profile) return null;

  const worker = mapWorker(profile);

  const { data: rows, error: hiresError } = await db
    .from('hire_requests')
    .select(HIRE_SELECT)
    .eq('worker_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (hiresError) throw new Error(hiresError.message);

  const hires = (rows ?? []).map(mapHire);
  const completed = hires.filter((hire) => hire.status === 'completed');

  return {
    worker,
    stats: {
      pending: hires.filter((hire) => hire.status === 'pending').length,
      active: hires.filter((hire) => ACTIVE_STATUSES.includes(hire.status)).length,
      completed: completed.length,
      // Lifetime counter maintained by the `increment_worker_completed_jobs` RPC.
      lifetimeJobs: worker.totalJobsCompleted ?? worker.completedJobs,
      // Punctuality + badge (see supabase/migrations/0017_worker_performance.sql).
      totalJobsCompleted: worker.totalJobsCompleted,
      onTimeJobs: worker.onTimeJobs,
      customerRatingAvg: worker.customerRatingAvg,
      systemRatingScore: worker.systemRatingScore,
      badge: worker.badge,
      // A hire only records the agreed hourly rate (no hours), so this is the sum
      // of those rates across completed jobs — an estimate, labelled as such in UI.
      estimatedEarnings: completed.reduce((sum, hire) => sum + (Number(hire.proposedRate) || 0), 0),
      ratingAverage: worker.ratingAverage,
      ratingCount: worker.ratingCount,
      isApproved: worker.isApproved,
    },
    requests: hires.filter((hire) => hire.status === 'pending'),
    active: hires.filter((hire) => ACTIVE_STATUSES.includes(hire.status)),
    completed: completed.slice(0, COMPLETED_LIMIT),
  };
}
