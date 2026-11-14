// =============================================================================
// SahiKaarigar — hire / review / worker API client (React Native)
// =============================================================================
// Thin wrapper over the auth-server (the same Express app the website talks to).
// The SuperTokens RN SDK patches global `fetch`, so it attaches the
// `Authorization: Bearer …` header for us — that session is what identifies the
// user (there is no separate signup form).
// =============================================================================

import type { HireAction, HireStatus, User, WorkerBadge } from '@/types';

import { initAuth } from './auth';
import { DEMO_MODE, requireAuthApiUrl } from './config';
import { reportError, trackEvent } from './observability';
import {
  addLocalCustomerReview,
  addLocalReview,
  applyLocalAction,
  createLocalHire,
  DEMO_USER,
  filterDemoWorkers,
  findDemoWorker,
  findLocalCustomerReview,
  findLocalReview,
  getLocalHire,
  listLocalHires,
  reviewsForWorker,
} from './demoData';
import { mapUser } from './mappers';

/**
 * CHANGE: single source of truth for all demo-only fallbacks in this module.
 * `DEMO_MODE` is derived from EXPO_PUBLIC_DEMO_MODE in lib/config.ts, so no
 * function reads process.env directly.
 */
export function isDemoMode(): boolean {
  return DEMO_MODE === true;
}

// -----------------------------------------------------------------------------
// Network — fetch with timeout wrapper.
// -----------------------------------------------------------------------------
// SSL pinning is NOT used. The react-native-ssl-pinning library crashes on
// Android (native RNSslPinningModule.fetch throws Throwable) when the
// certificate pin doesn't match. No JavaScript try/catch can prevent a native
// crash. Plain fetch with HTTPS provides full transport encryption.
// Pinning can be re-added later with a more reliable library if needed.
const REQUEST_TIMEOUT_MS = 15_000;

/** Fetch with a hard timeout. Aborts the request if it takes too long,
 *  preventing the app from hanging on slow or unresponsive servers. */
async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Thrown only when a request never reached the server (offline, DNS, timeout,
 * or a browser CORS block). CHANGE: read/write helpers fall back to bundled
 * demo data only when isDemoMode() is true; otherwise they rethrow a clear
 * NetworkError. Genuine API errors (4xx/5xx) remain ApiError and reach the UI
 * unchanged.
 */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

/** CHANGE: stable retry message for failed requests that must not fall back. */
const NETWORK_RETRY_MESSAGE =
  'Network error. Please check your connection and retry.';

/**
 * CHANGE: fail closed instead of returning fake/empty data. Callers can catch
 * `NetworkError` and show a retry action.
 */
function throwNetworkRetryError(): never {
  throw new NetworkError(NETWORK_RETRY_MESSAGE);
}

/** A real HTTP/API failure returned by the auth-server (4xx/5xx). The message
 *  is the server's message, so screens can show the actual reason instead of a
 *  generic "check your connection" error. */
export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/** Hard cap per request. Render's free tier sleeps, so the first hit after
 *  idle can stall for a minute+ — fail fast with a friendly retry message
 *  instead of leaving the user on a spinner forever. */
