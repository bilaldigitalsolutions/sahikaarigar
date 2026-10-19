// =============================================================================
// SahiKaarigar — hire / review / worker API client (React Native)
// =============================================================================
// Thin wrapper over the auth-server (the same Express app the website talks to).
// The SuperTokens RN SDK patches global `fetch`, so it attaches the
// `Authorization: Bearer …` header for us — that session is what identifies the
// user (there is no separate signup form).
// =============================================================================

import type { HireAction, HireStatus, User } from '@/types';

import { initAuth } from './auth';
import { DEMO_MODE, requireAuthApiUrl } from './config';
import { reportError, trackEvent } from './observability';
import {
  addLocalReview,
  applyLocalAction,
  createLocalHire,
  DEMO_USER,
  filterDemoWorkers,
  findDemoWorker,
  findLocalReview,
  getLocalHire,
  listLocalHires,
  reviewsForWorker,
} from './demoData';
import { mapUser } from './mappers';

/**
 * Thrown when a request never reached the server (offline, DNS, or a browser
 * CORS block). The read/write helpers below fall back to bundled demo data in
 * that case so the app stays usable — genuine API errors (4xx/5xx) still throw.
 */
export class NetworkError extends Error {}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  initAuth();
  const base = requireAuthApiUrl();

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    const message = 'Could not reach the server. Check your connection and try again.';
    // Only an explicit demo build (EXPO_PUBLIC_DEMO_MODE=1) may swallow an
    // unreachable server. In a normal build the plain Error propagates, so every
    // caller shows the real failure instead of silently using sample data.
    throw DEMO_MODE ? new NetworkError(message) : new Error(message);
  }

  const data = (await response.json().catch(() => null)) as
    | ({ ok?: boolean; message?: string } & Record<string, unknown>)
    | null;

  if (!response.ok || !data?.ok) {
    const err = new Error((data?.message as string) || 'Request failed. Please try again.');
    // API failures go to Sentry with path + status — never PII, never bodies.
    reportError(err, { where: 'apiFetch', path, status: response.status });
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
  serviceAreas: string[];
  lat?: number | null;
  lng?: number | null;
  isApproved: boolean;
  /** When this worker registered — used for the "recently joined" list. */
  createdAt?: string | null;
  user: ApiPublicUser | null;
}

export interface ApiHireWorker {
  id: string;
  userId: string;
  skills: string[];
  hourlyRate: number;
  ratingAverage: number;
  ratingCount: number;
  availability: ApiAvailability;
  user: ApiPublicUser | null;
}

export interface ApiHire {
  id: string;
  employerId: string;
  workerId: string;
  description: string;
  location: string;
  proposedRate: number;
  status: HireStatus;
  scheduledDate?: string | null;
  completedAt?: string | null;
  enRouteAt?: string | null;
  arrivedAt?: string | null;
  startedAt?: string | null;
  workerLat?: number | null;
  workerLng?: number | null;
  startOtp?: string | null;
  phoneRevealed: boolean;
  createdAt: string;
  updatedAt: string;
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

// -----------------------------------------------------------------------------
// Workers — public reads (no session needed)
// -----------------------------------------------------------------------------

export async function searchWorkers(params: {
  skill?: string;
  area?: string;
  page?: number;
  limit?: number;
}): Promise<{
  workers: ApiWorker[];
  pagination: { page: number; limit: number; total: number; pages: number };
}> {
  const query = new URLSearchParams();
  if (params.skill) query.set('skill', params.skill);
  if (params.area) query.set('area', params.area);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : '';

  try {
    return await apiFetch(`/workers${suffix}`);
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
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
    const worker = findDemoWorker(id);
    if (!worker) throw e;
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
 * Delete the signed-in user's account and everything attached to it
 * (Play policy: an in-app delete path). Rows are gone server-side; the caller
 * must then sign out locally.
 */
export async function deleteAccount(): Promise<void> {
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
    return { workerProfileId: null, asEmployer: listLocalHires(), asWorker: [] };
  }
}

export async function getHire(id: string): Promise<{ hire: ApiHire; review: ApiReview | null }> {
  try {
    return await apiFetch(`/hires/${encodeURIComponent(id)}`);
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
    const hire = getLocalHire(id);
    if (!hire) throw e;
    return { hire, review: findLocalReview(id) };
  }
}

export async function createHire(payload: {
  workerId: string;
  description: string;
  location: string;
  proposedRate: number;
  name?: string;
}): Promise<{ hire: ApiHire }> {
  try {
    const result = await apiFetch<{ hire: ApiHire }>('/hires', { method: 'POST', body: JSON.stringify(payload) });
    trackEvent('hire_created', { proposedRate: payload.proposedRate });
    return result;
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
    // ONLY an explicit demo build may fall back to a simulated local hire.
    // A real build must NEVER: a Render cold-start / timeout would otherwise
    // silently create a phantom booking that no worker sees and no admin can
    // track. Surface a clear network error instead so the user can retry.
    if (DEMO_MODE) return { hire: createLocalHire(payload) };
    throw new Error('Network se connect nahi ho paaya. Internet check karo aur dobara try karo.');
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
    if (action === 'start') trackEvent('hire_started');
    if (action === 'complete') trackEvent('hire_completed');
    return result;
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
    const hire = getLocalHire(id);
    if (!hire) throw e;
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
    const hire = getLocalHire(id);
    if (!hire?.startOtp) throw e;
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
  /** Lifetime completed-jobs counter on the profile. */
  lifetimeJobs: number;
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
}): Promise<ApiWorker | null> {
  try {
    const data = await apiFetch<{ worker: ApiWorker | null }>('/worker/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    return data.worker ?? null;
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
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

export async function sendPlatformFeedback(payload: {
  hireRequestId?: string;
  rating: number;
  comment?: string;
}): Promise<{ feedback: { id: string; rating: number; comment: string | null } }> {
  try {
    return await apiFetch('/feedback', { method: 'POST', body: JSON.stringify(payload) });
  } catch (e) {
    if (!(e instanceof NetworkError)) throw e;
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
