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

import { db } from './users.js';
import { mapWorker } from './workers.js';
import { mapHire, HIRE_SELECT } from './hires.js';

/** Same projection the public worker endpoints use (includes the owner's user row). */
const WORKER_WITH_USER =
  '*, user:users(id, name, avatar, phone, location_area, location_city, is_verified, trust_score)';

/** Values allowed by the `worker_profiles_availability` check constraint. */
const AVAILABILITY_VALUES = ['available', 'busy', 'offline'];

/** Statuses where a job has been accepted but not finished yet. */
const ACTIVE_STATUSES = ['accepted', 'en_route', 'arrived'];

/** How many finished jobs the dashboard keeps for display. */
const COMPLETED_LIMIT = 10;

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
      lifetimeJobs: worker.completedJobs,
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
