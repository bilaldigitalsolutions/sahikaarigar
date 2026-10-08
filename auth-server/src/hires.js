// =============================================================================
// SahiKaarigar auth-server — hire requests
// =============================================================================
// Employer -> worker job requests, plus the live "on the way / reached" status
// and the location the worker shares. Mirrors src/services/hire.service.ts, but
// runs on the auth-server so the Firebase-hosted static build can use it.
//
//   pending -> accepted -> en_route -> arrived -> completed
//   (cancelled / rejected can happen before completion)
// =============================================================================

import { db } from './users.js';
import { getWorkerProfileIdForUser } from './workers.js';

export const HIRE_SELECT =
  'id, employer_id, worker_id, description, location, proposed_rate, status, ' +
  'scheduled_date, completed_at, phone_revealed, created_at, updated_at, ' +
  'en_route_at, arrived_at, worker_lat, worker_lng, ' +
  'employer:users(id, name, phone, avatar, location_area, location_city), ' +
  'worker:worker_profiles(id, user_id, skills, hourly_rate, rating_average, ' +
  'rating_count, availability, user:users(id, name, avatar, phone, location_area, location_city))';

/** Statuses from which a job can still be completed / cancelled. */
const TRACKABLE = ['accepted', 'en_route', 'arrived'];

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    avatar: row.avatar ?? null,
    phone: row.phone ?? null,
    locationArea: row.location_area ?? null,
    locationCity: row.location_city ?? null,
  };
}

export function mapHire(row) {
  if (!row) return null;
  const worker = row.worker
    ? {
        id: row.worker.id,
        userId: row.worker.user_id,
        skills: row.worker.skills ?? [],
        hourlyRate: row.worker.hourly_rate ?? 0,
        ratingAverage: Number(row.worker.rating_average ?? 0),
        ratingCount: row.worker.rating_count ?? 0,
        availability: row.worker.availability ?? 'available',
        user: mapUser(row.worker.user),
      }
    : null;

  return {
    id: row.id,
    employerId: row.employer_id,
    workerId: row.worker_id,
    description: row.description,
    location: row.location,
    proposedRate: row.proposed_rate,
    status: row.status,
    scheduledDate: row.scheduled_date ?? null,
    completedAt: row.completed_at ?? null,
    enRouteAt: row.en_route_at ?? null,
    arrivedAt: row.arrived_at ?? null,
    workerLat: row.worker_lat ?? null,
    workerLng: row.worker_lng ?? null,
    phoneRevealed: row.phone_revealed ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    employer: mapUser(row.employer),
    worker,
  };
}

