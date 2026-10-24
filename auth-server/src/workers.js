// =============================================================================
// SahiKaarigar auth-server — workers (search + public profile)
// =============================================================================
// Read-only worker access for the static site. Mirrors the read half of
// src/services/worker.service.ts, but runs on the auth-server (service_role)
// so the Firebase-hosted static build can reach Supabase.
// =============================================================================

import { db } from './users.js';

// Everything the public is allowed to see about a worker — NO phone number.
// Public profiles must never leak contact details: the number only travels
// via GET /hires/:id, and only once the booking is accepted. `!user_id` pins
// the FK explicitly so PostgREST never has to guess the join path.
const WORKER_WITH_USER =
  '*, user:users!user_id(id, name, avatar, location_area, location_city, is_verified, trust_score)';

function mapPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    avatar: row.avatar ?? null,
    locationArea: row.location_area ?? null,
    locationCity: row.location_city ?? null,
    isVerified: row.is_verified ?? false,
    trustScore: row.trust_score ?? 0,
  };
}

/**
 * Worker performance badge.
 *
 * Gold   -> on-time score above 90%
 * Silver -> on-time score above 70%
 * Bronze -> everything else (including brand-new workers)
 *
 * Accepts either the mapped camelCase shape or a raw `worker_profiles` row, so
 * it can be reused by every endpoint that selects different projections.
 */
export function getWorkerBadge(worker) {
  const score = Number(worker?.systemRatingScore ?? worker?.system_rating_score ?? 0);

  if (score > 90) return 'Gold';
  if (score > 70) return 'Silver';
  return 'Bronze';
}

export function mapWorker(row) {
  if (!row) return null;

  const totalJobsCompleted = Number(row.total_jobs_completed ?? row.completed_jobs ?? 0);
  const onTimeJobs = Number(row.on_time_jobs ?? 0);
  const customerRatingAvg = Number(row.customer_rating_avg ?? row.rating_average ?? 0);
  const systemRatingScore = Number(row.system_rating_score ?? 0);

  return {
    id: row.id,
    userId: row.user_id,
    skills: row.skills ?? [],
    experience: row.experience ?? 0,
    description: row.description ?? null,
    hourlyRate: row.hourly_rate ?? 0,
    availability: row.availability ?? 'available',
    portfolio: row.portfolio ?? [],
    ratingAverage: Number(row.rating_average ?? 0),
    ratingCount: row.rating_count ?? 0,
    completedJobs: Number(row.completed_jobs ?? row.total_jobs_completed ?? 0),
    totalJobsCompleted,
    onTimeJobs,
    customerRatingAvg,
    systemRatingScore,
    badge: getWorkerBadge({ systemRatingScore }),
    serviceAreas: row.service_areas ?? [],
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    isApproved: row.is_approved ?? false,
    createdAt: row.created_at ?? null,
    user: mapPublicUser(row.user),
  };
}

/** Approved + available workers, newest rating first. */
export async function searchWorkers({ skill, area, page = 1, limit = 20 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const safePage = Math.max(Number(page) || 1, 1);
  const from = (safePage - 1) * safeLimit;

  let query = db
    .from('worker_profiles')
    .select(WORKER_WITH_USER, { count: 'exact' })
    .eq('is_approved', true)
    .eq('availability', 'available')
    .order('rating_average', { ascending: false })
    .order('completed_jobs', { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, from + safeLimit - 1);

  if (skill) query = query.contains('skills', [String(skill).toLowerCase()]);
  if (area) query = query.contains('service_areas', [String(area).toLowerCase()]);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const total = count ?? 0;
  return {
    workers: (data ?? []).map(mapWorker),
    pagination: { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) },
  };
}

/** A single worker profile by its `worker_profiles.id`. */
export async function getWorkerById(profileId) {
  const { data, error } = await db
    .from('worker_profiles')
    .select(WORKER_WITH_USER)
    .eq('id', profileId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return mapWorker(data);
}

/** The `worker_profiles.id` for a signed-in user — null when they are not a worker. */
export async function getWorkerProfileIdForUser(userId) {
  const { data, error } = await db
    .from('worker_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.id ?? null;
}