async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  initAuth();
  const base = requireAuthApiUrl();
  const method = (init?.method ?? 'GET').toUpperCase();

  let response: Response;
  try {
    response = await fetchWithTimeout(`${base}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch (e) {
    // fetchWithTimeout aborts on timeout after REQUEST_TIMEOUT_MS.
    // A network error (offline, DNS, dropped connection) also reaches here.
    const timedOut = e instanceof Error && e.name === 'AbortError';
    const err = new NetworkError(
      timedOut
        ? 'Server is waking up. Please try again in 10 seconds.'
        : 'Could not reach the server. Check your connection and try again.',
    );
    console.warn(`[api] ${method} ${path} network failure`, e);
    reportError(err, {
      where: 'apiFetch',
      path,
      method,
      kind: timedOut ? 'timeout' : 'network',
    });
    throw err;
  }

  const data = (await response.json().catch(() => null)) as
    | ({ ok?: boolean; message?: string; code?: string } & Record<string, unknown>)
    | null;

  if (!response.ok || !data?.ok) {
    const message =
      typeof data?.message === 'string' && data.message.trim()
        ? data.message
        : `Request failed (${response.status}). Please try again.`;
    const code = typeof data?.code === 'string' ? data.code : undefined;
    const err = new ApiError(message, response.status, code);
    console.warn(`[api] ${method} ${path} failed`, {
      status: response.status,
      code,
      message,
    });
    reportError(err, {
      where: 'apiFetch',
      path,
      method,
      status: response.status,
      code,
    });
    throw err;
  }

  return data as unknown as T;
}

// -----------------------------------------------------------------------------
// Types (mirror the shapes mapped in auth-server/src/*.js)
// -----------------------------------------------------------------------------

export interface ApiPublicUser {
  id: string;
  name: string;
  avatar?: string | null;
  phone?: string | null;
  locationArea?: string | null;
  locationCity?: string | null;
  isVerified?: boolean;
  trustScore?: number;
}

/** Worker -> customer rating aggregate (users.customer_rating_*). */
export interface ApiCustomerRating {
  average: number;
  count: number;
}

export type ApiAvailability = 'available' | 'busy' | 'offline';

export interface ApiWorker {
  id: string;
  userId: string;
  skills: string[];
  experience: number;
  description?: string | null;
  hourlyRate: number;
  availability: ApiAvailability;
  portfolio: string[];
  ratingAverage: number;
  ratingCount: number;
  completedJobs: number;
  /** Lifetime completed jobs (mirrors completedJobs). */
  totalJobsCompleted: number;
  /** Arrived within the booking's distance-aware window. */
  onTimeJobs: number;
  /** Average customer review rating (mirrors ratingAverage). */
  customerRatingAvg: number;
  /** Punctuality percentage: onTimeJobs / totalJobsCompleted * 100. */
  systemRatingScore: number;
  badge: WorkerBadge;
  serviceAreas: string[];
  lat?: number | null;
  lng?: number | null;
  /** Distance in km from the searched area — present only on radius searches.
   *  Worker coordinates themselves are never sent to public clients. */
  distanceKm?: number | null;
  isApproved: boolean;
  /** When this worker registered — used for the "recently joined" list. */
  createdAt?: string | null;
  /** ONLY on the worker's own profile — true when an Aadhaar is already on
   *  file. The raw number is never sent to the client. */
  aadhaarOnFile?: boolean;
  /** Masked Aadhaar (last 4 digits only) — owner's own profile only. */
  aadhaarMasked?: string | null;
  /** Admin review state of the profile — owner's own profile only. */
  verificationStatus?: string | null;
  /** Computed 0–100 trust score — owner's own profile only. */
  trustScore?: number;
  user: ApiPublicUser | null;
}

export interface ApiHireWorker {
  id: string;
  userId: string;
  skills: string[];
  serviceAreas?: string[];
  hourlyRate: number;
  ratingAverage: number;
  ratingCount: number;
  completedJobs: number;
  totalJobsCompleted: number;
  onTimeJobs: number;
  customerRatingAvg: number;
  systemRatingScore: number;
  badge: WorkerBadge;
  availability: ApiAvailability;
  user: ApiPublicUser | null;
}

export interface ApiHire {
  id: string;
  employerId: string;
  workerId: string;
  description: string;
  location: string;
  homeLocation?: string | null;
  proposedRate: number;
  status: HireStatus;
  /** Who cancelled (worker / employer) — null until the booking is cancelled. */
  cancelledBy?: 'worker' | 'employer' | null;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  /** Customer -> worker distance saved when the booking was created. */
  distanceKm?: number | null;
  /** Distance-derived arrival window: 20 / 35 / 50 minutes. */
  expectedArrivalMinutes?: number | null;
  /** null until arrival, then true when on time / false when late. */
  arrivedOnTime?: boolean | null;
  completedAt?: string | null;
  /** Server-calculated work duration from startedAt -> completedAt. */
  durationMinutes?: number | null;
  /** Server-calculated final bill; null until the job is completed. */
  totalAmount?: number | null;
  enRouteAt?: string | null;
  arrivedAt?: string | null;
  arrivedTime?: string | null;
  startedAt?: string | null;
  workerLat?: number | null;
  workerLng?: number | null;
  startOtp?: string | null;
  phoneRevealed: boolean;
  createdAt: string;
  updatedAt: string;
  /** Worker -> customer aggregate for the hire's employer. */
  customerRating?: ApiCustomerRating | null;
  employer: ApiPublicUser | null;
  worker: ApiHireWorker | null;
}

export interface ApiReview {
  id: string;
  hireRequestId: string;
  reviewerId: string;
  workerId: string;
  rating: number;
  comment?: string | null;
  tip?: number;
  likes?: string[];
  createdAt: string;
  reviewer: ApiPublicUser | null;
}

/** The worker's review of the CUSTOMER after a completed job. */
export interface ApiCustomerReview {
  id: string;
  hireRequestId: string;
  reviewerId: string;
  customerId: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  reviewer: ApiPublicUser | null;
}

// -----------------------------------------------------------------------------
// Workers — public reads (no session needed)
// -----------------------------------------------------------------------------

export async function searchWorkers(params: {
  skill?: string;
  area?: string;
  /** Search-place coordinates — switches the server to radius (surrounding)
   *  filtering and nearest-first sorting. */
  lat?: number;
  lng?: number;
  /** Radius in kilometres around the searched place (default 10 on the server). */
  radius?: number;
  page?: number;
  limit?: number;
}): Promise<{
  workers: ApiWorker[];
  pagination: { page: number; limit: number; total: number; pages: number };
}> {
  const query = new URLSearchParams();
  if (params.skill) query.set('skill', params.skill);
  if (params.area) query.set('area', params.area);
  if (params.lat != null && params.lng != null) {
    query.set('lat', String(params.lat));
    query.set('lng', String(params.lng));
  }
  if (params.radius != null) query.set('radius', String(params.radius));
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : '';

  try {
    return await apiFetch(`/workers${suffix}`);
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
    // CHANGE: demo workers are allowed only when demo mode is explicitly on.
    // In production this throws, so an empty list can only mean a real empty
    // result from the API.
    if (!isDemoMode()) throwNetworkRetryError();
    const workers = filterDemoWorkers({ skill: params.skill, area: params.area });
    return {
      workers,
      pagination: { page: 1, limit: workers.length, total: workers.length, pages: 1 },
    };
  }
}

export async function getWorker(
  id: string,
): Promise<{ worker: ApiWorker; reviews: ApiReview[]; reviewCount: number }> {
  try {
    return await apiFetch(`/workers/${encodeURIComponent(id)}`);
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
    // CHANGE: only an explicit demo build may resolve a bundled worker profile.
    if (!isDemoMode()) throwNetworkRetryError();
    const worker = findDemoWorker(id);
    if (!worker) throwNetworkRetryError();
    const reviews = reviewsForWorker(id);
    return { worker, reviews, reviewCount: reviews.length };
  }
}

// -----------------------------------------------------------------------------
// Auth / profile
// -----------------------------------------------------------------------------

export async function fetchMe(): Promise<User> {
  const data = await apiFetch<{ user: Record<string, unknown> }>('/me');
  return mapUser(data.user);
}

/**
 * Permanently delete the signed-in user's account and everything attached to
 * it (DPDP / Play policy: an in-app delete path). Rows and uploaded documents
 * are gone server-side; the caller must then clear the local session.
 */
export async function deleteUserAccount(): Promise<void> {
  await apiFetch<{ deleted: boolean }>('/account', { method: 'DELETE' });
}

export async function updateProfile(payload: {
  name?: string;
  address?: string;
  locationArea?: string;
  locationCity?: string;
}): Promise<User> {
  try {
    const data = await apiFetch<{ user: Record<string, unknown> }>('/profile', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return mapUser(data.user);
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
    // CHANGE: never fake a saved profile outside demo mode. The caller must
    // show the network error and let the user retry.
    if (!isDemoMode()) throwNetworkRetryError();
    return { ...DEMO_USER, ...payload };
  }
}

export async function registerWorker(payload: {
  name: string;
  profile: {
    skills: string[];
    experience: number;
    description?: string;
    hourlyRate: number;
    serviceAreas: string[];
    lat?: number;
    lng?: number;
    aadhaarNumber?: string;
    /** Data URLs (data:image/jpeg;base64,…) — uploaded to Supabase storage. */
    aadhaarPhotoDataUrl?: string;
    profilePhotoDataUrl?: string;
    workPhotoDataUrls?: string[];
  };
}): Promise<{ user: User; workerProfile: ApiWorker | null }> {
  try {
    const data = await apiFetch<{
      user: Record<string, unknown>;
      workerProfile: ApiWorker | null;
    }>('/register-worker', { method: 'POST', body: JSON.stringify(payload) });
    trackEvent('worker_registered', { skills: payload.profile.skills.length });
    return { user: mapUser(data.user), workerProfile: data.workerProfile };
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
    // CHANGE: registration must fail loudly in production. A fake success here
    // would make the worker believe an application exists when it does not.
    if (!isDemoMode()) throwNetworkRetryError();
    return { user: { ...DEMO_USER, name: payload.name, role: 'worker' }, workerProfile: null };
  }
}

// -----------------------------------------------------------------------------
// Hires — session required
// -----------------------------------------------------------------------------

export async function listHires(): Promise<{
  workerProfileId: string | null;
  asEmployer: ApiHire[];
  asWorker: ApiHire[];
}> {
  try {
    return await apiFetch('/hires');
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
    // CHANGE: an empty/old demo hire list is not a valid production fallback.
    if (!isDemoMode()) throwNetworkRetryError();
    return { workerProfileId: null, asEmployer: listLocalHires(), asWorker: [] };
  }
}

export async function getHire(id: string): Promise<{
  hire: ApiHire;
  /** Customer -> worker feedback. */
  review: ApiReview | null;
  /** Worker -> customer feedback. */
  customerReview: ApiCustomerReview | null;
}> {
  try {
    return await apiFetch(`/hires/${encodeURIComponent(id)}`);
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
    // CHANGE: local demo hires are demo-only; production must surface the
    // network failure instead of showing stale local state.
    if (!isDemoMode()) throwNetworkRetryError();
    const hire = getLocalHire(id);
    if (!hire) throwNetworkRetryError();
    return {
      hire,
      review: findLocalReview(id),
      customerReview: findLocalCustomerReview(id),
    };
  }
}

export async function createHire(payload: {
  workerId: string;
  description: string;
  location: string;
  homeLocation?: string;
  proposedRate: number;
  name?: string;
}): Promise<{ hire: ApiHire }> {
  try {
    const result = await apiFetch<{ hire: ApiHire }>('/hires', { method: 'POST', body: JSON.stringify(payload) });
    trackEvent('hire_created', { proposedRate: payload.proposedRate });
    return result;
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
    // CHANGE: use the single demo flag instead of reading process.env here.
    // Production builds must never create a fake booking that no worker sees.
    if (isDemoMode()) {
      return { hire: createLocalHire(payload) };
    }
    throwNetworkRetryError();
  }
}

export async function hireAction(
  id: string,
  action: HireAction,
  coords?: { lat?: number; lng?: number },
  otp?: string,
): Promise<{ hire: ApiHire }> {
  try {
    const result = await apiFetch<{ hire: ApiHire }>(`/hires/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ action, ...(coords ?? {}), ...(otp ? { otp } : {}) }),
    });
    if (action === 'accept') trackEvent('hire_accepted');
    if (action === 'arrived') trackEvent('hire_arrived');
    if (action === 'reject') trackEvent('hire_rejected');
    if (action === 'cancel') trackEvent('hire_cancelled');
    if (action === 'start') trackEvent('hire_started');
    if (action === 'complete') trackEvent('hire_completed');
    return result;
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
    // CHANGE: a failed status change is never simulated outside demo mode.
    if (!isDemoMode()) throwNetworkRetryError();
    const hire = getLocalHire(id);
    if (!hire) throwNetworkRetryError();
    return { hire: applyLocalAction(hire, action, coords, otp) };
  }
}

