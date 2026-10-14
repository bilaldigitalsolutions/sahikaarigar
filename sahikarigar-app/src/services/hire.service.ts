import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { mapHireRequest, mapHireRequestWithDetails } from '@/lib/mappers';
import type { HireRequest, HireRequestCreateInput, HireRequestWithDetails } from '@/types';

/** Embedded user columns for the employer side of a hire request. */
const EMPLOYER_SELECT =
  'employer:users(id, name, phone, avatar, location_area, location_city)';

/** Embedded worker (with its own user) for the worker side of a hire request. */
const WORKER_SELECT =
  'worker:worker_profiles(id, user_id, skills, hourly_rate, rating_average, rating_count, availability, user:users(id, name, avatar, location_area, location_city))';

/**
 * Create a hire request (employer -> worker).
 */
export async function createHireRequest(
  employerId: string,
  requestData: HireRequestCreateInput
): Promise<HireRequest> {
  const supabase = getSupabaseAdmin();

  const { data: worker, error: workerError } = await supabase
    .from('worker_profiles')
    .select('id, is_approved, availability')
    .eq('id', requestData.workerId)
    .maybeSingle();

  if (workerError) throw new Error(workerError.message);
  if (!worker) throw new Error('Worker not found');
  if (!worker.is_approved) throw new Error('Worker is not approved');
  if (worker.availability !== 'available') throw new Error('Worker is not available');

  const { data: existing, error: existingError } = await supabase
    .from('hire_requests')
    .select('id')
    .eq('employer_id', employerId)
    .eq('worker_id', requestData.workerId)
    .eq('status', 'pending')
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing) throw new Error('You already have a pending request with this worker');

  const { data, error } = await supabase
    .from('hire_requests')
    .insert({
      employer_id: employerId,
      worker_id: requestData.workerId,
      description: requestData.description,
      location: requestData.location,
      proposed_rate: requestData.proposedRate,
      scheduled_date: requestData.scheduledDate
        ? new Date(requestData.scheduledDate).toISOString()
        : null,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return mapHireRequest(data);
}

/**
 * Get a hire request by id (with employer + worker details).
 */
export async function getHireRequestById(
  requestId: string
): Promise<HireRequestWithDetails | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('hire_requests')
    .select(`*, ${EMPLOYER_SELECT}, ${WORKER_SELECT}`)
    .eq('id', requestId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapHireRequestWithDetails(data) : null;
}

/**
 * Get hire requests created by an employer.
 */
export async function getHireRequestsByEmployer(
  employerId: string,
  status?: string,
  page: number = 1,
  limit: number = 20
) {
  const from = (page - 1) * limit;

  let query = getSupabaseAdmin()
    .from('hire_requests')
    .select(`*, ${WORKER_SELECT}`, { count: 'exact' })
    .eq('employer_id', employerId)
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (status) query = query.eq('status', status);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const total = count ?? 0;
  return {
    requests: (data ?? []).map(mapHireRequestWithDetails),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

/**
 * Get hire requests received by a worker.
 */
export async function getHireRequestsByWorker(
  workerId: string,
  status?: string,
  page: number = 1,
  limit: number = 20
) {
  const from = (page - 1) * limit;

  let query = getSupabaseAdmin()
    .from('hire_requests')
    .select(`*, ${EMPLOYER_SELECT}`, { count: 'exact' })
    .eq('worker_id', workerId)
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (status) query = query.eq('status', status);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  const total = count ?? 0;
  return {
    requests: (data ?? []).map(mapHireRequestWithDetails),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

/** Minimal row used by the state-transition helpers. */
interface RawHireRequest {
  id: string;
  employer_id: string;
  worker_id: string;
  status: string;
}

async function fetchRawRequest(requestId: string): Promise<RawHireRequest | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('hire_requests')
    .select('id, employer_id, worker_id, status')
    .eq('id', requestId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Accept a hire request (worker). Reveals the phone number and marks the
 * worker busy.
 */
export async function acceptHireRequest(
  requestId: string,
  workerId: string
): Promise<HireRequest> {
  const request = await fetchRawRequest(requestId);
  if (!request) throw new Error('Hire request not found');
  if (request.worker_id !== workerId) throw new Error('Unauthorized');
  if (request.status !== 'pending') throw new Error('Request is not pending');

  const { data, error } = await getSupabaseAdmin()
    .from('hire_requests')
    .update({ status: 'accepted', phone_revealed: true })
    .eq('id', requestId)
    .eq('status', 'pending') // guard against a concurrent update
    .select('*')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Request is not pending');

  await getSupabaseAdmin()
    .from('worker_profiles')
    .update({ availability: 'busy' })
    .eq('id', workerId);

  return mapHireRequest(data);
}

/**
 * Reject a hire request (worker).
 */
export async function rejectHireRequest(
  requestId: string,
  workerId: string
): Promise<HireRequest> {
  const request = await fetchRawRequest(requestId);
  if (!request) throw new Error('Hire request not found');
  if (request.worker_id !== workerId) throw new Error('Unauthorized');
  if (request.status !== 'pending') throw new Error('Request is not pending');

  const { data, error } = await getSupabaseAdmin()
    .from('hire_requests')
    .update({ status: 'rejected' })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Request is not pending');

  return mapHireRequest(data);
}

/**
 * Mark a hire request as completed (employer or worker).
 * Increments the worker's `completed_jobs` counter and frees them up again.
 */
export async function completeHireRequest(
  requestId: string,
  userId: string
): Promise<HireRequest> {
  const request = await fetchRawRequest(requestId);
  if (!request) throw new Error('Hire request not found');

  const isEmployer = request.employer_id === userId;
  let isWorker = false;

  if (!isEmployer) {
    // `worker_id` points at worker_profiles, so resolve it against the caller.
    const { data: profile, error: profileError } = await getSupabaseAdmin()
      .from('worker_profiles')
      .select('id')
      .eq('id', request.worker_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);
    isWorker = Boolean(profile);
  }

  if (!isEmployer && !isWorker) throw new Error('Unauthorized');
  if (request.status !== 'accepted') throw new Error('Request is not accepted');

  const { data, error } = await getSupabaseAdmin()
    .from('hire_requests')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('status', 'accepted')
    .select('*')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Request is not accepted');

  const { error: rpcError } = await getSupabaseAdmin().rpc(
    'increment_worker_completed_jobs',
    { p_worker_id: request.worker_id }
  );
  if (rpcError) throw new Error(rpcError.message);

  return mapHireRequest(data);
}

/**
 * Cancel a hire request (employer).
 */
export async function cancelHireRequest(
  requestId: string,
  employerId: string
): Promise<HireRequest> {
  const request = await fetchRawRequest(requestId);
  if (!request) throw new Error('Hire request not found');
  if (request.employer_id !== employerId) throw new Error('Unauthorized');
  if (request.status !== 'pending' && request.status !== 'accepted') {
    throw new Error('Request cannot be cancelled');
  }

  const previousStatus = request.status;

  const { data, error } = await getSupabaseAdmin()
    .from('hire_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId)
    .in('status', ['pending', 'accepted'])
    .select('*')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Request cannot be cancelled');

  // If it had already been accepted the worker was marked "busy" - free them.
  if (previousStatus === 'accepted') {
    await getSupabaseAdmin()
      .from('worker_profiles')
      .update({ availability: 'available' })
      .eq('id', request.worker_id);
  }

  return mapHireRequest(data);
}
