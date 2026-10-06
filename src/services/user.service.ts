import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { mapUser, mapWorkerProfile, userUpdateToRow } from '@/lib/mappers';
import type { User, UserUpdateInput } from '@/types';

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('users')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapUser(data) : null;
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
 * Update user profile
 */
export async function updateUser(
  userId: string,
  updateData: Partial<UserUpdateInput>
): Promise<User | null> {
  const row = userUpdateToRow(updateData);
  if (Object.keys(row).length === 0) return getUserById(userId);

  const { data, error } = await getSupabaseAdmin()
    .from('users')
    .update(row)
    .eq('id', userId)
    .select('*')
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapUser(data) : null;
}

/**
 * Get user with their worker profile (if any)
 */
export async function getUserWithWorkerProfile(userId: string) {
  const user = await getUserById(userId);
  if (!user) return null;

  const { data, error } = await getSupabaseAdmin()
    .from('worker_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return {
    ...user,
    workerProfile: data ? mapWorkerProfile(data) : null,
  };
}

/**
 * Get user dashboard data
 */
export async function getUserDashboard(userId: string) {
  const user = await getUserById(userId);
  if (!user) throw new Error('User not found');

  if (user.role === 'worker') {
    const { data, error } = await getSupabaseAdmin()
      .from('worker_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    const workerProfile = data ? mapWorkerProfile(data) : null;

    return {
      user,
      workerProfile,
      stats: {
        completedJobs: workerProfile?.completedJobs ?? 0,
        rating: {
          average: workerProfile?.ratingAverage ?? 0,
          count: workerProfile?.ratingCount ?? 0,
        },
        availability: workerProfile?.availability ?? 'offline',
      },
    };
  }

  // For employers
  return {
    user,
    stats: {},
  };
}

/**
 * Deactivate user
 */
export async function deactivateUser(userId: string): Promise<User | null> {
  return setUserActive(userId, false);
}

/**
 * Activate user
 */
export async function activateUser(userId: string): Promise<User | null> {
  return setUserActive(userId, true);
}

async function setUserActive(userId: string, isActive: boolean): Promise<User | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('users')
    .update({ is_active: isActive })
    .eq('id', userId)
    .select('*')
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapUser(data) : null;
}

/**
 * Get all users (admin)
 */
export async function getAllUsers(page: number = 1, limit: number = 20, role?: string) {
  const from = (page - 1) * limit;

  let query = getSupabaseAdmin()
    .from('users')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (role) query = query.eq('role', role);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const total = count ?? 0;
  return {
    users: (data ?? []).map(mapUser),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

/**
 * Search users by name or phone (admin)
 */
export async function searchUsers(searchTerm: string, page: number = 1, limit: number = 20) {
  // PostgREST's `or()` filter uses commas/parentheses as syntax, so strip them
  // from the user supplied term to avoid breaking the filter.
  const term = searchTerm.replace(/[%,()]/g, '').trim();
  const from = (page - 1) * limit;

  const { data, error, count } = await getSupabaseAdmin()
    .from('users')
    .select('*', { count: 'exact' })
    .or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (error) throw new Error(error.message);

  const total = count ?? 0;
  return {
    users: (data ?? []).map(mapUser),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}