/**
 * The 4-digit "start work" OTP shown on the EMPLOYER's tracking screen once
 * the kaarigar has arrived. Employer-only — the worker types it in their app.
 */
export async function getHireStartOtp(id: string): Promise<{ otp: string }> {
  try {
    return await apiFetch<{ otp: string }>(`/hires/${encodeURIComponent(id)}/start-otp`);
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
    // CHANGE: demo-only start OTP fallback; production always fails closed.
    if (!isDemoMode()) throwNetworkRetryError();
    const hire = getLocalHire(id);
    if (!hire?.startOtp) throwNetworkRetryError();
    return { otp: hire.startOtp };
  }
}

// -----------------------------------------------------------------------------
// Worker dashboard — the kaarigar's own side of the app (session required)
// -----------------------------------------------------------------------------

export interface ApiWorkerStats {
  /** Hire requests waiting for an answer. */
  pending: number;
  /** Accepted but not finished (accepted / en_route / arrived). */
  active: number;
  /** Completed jobs still returned by the dashboard query. */
  completed: number;
  /** Bookings that ended cancelled (either side) within the dashboard window. */
  cancelled: number;
  /** Lifetime completed-jobs counter on the profile. */
  lifetimeJobs: number;
  /** Lifetime completed jobs (same as lifetimeJobs). */
  totalJobsCompleted: number;
  /** Jobs where the worker arrived within the distance-aware window. */
  onTimeJobs: number;
  /** Average customer review rating. */
  customerRatingAvg: number;
  /** Punctuality percentage: onTimeJobs / totalJobsCompleted * 100. */
  systemRatingScore: number;
  badge: WorkerBadge;
  /** Sum of the quoted rates of completed jobs (no hours are recorded). */
  estimatedEarnings: number;
  ratingAverage: number;
  ratingCount: number;
  isApproved: boolean;
}

