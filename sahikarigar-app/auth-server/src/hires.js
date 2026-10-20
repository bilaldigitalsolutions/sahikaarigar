// =============================================================================
// SahiKaarigar auth-server — hire requests
// =============================================================================
// Employer -> worker job requests, plus the live "on the way / reached" status
// and the location the worker shares. Mirrors src/services/hire.service.ts, but
// runs on the auth-server so the Firebase-hosted static build can use it.
//
//   pending -> accepted -> en_route -> arrived -> in_progress -> completed
//   (cancelled / rejected can happen before completion)
// =============================================================================

import crypto from 'node:crypto';

import { db } from './users.js';
import { getWorkerProfileIdForUser } from './workers.js';

export const HIRE_SELECT =
  'id, employer_id, worker_id, description, location, proposed_rate, status, ' +
  'scheduled_date, completed_at, phone_revealed, created_at, updated_at, ' +
  'en_route_at, arrived_at, started_at, worker_lat, worker_lng, ' +
  'employer:users(id, name, phone, avatar, location_area, location_city), ' +
  // `!user_id` pins the FK: worker_profiles also references users through
  // `reviewed_by`, and without the hint PostgREST fails with
  // "more than one relationship was found for 'worker_profiles' and 'users'".
  'worker:worker_profiles(id, user_id, skills, hourly_rate, rating_average, ' +
  'rating_count, availability, user:users!user_id(id, name, avatar, phone, location_area, location_city))';

/** Statuses from which a job can still be completed / cancelled.
 *  `in_progress` = the kaarigar reached the site and verified the start OTP. */
const TRACKABLE = ['accepted', 'en_route', 'arrived', 'in_progress'];

/** Worker cancels count AFTER accepting — at this many the profile is FLAGGED
 *  in the admin panel. Record-only: the admin decides any actual penalty. */
const WORKER_CANCEL_FLAG_LIMIT = 3;

/** Friendly hint when the 0010 migration columns (started_at …) are missing —
 *  a raw PostgREST "column … not found" tells the developer nothing useful. */
function hireReadError(error) {
  if (/started_at/i.test(error.message)) {
    return new Error(
      'Booking ka timeline abhi database me nahi hai — Supabase me 0010_hire_start_flow.sql migration chalao',
    );
  }
  return new Error(error.message);
}

// OTP secret used to derive start-work codes. No hardcoded fallback: a default
// baked into source would let anyone with repo access derive the start-OTP for
// ANY hire id (HMAC with a known key). If missing or too short, the server
// keeps booting (so other endpoints keep working) but the start-OTP endpoint
// returns a 500 until OTP_SECRET is set properly on Render.
const OTP_SECRET = process.env.OTP_SECRET || '';
if (OTP_SECRET.length < 16) {
  console.warn(
    'OTP_SECRET is missing (or shorter than 16 chars). Start-work OTP endpoint ' +
      'will return 500 until a valid secret is set. Generate one: ' +
      'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
  );
}

/** Statuses from which BOTH sides may see each other's phone number. Before
 *  'accepted' the numbers are stripped server-side — masking must live in the
 *  API, not just in a disabled button, otherwise the payload still leaks them. */
const PHONE_REVEALED_STATUSES = ['accepted', 'en_route', 'arrived', 'in_progress', 'completed'];

// ------------------------------ start-OTP rate limit -------------------------
/** Guesses allowed per (user, hire) per window — a 4-digit code must never be
 *  brute-forceable. Persisted in Supabase `rate_limits` table so the limit
 *  survives Render redeploys (unlike an in-memory Map). */
const START_OTP_MAX_ATTEMPTS = 5;
const START_OTP_WINDOW_MS = 60_000;

/** Error that carries its own HTTP status — the fallback error handler turns
 *  it into the real status code (429) instead of the generic 400. */
class StatusError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** Persist one failed attempt for the given (hireId, userId) key. */
async function recordRateLimitAttempt(key) {
  const { error } = await db.from('rate_limits').insert({ key });
  if (error) throw new Error(error.message);
}

