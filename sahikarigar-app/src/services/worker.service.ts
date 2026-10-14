import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  mapWorkerProfile,
  mapWorkerWithUser,
  mapWorkerSearchRow,
  workerUpdateToRow,
} from '@/lib/mappers';
import type {
  Availability,
  WorkerProfile,
  WorkerProfileCreateInput,
  WorkerProfileUpdateInput,
  WorkerSearchFilters,
  WorkerWithUser,
} from '@/types';

/** Columns selected whenever a worker profile is returned together with its user. */
const WORKER_WITH_USER_SELECT =
  '*, user:users(id, name, avatar, location_area, location_city)';

/**
 * Create a worker profile for an existing user.
 */
export async function createWorkerProfile(
  userId: string,
  profileData: WorkerProfileCreateInput
): Promise<WorkerProfile> {
  const supabase = getSupabaseAdmin();

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', userId)
    .maybeSingle();

  if (userError) throw new Error(userError.message);
  if (!user) throw new Error('User not found');

  const { data: existing, error: existingError } = await supabase
    .from('worker_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing) throw new Error('Worker profile already exists');

  const { data, error } = await supabase
    .from('worker_profiles')
    .insert({
      user_id: userId,
      skills: profileData.skills,
      experience: profileData.experience,
      description: profileData.description ?? null,
      hourly_rate: profileData.hourlyRate,
      service_areas: profileData.serviceAreas.map((area) => area.toLowerCase()),
      lat: profileData.lat ?? null,
      lng: profileData.lng ?? null,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  // Promote the account to the worker role.
  if (user.role !== 'worker') {
    await supabase.from('users').update({ role: 'worker' }).eq('id', userId);
  }

  return mapWorkerProfile(data);
}

/**
 * Get a worker profile by its own id (with the linked user attached).
 */
export async function getWorkerProfileById(profileId: string): Promise<WorkerWithUser | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('worker_profiles')
    .select(WORKER_WITH_USER_SELECT)
    .eq('id', profileId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapWorkerWithUser(data) : null;
}

/**
 * Get a worker profile by the owning user id.
 */
export async function getWorkerProfileByUserId(userId: string): Promise<WorkerProfile | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('worker_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapWorkerProfile(data) : null;
}

/**
 * Update a worker profile.
 */
export async function updateWorkerProfile(
  profileId: string,
  updateData: Partial<WorkerProfileUpdateInput>
): Promise<WorkerProfile | null> {
  const row = workerUpdateToRow(updateData);
  if (updateData.serviceAreas) {
    row.service_areas = updateData.serviceAreas.map((area) => area.toLowerCase());
  }
  if (Object.keys(row).length === 0) return null;

  const { data, error } = await getSupabaseAdmin()
    .from('worker_profiles')
    .update(row)
    .eq('id', profileId)
    .select('*')
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapWorkerProfile(data) : null;
}

/**
 * Toggle worker availability.
 */
export async function toggleAvailability(
  profileId: string,
  availability: Availability
): Promise<WorkerProfile | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('worker_profiles')
    .update({ availability })
    .eq('id', profileId)
    .select('*')
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapWorkerProfile(data) : null;
}

/**
 * Search workers with filters.
 *
 * All filtering (including the optional lat/lng "within X km" distance filter)
 * is performed inside the `search_workers` Postgres function, which also
 * returns the total row count for pagination.
 */
export async function searchWorkers(filters: WorkerSearchFilters) {
  const {
    skills,
    area,
    minRating,
    maxRate,
    lat,
    lng,
    maxDistance,
    page = 1,
    limit = 20,
  } = filters;

  const normalizedSkills =
    skills && skills.length > 0 ? skills.map((skill) => skill.toLowerCase()) : null;

  const { data, error } = await getSupabaseAdmin().rpc('search_workers', {
    p_skills: normalizedSkills,
    p_area: area ? area.toLowerCase() : null,
    p_min_rating: minRating ?? null,
    p_max_rate: maxRate ?? null,
    p_lat: lat ?? null,
    p_lng: lng ?? null,
    p_max_distance: maxDistance ?? null,
    p_limit: limit,
    p_offset: (page - 1) * limit,
  });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Record<string, unknown>[];
  const total = rows.length > 0 ? Number(rows[0].total_count) : 0;

  return {
    workers: rows.map(mapWorkerSearchRow),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

/**
 * Get top rated, currently available workers.
 */
export async function getTopRatedWorkers(limit: number = 10): Promise<WorkerWithUser[]> {
  const { data, error } = await getSupabaseAdmin()
    .from('worker_profiles')
    .select(WORKER_WITH_USER_SELECT)
    .eq('is_approved', true)
    .eq('availability', 'available')
    .gte('rating_count', 1)
    .order('rating_average', { ascending: false })
    .order('completed_jobs', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapWorkerWithUser);
}

/**
 * Approve a worker profile (admin).
 */
export async function approveWorkerProfile(
  profileId: string,
  adminNotes?: string
): Promise<WorkerProfile | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('worker_profiles')
    .update({ is_approved: true, admin_notes: adminNotes ?? null })
    .eq('id', profileId)
    .select('*')
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapWorkerProfile(data) : null;
}

/**
 * Get worker profiles awaiting approval (admin).
 */
export async function getPendingWorkerProfiles(page: number = 1, limit: number = 20) {
  const from = (page - 1) * limit;

  const { data, error, count } = await getSupabaseAdmin()
    .from('worker_profiles')
    .select(WORKER_WITH_USER_SELECT, { count: 'exact' })
    .eq('is_approved', false)
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (error) throw new Error(error.message);

  const total = count ?? 0;
  return {
    workers: (data ?? []).map(mapWorkerWithUser),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

/**
 * Aggregate stats for an area (used by the SEO area pages).
 */
export async function getAreaStats(area: string) {
  const { data, error } = await getSupabaseAdmin().rpc('get_area_stats', {
    p_area: area.toLowerCase(),
  });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Record<string, unknown>[];
  const row = rows[0];

  return {
    totalWorkers: row ? Number(row.total_workers) : 0,
    avgRating: row ? Number(row.avg_rating) : 0,
    avgRate: row ? Number(row.avg_rate) : 0,
    recentHires: 0,
  };
}