export interface ApiWorkerDashboard {
  isWorker: boolean;
  worker: ApiWorker | null;
  stats: ApiWorkerStats | null;
  requests: ApiHire[];
  active: ApiHire[];
  completed: ApiHire[];
}

const EMPTY_WORKER_DASHBOARD: ApiWorkerDashboard = {
  isWorker: false,
  worker: null,
  stats: null,
  requests: [],
  active: [],
  completed: [],
};

export async function getWorkerDashboard(): Promise<ApiWorkerDashboard> {
  try {
    return await apiFetch('/worker/dashboard');
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
    // CHANGE: an empty dashboard is demo-only. Production must throw so an
    // approved worker is never flipped back to "Verification Pending".
    if (!isDemoMode()) throwNetworkRetryError();
    return EMPTY_WORKER_DASHBOARD;
  }
}

// -----------------------------------------------------------------------------
// Worker profile — the kaarigar's own editable registration details
// (Edit Profile screen reads/writes `worker_profiles` through these).
// -----------------------------------------------------------------------------

/** The signed-in worker's profile, or `null` when they have none (not a worker). */
export async function getWorkerProfile(): Promise<ApiWorker | null> {
  try {
    const data = await apiFetch<{ worker: ApiWorker | null }>('/worker/profile');
    return data.worker ?? null;
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
    // CHANGE: null previously meant both "not a worker" and "network failed".
    // Production now throws so the UI can distinguish the two states.
    if (!isDemoMode()) throwNetworkRetryError();
    return null;
  }
}

