// =============================================================================
// SahiKaarigar auth-server — workers (search + public profile)
// =============================================================================
// Read-only worker access for the static site. Mirrors the read half of
// src/services/worker.service.ts, but runs on the auth-server (service_role)
// so the Firebase-hosted static build can reach Supabase.
// =============================================================================

import { db } from './users.js';

// Everything the public is allowed to see about a worker — NO phone number,
// NO Aadhaar data, NO admin notes and NO exact coordinates. Selecting explicit
// columns (instead of `*`) means sensitive fields are never even fetched by
// the public endpoints. `!user_id` pins the FK explicitly so PostgREST never
// has to guess the join path.
export const WORKER_PUBLIC_SELECT =
  'id, user_id, skills, experience, description, hourly_rate, availability, portfolio, ' +
  'rating_average, rating_count, completed_jobs, total_jobs_completed, on_time_jobs, ' +
  'customer_rating_avg, system_rating_score, service_areas, is_approved, created_at, ' +
  'user:users!user_id(id, name, avatar, location_area, location_city, is_verified, trust_score, is_active)';

/** WORKER_PUBLIC_SELECT plus lat/lng — server-side only, never sent to clients. */
export const WORKER_GEO_SELECT = WORKER_PUBLIC_SELECT + ', lat, lng';

/** Default surrounding-search radius in kilometres when the client sends none. */
const DEFAULT_RADIUS_KM = 10;

/** Upper bound on rows fetched for one radius search before filtering in JS. */
const GEO_CANDIDATE_CAP = 500;

/** Great-circle distance between two coordinates, in kilometres (Haversine). */
function haversineKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

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

/**
 * Trust score — a 0–100 number shown on the worker's Profile screen.
 *
 * `users.trust_score` is a legacy column that is never written to, so the
 * score is computed live from worker_profiles data instead:
 *   base    rejected 0 · pending +10 · approved +40
 *   rating  rating_average × 10, max +50 (only when at least one rating exists)
 *   jobs    +1 per completed job, max +10
 * A brand-new approved worker therefore shows 40 — never a misleading 0.
 */
export function computeTrustScore(row) {
  if (!row) return 0;
  let score = 0;
  const status = String(row.verification_status ?? (row.is_approved ? 'approved' : 'pending'));
  if (status === 'approved') score += 40;
  else if (status !== 'rejected') score += 10;
  const ratingAverage = Number(row.rating_average ?? 0);
  const ratingCount = Number(row.rating_count ?? 0);
  if (ratingAverage > 0 && ratingCount > 0) {
    score += Math.min(50, ratingAverage * 10);
  }
  const completedJobs = Number(row.completed_jobs ?? row.total_jobs_completed ?? 0);
  score += Math.min(10, Math.max(0, completedJobs));
  return Math.min(100, Math.round(score));
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
    // Exact coordinates are private: they can reveal a worker's home. Public
    // clients only get area-level location. The owner's own coordinates are
    // added back by mapOwnWorker() in worker-dashboard.js.
    isApproved: row.is_approved ?? false,
    trustScore: computeTrustScore(row),
    createdAt: row.created_at ?? null,
    user: mapPublicUser(row.user),
  };
}

/** Approved + available workers, newest rating first. */
export async function searchWorkers({
  skill,
  area,
  lat,
  lng,
  radius,
  page = 1,
  limit = 20,
} = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const safePage = Math.max(Number(page) || 1, 1);

  // Surrounding search: a valid lat/lng origin switches to radius filtering
  // ("kaarigar near Hitech City"), which no text match can approximate.
  // Empty strings parse as 0 and nonsense values as NaN — both rejected, and
  // range-checked so a bogus origin can only ever return an empty result.
  const originLat = Number(lat);
  const originLng = Number(lng);
  const originValid =
    String(lat ?? '').trim() !== '' &&
    String(lng ?? '').trim() !== '' &&
    Number.isFinite(originLat) &&
    Number.isFinite(originLng) &&
    Math.abs(originLat) <= 90 &&
    Math.abs(originLng) <= 180;
  if (originValid) {
    const safeRadius = Math.min(Math.max(Number(radius) || DEFAULT_RADIUS_KM, 1), 50);
    return geoSearchWorkers({
      skill,
      originLat,
      originLng,
      radius: safeRadius,
      page: safePage,
      limit: safeLimit,
    });
  }

  const from = (safePage - 1) * safeLimit;

  let query = db
    .from('worker_profiles')
    .select(WORKER_PUBLIC_SELECT, { count: 'exact' })
    .eq('is_approved', true)
    .eq('availability', 'available')
    .eq('user.is_active', true) // Suspended workers are hidden from search
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

/**
 * Radius search around a point (surrounding-area search).
 *
 * The customer searches a place ("Hitech City"); the server keeps every
 * approved + available worker whose saved profile coordinates fall inside
 * `radius` km of that place, nearest first. Distance is computed here —
 * mapWorker strips worker coordinates from the public response (a worker's
 * exact location can reveal their home), so clients only ever receive the
 * distance number, never the coordinates themselves.
 *
 * Candidates are fetched without DB pagination and filtered in JS: the radius
 * predicate cannot be expressed through PostgREST filters, and the marketplace
 * is far below the candidate cap at launch. Pagination is applied afterwards
 * on the filtered set, so `total` stays accurate.
 */
async function geoSearchWorkers({ skill, originLat, originLng, radius, page, limit }) {
  let query = db
    .from('worker_profiles')
    .select(WORKER_GEO_SELECT)
    .eq('is_approved', true)
    .eq('availability', 'available')
    .eq('user.is_active', true)
    .order('rating_average', { ascending: false })
    .order('completed_jobs', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(GEO_CANDIDATE_CAP);

  if (skill) query = query.contains('skills', [String(skill).toLowerCase()]);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const near = (data ?? [])
    .map((row) => {
      if (row.lat == null || row.lng == null) return null;
      const km = haversineKm(originLat, originLng, row.lat, row.lng);
      if (km > radius) return null;
      return { row, distanceKm: Math.round(km * 10) / 10 };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        a.distanceKm - b.distanceKm ||
        Number(b.row.rating_average ?? 0) - Number(a.row.rating_average ?? 0) ||
        Number(b.row.completed_jobs ?? 0) - Number(a.row.completed_jobs ?? 0),
    );

  const total = near.length;
  const from = (page - 1) * limit;
  const workers = near
    .slice(from, from + limit)
    .map(({ row, distanceKm }) => ({ ...mapWorker(row), distanceKm }));

  return {
    workers,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(Math.ceil(total / limit), 1),
    },
  };
}

/** A single worker profile by its `worker_profiles.id`. */
export async function getWorkerById(profileId) {
  const { data, error } = await db
    .from('worker_profiles')
    .select(WORKER_PUBLIC_SELECT)
    .eq('id', profileId)
    .eq('user.is_active', true) // Suspended workers are not publicly visible
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