async function fetchRaw(hireId) {
  const { data, error } = await db
    .from('hire_requests')
    .select('id, employer_id, worker_id, status')
    .eq('id', hireId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ?? null;
}

/** Create a hire request (user -> worker). */
export async function createHireRequest({
  employerId,
  workerId,
  description,
  location,
  proposedRate,
  scheduledDate,
}) {
  const text = String(description || '').trim();
  if (text.length < 10) throw new Error('Kaam ki detail kam se kam 10 letter likho');

  const place = String(location || '').trim();
  if (place.length < 3) throw new Error('Kaam ki jagah (location) likho');

  const rate = Number(proposedRate);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Rate sahi daalo');

  const { data: worker, error: workerError } = await db
    .from('worker_profiles')
    .select('id, is_approved, availability')
    .eq('id', workerId)
    .maybeSingle();

  if (workerError) throw new Error(workerError.message);
  if (!worker) throw new Error('Kaarigar nahi mila');
  if (!worker.is_approved) throw new Error('Ye kaarigar abhi approved nahi hai');
  if (worker.availability !== 'available') throw new Error('Ye kaarigar abhi available nahi hai');

  const { data: existing, error: existingError } = await db
    .from('hire_requests')
    .select('id')
    .eq('employer_id', employerId)
    .eq('worker_id', workerId)
    .in('status', ['pending', 'accepted', 'en_route', 'arrived'])
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existing) throw new Error('Is kaarigar ke saath aapki ek request pehle se chal rahi hai');

  const { data, error } = await db
    .from('hire_requests')
    .insert({
      employer_id: employerId,
      worker_id: workerId,
      description: text,
      location: place,
      proposed_rate: Math.round(rate),
      scheduled_date: scheduledDate ? new Date(scheduledDate).toISOString() : null,
    })
    .select(HIRE_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return mapHire(data);
}

/** Everything this user is involved in — as the hirer and as the worker. */
export async function listHiresForUser(userId) {
  const workerProfileId = await getWorkerProfileIdForUser(userId);

  const [asEmployerRes, asWorkerRes] = await Promise.all([
    db
      .from('hire_requests')
      .select(HIRE_SELECT)
      .eq('employer_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
    workerProfileId
      ? db
          .from('hire_requests')
          .select(HIRE_SELECT)
          .eq('worker_id', workerProfileId)
          .order('created_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (asEmployerRes.error) throw new Error(asEmployerRes.error.message);
  if (asWorkerRes.error) throw new Error(asWorkerRes.error.message);

  return {
    workerProfileId,
    asEmployer: (asEmployerRes.data ?? []).map(mapHire),
    asWorker: (asWorkerRes.data ?? []).map(mapHire),
  };
}

export async function getHireById(hireId) {
  const { data, error } = await db
    .from('hire_requests')
    .select(HIRE_SELECT)
    .eq('id', hireId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return mapHire(data);
}

/**
 * One endpoint for every state change, guarded by who is allowed to do what.
 * @param {{ hireId: string, userId: string, action: string, lat?: number, lng?: number }} input
 */
export async function hireAction({ hireId, userId, action, lat, lng }) {
  const raw = await fetchRaw(hireId);
  if (!raw) throw new Error('Hire request nahi mila');

  const workerProfileId = await getWorkerProfileIdForUser(userId);
  const isEmployer = raw.employer_id === userId;
  const isWorker = Boolean(workerProfileId) && raw.worker_id === workerProfileId;

  const patch = {};
  let workerBecomesBusy = false;
  let workerBecomesFree = false;
  let countJob = false;

  switch (action) {
    case 'accept':
      if (!isWorker) throw new Error('Sirf kaarigar hi accept kar sakta hai');
      if (raw.status !== 'pending') throw new Error('Ye request pending nahi hai');
      patch.status = 'accepted';
      workerBecomesBusy = true;
      break;

    case 'reject':
      if (!isWorker) throw new Error('Sirf kaarigar hi reject kar sakta hai');
      if (raw.status !== 'pending') throw new Error('Ye request pending nahi hai');
      patch.status = 'rejected';
      break;

    case 'en_route':
    case 'arrived': {
      if (!isWorker) throw new Error('Sirf kaarigar hi status badal sakta hai');
      if (!TRACKABLE.includes(raw.status)) throw new Error('Pehle request accept honi chahiye');
      patch.status = action;
      if (action === 'en_route') patch.en_route_at = new Date().toISOString();
      else patch.arrived_at = new Date().toISOString();
      if (Number.isFinite(Number(lat))) patch.worker_lat = Number(lat);
      if (Number.isFinite(Number(lng))) patch.worker_lng = Number(lng);
      break;
    }

    case 'complete':
      if (!isEmployer && !isWorker) throw new Error('Aap is request me shamil nahi ho');
      if (!TRACKABLE.includes(raw.status)) {
        throw new Error('Sirf accepted / en route / reached request complete ho sakti hai');
      }
      patch.status = 'completed';
      patch.completed_at = new Date().toISOString();
      countJob = true;
      workerBecomesFree = true;
      break;

    case 'cancel':
      if (!isEmployer) throw new Error('Sirf user hi cancel kar sakta hai');
      if (![...TRACKABLE, 'pending'].includes(raw.status)) {
        throw new Error('Ye request ab cancel nahi ho sakti');
      }
      patch.status = 'cancelled';
      workerBecomesFree = raw.status !== 'pending';
      break;

    default:
      throw new Error(`Unknown action "${action}"`);
  }

  const { data, error } = await db
    .from('hire_requests')
    .update(patch)
    .eq('id', hireId)
    .eq('status', raw.status) // optimistic — only if nothing changed underneath
    .select(HIRE_SELECT)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Status pehle hi badal chuka hai — refresh karke dobara try karo');

  if (countJob) {
    const { error: rpcError } = await db.rpc('increment_worker_completed_jobs', {
      p_worker_id: raw.worker_id,
    });
    if (rpcError) console.error('increment_worker_completed_jobs failed:', rpcError.message);
  }

  if (workerBecomesBusy || workerBecomesFree) {
    await db
      .from('worker_profiles')
      .update({ availability: workerBecomesBusy ? 'busy' : 'available' })
      .eq('id', raw.worker_id);
  }

  return mapHire(data);
}