/**
 * Update the worker's own registration details. `serviceAreas` is optional —
 * only sent when the worker actually picked a new area, so untouched edits
 * never overwrite the geocoded lat/lng already stored on the profile.
 */
export async function updateWorkerProfile(payload: {
  skills: string[];
  experience: number;
  hourlyRate: number;
  serviceAreas?: string[];
  description?: string;
  /** Only accepted when no Aadhaar is on file yet (it is locked after that). */
  aadhaarNumber?: string;
  /** New profile photo as a data URL — replaces the current one. */
  profilePhotoDataUrl?: string;
  /** Remove the current profile photo. */
  removeProfilePhoto?: boolean;
  /** New work photos as data URLs — appended to the portfolio. */
  workPhotoDataUrls?: string[];
  /** The work-photo URLs the worker wants to KEEP (deleted ones are omitted). */
  portfolioToKeep?: string[];
}): Promise<ApiWorker | null> {
  try {
    const data = await apiFetch<{ worker: ApiWorker | null }>('/worker/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return data.worker ?? null;
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
    // CHANGE: never return a fake successful profile update in production.
    if (!isDemoMode()) throwNetworkRetryError();
    return null; // demo build — no live worker profile to update
  }
}

export async function setWorkerAvailability(
  availability: ApiAvailability,
): Promise<{ worker: ApiWorker | null }> {
  try {
    return await apiFetch('/worker/availability', {
      method: 'PATCH',
      body: JSON.stringify({ availability }),
    });
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
    // CHANGE: availability changes must fail loudly in production.
    if (!isDemoMode()) throwNetworkRetryError();
    return { worker: null };
  }
}

// -----------------------------------------------------------------------------
// Reviews + platform feedback
// -----------------------------------------------------------------------------

export async function createReview(payload: {
  hireRequestId: string;
  rating: number;
  comment?: string;
  tip?: number;
  likes?: string[];
}): Promise<{ review: ApiReview }> {
  try {
    const result = await apiFetch<{ review: ApiReview }>('/reviews', { method: 'POST', body: JSON.stringify(payload) });
    trackEvent('feedback_submitted', { rating: payload.rating });
    return result;
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
    // CHANGE: never fake a successful review in a production build.
    if (!isDemoMode()) throwNetworkRetryError();
    const hire = getLocalHire(payload.hireRequestId);
    return {
      review: addLocalReview({
        hireRequestId: payload.hireRequestId,
        workerId: hire?.workerId ?? 'demo-worker-1',
        rating: payload.rating,
        comment: payload.comment,
        tip: payload.tip,
        likes: payload.likes,
      }),
    };
  }
}

/**
 * Worker -> customer feedback after a completed job. Kept separate from
 * `createReview` because it targets the customer (employer), not the worker.
 */
export async function createCustomerReview(payload: {
  hireRequestId: string;
  rating: number;
  comment?: string;
}): Promise<{ customerReview: ApiCustomerReview }> {
  try {
    const result = await apiFetch<{ customerReview: ApiCustomerReview }>('/customer-reviews', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    trackEvent('feedback_submitted', { rating: payload.rating, side: 'worker' });
    return result;
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
    // CHANGE: demo-only customer review fallback.
    if (!isDemoMode()) throwNetworkRetryError();
    const hire = getLocalHire(payload.hireRequestId);
    return {
      customerReview: addLocalCustomerReview({
        hireRequestId: payload.hireRequestId,
        customerId: hire?.employerId ?? 'demo-employer-1',
        rating: payload.rating,
        comment: payload.comment,
      }),
    };
  }
}

export async function sendPlatformFeedback(payload: {
  hireRequestId?: string;
  rating: number;
  comment?: string;
}): Promise<{ feedback: { id: string; rating: number; comment: string | null } }> {
  try {
    return await apiFetch('/feedback', { method: 'POST', body: JSON.stringify(payload) });
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
    // CHANGE: demo-only platform-feedback fallback.
    if (!isDemoMode()) throwNetworkRetryError();
    return {
      feedback: {
        id: `demo-feedback-${Date.now()}`,
        rating: payload.rating,
        comment: payload.comment ?? null,
      },
    };
  }
}

// -----------------------------------------------------------------------------
// Push notifications — register this device's Expo push token with the server
// so hire status changes reach the user (see lib/notifications.ts).
// -----------------------------------------------------------------------------

export async function savePushToken(token: string): Promise<{ saved: boolean }> {
  return apiFetch('/me/push-token', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

/**
 * Ask the server to send ONE real push to THIS device (the "Test notification"
 * button on My Work). On failure the server answers 400 with a direct Hinglish
 * message (no push token on file / delivery failed) — apiFetch throws it as an
 * ApiError which the screen shows as-is.
 */
export async function sendTestPush(): Promise<{ sent: number; failed: number }> {
  return apiFetch('/me/test-push', { method: 'POST' });
}