/** Count attempts for the given key within the sliding window. */
async function getRecentRateLimitAttempts(key, windowMs) {
  const cutoff = new Date(Date.now() - windowMs).toISOString();
  const { data, error } = await db
    .from('rate_limits')
    .select('id')
    .eq('key', key)
    .gte('created_at', cutoff);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Throws StatusError(429) if the user has exceeded the start-OTP attempt
 *  limit for this hire. Otherwise records the attempt and returns. */
async function assertStartOtpAllowed(hireId, userId) {
  const key = `start_otp:${hireId}:${userId}`;
  const recent = await getRecentRateLimitAttempts(key, START_OTP_WINDOW_MS);
  if (recent.length >= START_OTP_MAX_ATTEMPTS) {
    throw new StatusError(
      'Bahut zyada galat OTP attempts. Kripya 1 minute baad try karein.',
      429,
      'RATE_LIMITED',
    );
  }
  await recordRateLimitAttempt(key);
}

/**
 * Deterministic 4-digit "start work" code derived from the hire id + a server
 * secret. Stable across restarts and instances, needs no DB write — this is
 * the OTP for any hire whose `start_otp` column is empty (hires created
 * before the OTP migration ran, or by code paths that never stored one).
 */
export function hireStartOtp(hireId) {
  if (OTP_SECRET.length < 16) {
    throw new Error(
      'OTP_SECRET is not configured on the server. Start-work OTP cannot be generated.',
    );
  }
  const digest = crypto
    .createHmac('sha256', OTP_SECRET)
    .update(`start-otp:${hireId}`)
    .digest('hex');
  return String(parseInt(digest.slice(0, 8), 16) % 10000).padStart(4, '0');
}

/** The hire's stored start_otp (null when the column is not there yet, or no code was stored). */
async function storedStartOtp(hireId) {
  try {
    const { data, error } = await db
      .from('hire_requests')
      .select('id, start_otp')
      .eq('id', hireId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data?.start_otp ?? null;
  } catch {
    // Column not added yet, or a transient read failure — the derived code
    // above decides the OTP in that case, so this must never break the flow.
    return null;
  }
}

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

/** mapUser + phone stripping until the booking is accepted (see above). */
function mapHireUser(row, revealPhone) {
  const user = mapUser(row);
  if (user && !revealPhone) user.phone = null;
  return user;
}

export function mapHire(row) {
  if (!row) return null;
  const revealPhone = PHONE_REVEALED_STATUSES.includes(row.status);
  const worker = row.worker
    ? {
        id: row.worker.id,
        userId: row.worker.user_id,
        skills: row.worker.skills ?? [],
        hourlyRate: row.worker.hourly_rate ?? 0,
        ratingAverage: Number(row.worker.rating_average ?? 0),
        ratingCount: row.worker.rating_count ?? 0,
        availability: row.worker.availability ?? 'available',
        user: mapHireUser(row.worker.user, revealPhone),
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
    startedAt: row.started_at ?? null,
    workerLat: row.worker_lat ?? null,
    workerLng: row.worker_lng ?? null,
    phoneRevealed: revealPhone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    employer: mapHireUser(row.employer, revealPhone),
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

  if (error) throw hireReadError(error);
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

  if (asEmployerRes.error) throw hireReadError(asEmployerRes.error);
  if (asWorkerRes.error) throw hireReadError(asWorkerRes.error);

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

  if (error) throw hireReadError(error);
  return mapHire(data);
}

/**
 * The "start work" OTP, for the EMPLOYER's eyes only. Reads the stored code
 * when one exists (older mirror rows), otherwise the deterministic derived
 * code. Only revealed once the kaarigar has reached the site.
 * @param {{ hireId: string, userId: string }} input
 */
export async function getHireStartOtp({ hireId, userId }) {
  const raw = await fetchRaw(hireId);
  if (!raw) throw new Error('Hire request nahi mila');
  if (raw.employer_id !== userId) throw new Error('Sirf customer hi OTP dekh sakta hai');
  if (!['arrived', 'in_progress'].includes(raw.status)) {
    throw new Error('OTP kaam ke waqt hi dikhta hai — pehle kaarigar pahunchne de');
  }
  const otp = (await storedStartOtp(hireId)) || hireStartOtp(hireId);
  return { otp };
}

/**
 * One endpoint for every state change, guarded by who is allowed to do what.
 * @param {{ hireId: string, userId: string, action: string, lat?: number, lng?: number, otp?: string }} input
 */
export async function hireAction({ hireId, userId, action, lat, lng, otp }) {
  const raw = await fetchRaw(hireId);
  if (!raw) throw new Error('Hire request nahi mila');

  const workerProfileId = await getWorkerProfileIdForUser(userId);
  const isEmployer = raw.employer_id === userId;
  const isWorker = Boolean(workerProfileId) && raw.worker_id === workerProfileId;

  const patch = {};
  let workerBecomesBusy = false;
  let workerBecomesFree = false;
  let countJob = false;
  /** Set by the cancel case — Trust & Penalty bookkeeping AFTER the update. */
  let trustPenalty = null;

  switch (action) {
    case 'accept': {
      if (!isWorker) throw new Error('Sirf kaarigar hi accept kar sakta hai');
      if (raw.status !== 'pending') throw new Error('Ye request pending nahi hai');
      // Business rule: one active job at a time. Before flipping this request
      // to 'accepted', make sure the worker is not already mid-job — otherwise
      // they could juggle two jobs (e.g. accept a second request from another
      // device while the first is still in progress).
      {
        const { data: activeJob, error: activeError } = await db
          .from('hire_requests')
          .select('id')
          .eq('worker_id', workerProfileId)
          .neq('id', hireId)
          .in('status', ['accepted', 'en_route', 'arrived', 'in_progress'])
          .maybeSingle();
        if (activeError) throw new Error(activeError.message);
        if (activeJob) {
          throw new Error(
            'You already have an active job. Please complete it before accepting a new one.',
          );
        }
      }
      patch.status = 'accepted';
      workerBecomesBusy = true;
      break;
    }

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
      // Business rule: only the employer can close a job as completed.
      if (!isEmployer) throw new Error('Sirf employer hi request complete kar sakta hai');
      if (!TRACKABLE.includes(raw.status)) {
        throw new Error('Sirf accepted / on the way / reached / in-progress request complete ho sakti hai');
      }
      patch.status = 'completed';
      patch.completed_at = new Date().toISOString();
      countJob = true;
      workerBecomesFree = true;
      break;

    case 'start': {
      // "Start Work" — only the kaarigar, only once they are on site, and only
      // with the 4-digit OTP the customer sees on their tracking screen. The
      // OTP is the proof the customer witnessed the work beginning.
      if (!isWorker) throw new Error('Sirf kaarigar hi kaam shuru kar sakta hai');
      if (raw.status !== 'arrived') {
        throw new Error('Kaarigar pehle customer ke paas pahunche bina kaam shuru nahi kar sakte');
      }
      // Brute-force guard — every guess on this (user, hire) counts, malformed
      // ones included; the 6th try within a minute locks with a 429.
      await assertStartOtpAllowed(hireId, userId);
      const code = String(otp ?? '').trim();
      if (!/^\d{4}$/.test(code)) throw new Error('4 digit ka OTP daalo');
      const expected = (await storedStartOtp(hireId)) || hireStartOtp(hireId);
      if (code !== expected) {
        throw new Error('OTP galat hai — customer ke screen ka sahi code daalo');
      }
      patch.status = 'in_progress';
      patch.started_at = new Date().toISOString();
      break;
    }

    case 'cancel': {
      // Both sides may step out of the booking: the employer before/at any
      // stage, the kaarigar too (genuine emergencies happen) — but every
      // cancellation is RECORDED, never auto-blocked (Trust & Penalty).
      if (!isEmployer && !isWorker) {
        throw new Error('Sirf is booking ke employer ya kaarigar hi cancel kar sakte hain');
      }
      if (![...TRACKABLE, 'pending'].includes(raw.status)) {
        throw new Error('Ye request ab cancel nahi ho sakti');
      }
      patch.status = 'cancelled';
      patch.cancelled_by = isWorker ? 'worker' : 'employer';
      patch.cancelled_at = new Date().toISOString();
      workerBecomesFree = raw.status !== 'pending';

      // Trust & Penalty — only RECORD for admin review, never block:
      //   worker cancels after committing (accepted/en_route/arrived) →
      //     cancel_count++, is_flagged at the 3rd strike;
      //   employer cancels while the kaarigar is already en_route/arrived →
      //     their account gets flagged (no-show behaviour).
      if (isWorker && ['accepted', 'en_route', 'arrived'].includes(raw.status)) {
        trustPenalty = { kind: 'worker_cancelled_late' };
      } else if (isEmployer && ['en_route', 'arrived'].includes(raw.status)) {
        trustPenalty = { kind: 'employer_cancelled_after_travel' };
      }
      break;
    }

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

  if (error) {
    // The status CHECK constraint still lists only the old states — the
    // 0010_hire_start_flow.sql migration has not been applied to this database.
    if (/hire_requests_status/i.test(error.message)) {
      throw new Error(
        'Kaam shuru ka status abhi database me support nahi hai — Supabase me 0010_hire_start_flow.sql migration chalao',
      );
    }
    // Timeline column missing — 0010_hire_start_flow.sql not applied (the
    // CHECK above catches constraint failures; this catches the select).
    if (/started_at/i.test(error.message)) {
      throw new Error(
        'Booking ka timeline abhi database me nahi hai — Supabase me 0010_hire_start_flow.sql migration chalao',
      );
    }
    // Trust & Penalty columns are missing — 0011_trust_penalty.sql not applied.
    if (/cancelled_by|cancelled_at|cancel_count|is_flagged/i.test(error.message)) {
      throw new Error(
        'Cancel tracking abhi database me support nahi hai — Supabase me 0011_trust_penalty.sql migration chalao',
      );
    }
    throw new Error(error.message);
  }
  if (!data) throw new Error('Status pehle hi badal chuka hai — refresh karke dobara try karo');

  // ------------------------- Trust & Penalty bookkeeping ---------------------
  // Record-only: bump counters / set flags for the ADMIN PANEL to show. No
  // blocking, no availability changes, no punishing automation — a human in
  // the admin panel decides what happens to a flagged account.
  if (trustPenalty?.kind === 'worker_cancelled_late') {
    const { data: profileRow, error: profileError } = await db
      .from('worker_profiles')
      .select('cancel_count, is_flagged')
      .eq('id', raw.worker_id)
      .maybeSingle();
    if (profileError) {
      console.error('worker cancel tracking failed:', profileError.message);
    } else if (profileRow) {
      const cancelCount = (profileRow.cancel_count ?? 0) + 1;
      const trustUpdate = { cancel_count: cancelCount };
      if (cancelCount >= WORKER_CANCEL_FLAG_LIMIT && !profileRow.is_flagged) {
        trustUpdate.is_flagged = true;
      }
      const { error: trustError } = await db
        .from('worker_profiles')
        .update(trustUpdate)
        .eq('id', raw.worker_id);
      if (trustError) console.error('worker cancel tracking failed:', trustError.message);
    }
  } else if (trustPenalty?.kind === 'employer_cancelled_after_travel') {
    const { error: trustError } = await db
      .from('users')
      .update({ is_flagged: true })
      .eq('id', raw.employer_id);
    if (trustError) console.error('employer flag failed:', trustError.message);
  }

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
