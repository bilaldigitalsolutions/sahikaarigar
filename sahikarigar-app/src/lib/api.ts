'use client';

// =============================================================================
// SahiKaarigar — hire / review / worker API client
// =============================================================================
// Thin wrapper over the auth-server (same origin as the SuperTokens calls). The
// SuperTokens SDK attaches `Authorization: Bearer …` to these fetches, so the
// session is what identifies the user — there is no separate signup.
// =============================================================================

import { initSuperTokens } from './supertokens';

const AUTH_API_URL = (process.env.NEXT_PUBLIC_AUTH_API_URL ?? '').replace(/\/+$/, '');

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  initSuperTokens();

  const response = await fetch(`${AUTH_API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });

  const data = (await response.json().catch(() => null)) as
    | { ok?: boolean; message?: string }
    | null;

  if (!response.ok || !data?.ok) {
    throw new Error(data?.message || 'Request fail ho gayi. Dobara try karo.');
  }
  return data as T;
}

export interface AdminSession {
  email: string;
  role: 'admin';
}

/**
 * The admin session lives in an HttpOnly cookie set by the auth server, so it
 * is never exposed to JavaScript — an XSS can no longer steal a full admin
 * session. `adminApiFetch` therefore sends no `Authorization` header; the
 * browser attaches the cookie automatically via `credentials: 'include'`.
 *
 * Only the (non-secret) admin email is kept in localStorage, purely so the
 * shell can show the logged-in admin's name without an extra round-trip.
 */
const ADMIN_EMAIL_KEY = 'admin_email';

/**
 * Marker set when the admin explicitly logs out.
 *
 * The session cookie is HttpOnly, so JavaScript cannot delete it. If the
 * logout request to the backend fails (Render asleep / cold start), the
 * cookie is still valid server-side and the next page load would happily
 * restore the session — making Logout look like it "did nothing".
 *
 * This flag makes the explicit logout authoritative on the client: the guard
 * refuses to auto-restore a session while it is set. It is cleared again by a
 * successful `adminLogin()`.
 */
const ADMIN_SIGNED_OUT_KEY = 'admin_signed_out';

/** Default timeout for admin API calls (ms). */
const ADMIN_REQUEST_TIMEOUT_MS = 20_000;

/**
 * Timeout for the logout call (ms). Deliberately short: logging out must feel
 * instant even when the backend is cold. Server-side cookie clearing is
 * best-effort — the client-side session is torn down regardless.
 */
const ADMIN_LOGOUT_TIMEOUT_MS = 5_000;

export function getAdminEmail(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ADMIN_EMAIL_KEY);
  } catch {
    return null;
  }
}

/** True when the admin explicitly logged out and has not logged in again. */
export function isAdminSignedOut(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(ADMIN_SIGNED_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

function markAdminSignedOut(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ADMIN_SIGNED_OUT_KEY, '1');
  } catch {
    /* storage unavailable (private mode) — the in-memory event still fires */
  }
}

function clearAdminSignedOut(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ADMIN_SIGNED_OUT_KEY);
  } catch {
    /* storage unavailable — nothing to clear */
  }
}

export function clearAdminSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ADMIN_EMAIL_KEY);
  } catch {
    /* storage unavailable (private mode) — nothing to clear */
  }
}

function notifyUnauthorized(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('sahikarigar-admin-unauthorized'));
  }
}

interface AdminFetchInit extends RequestInit {
  /** Abort the request after this many milliseconds. */
  timeoutMs?: number;
}

async function adminApiFetch<T>(path: string, init?: AdminFetchInit): Promise<T> {
  if (!AUTH_API_URL) {
    throw new Error('Auth server configure nahi hai (NEXT_PUBLIC_AUTH_API_URL).');
  }
  const { timeoutMs = ADMIN_REQUEST_TIMEOUT_MS, signal: callerSignal, ...rest } = init ?? {};

  const headers = new Headers(rest.headers);
  // Only send Content-Type when there is a body. Setting it on a GET makes the
  // request "non-simple", which forces a CORS preflight — doubling the
  // round-trips and making a cold backend start feel even slower.
  if (rest.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  let response: Response;
  try {
    response = await fetch(`${AUTH_API_URL}${path}`, {
      ...rest,
      // Required so the browser sends/receives the HttpOnly admin cookie.
      credentials: 'include',
      headers,
      signal: controller.signal,
    });
  } catch (failure) {
    const aborted = (failure as Error)?.name === 'AbortError';
    const error = new Error(
      aborted
        ? 'Server ne time par respond nahi kiya. Dobara try karo.'
        : 'Server se connection nahi ho paya (network ya CORS error).',
    );
    (error as Error & { status?: number }).status = undefined;
    throw error;
  } finally {
    clearTimeout(timer);
  }

  const data = (await response.json().catch(() => null)) as
    | { ok?: boolean; message?: string; admin?: AdminSession }
    | null;

  // Network failures never reach this point (fetch rejects) and a 5xx is a
  // server problem — in both cases the cookie is kept and the admin stays
  // logged in. Only a genuine 401 means the session is invalid/expired.
  if (response.status === 401) {
    clearAdminSession();
    notifyUnauthorized();
  }

  if (!response.ok || !data?.ok) {
    const error = new Error(data?.message || 'Admin request fail ho gayi. Dobara try karo.');
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return data as T;
}

export async function adminLogin(payload: {
  email: string;
  password: string;
}): Promise<{ admin: AdminSession }> {
  const data = await adminApiFetch<{ admin: AdminSession }>('/admin/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  // A successful login cancels any previous explicit logout.
  clearAdminSignedOut();
  if (data.admin?.email && typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(ADMIN_EMAIL_KEY, data.admin.email);
    } catch {
      /* storage unavailable — the shell just falls back to a default name */
    }
  }
  return { admin: data.admin };
}

/**
 * Validates the current cookie session against the server. Returns the admin
 * on success, throws on 401. Callers must treat a 5xx/network error separately
 * (see AdminGuard) so a cold backend start never logs the admin out.
 */
export function getAdminSession(): Promise<{ admin: AdminSession }> {
  return adminApiFetch('/admin/session');
}

/**
 * Signs the admin out.
 *
 * The server call is BEST-EFFORT ONLY. The backend may be asleep (Render cold
 * start), unreachable, or CORS-blocked — in any of those cases the request can
 * take a long time or fail outright. The `finally` block guarantees the local
 * session is ALWAYS torn down and the guard is always notified, so the admin
 * can never be stranded in a half-logged-in state.
 *
 * Because the session cookie is HttpOnly we cannot delete it from JavaScript.
 * That is why `markAdminSignedOut()` persists an explicit "signed out" marker:
 * it stops AdminGuard from silently restoring the still-valid server session
 * on the next page load.
 */
export async function adminLogout(): Promise<void> {
  try {
    await adminApiFetch('/admin/logout', {
      method: 'POST',
      timeoutMs: ADMIN_LOGOUT_TIMEOUT_MS,
    });
  } catch {
    /* The backend could not be reached — the local session is still cleared
       below, which is what actually matters for the user. */
  } finally {
    markAdminSignedOut();
    clearAdminSession();
    notifyUnauthorized();
  }
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
  user: ApiPublicUser | null;
}

export type HireStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'completed'
  | 'cancelled'
  | 'en_route'
  | 'arrived';

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
  workerLat?: number | null;
  workerLng?: number | null;
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
  createdAt: string;
  reviewer: ApiPublicUser | null;
}

export type HireAction = 'accept' | 'reject' | 'en_route' | 'arrived' | 'complete' | 'cancel';

// -----------------------------------------------------------------------------
// Endpoints
// -----------------------------------------------------------------------------

export function searchWorkers(params: {
  skill?: string;
  area?: string;
  page?: number;
  limit?: number;
}): Promise<{ workers: ApiWorker[]; pagination: { total: number; page: number; pages: number } }> {
  const query = new URLSearchParams();
  if (params.skill) query.set('skill', params.skill);
  if (params.area) query.set('area', params.area);
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiFetch(`/workers${suffix}`);
}

export function getWorker(
  id: string,
): Promise<{ worker: ApiWorker; reviews: ApiReview[]; reviewCount: number }> {
  return apiFetch(`/workers/${encodeURIComponent(id)}`);
}

export function listHires(): Promise<{
  workerProfileId: string | null;
  asEmployer: ApiHire[];
  asWorker: ApiHire[];
}> {
  return apiFetch('/hires');
}

export function getHire(id: string): Promise<{ hire: ApiHire; review: ApiReview | null }> {
  return apiFetch(`/hires/${encodeURIComponent(id)}`);
}

export function createHire(payload: {
  workerId: string;
  description: string;
  location: string;
  proposedRate: number;
  name?: string;
}): Promise<{ hire: ApiHire }> {
  return apiFetch('/hires', { method: 'POST', body: JSON.stringify(payload) });
}

export function hireAction(
  id: string,
  action: HireAction,
  coords?: { lat?: number; lng?: number },
): Promise<{ hire: ApiHire }> {
  return apiFetch(`/hires/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ action, ...(coords ?? {}) }),
  });
}

export function createReview(payload: {
  hireRequestId: string;
  rating: number;
  comment?: string;
}): Promise<{ review: ApiReview }> {
  return apiFetch('/reviews', { method: 'POST', body: JSON.stringify(payload) });
}

export function sendPlatformFeedback(payload: {
  hireRequestId?: string;
  rating: number;
  comment?: string;
}): Promise<{ feedback: { id: string; rating: number; comment: string | null } }> {
  return apiFetch('/feedback', { method: 'POST', body: JSON.stringify(payload) });
}

/** Best-effort browser location (never throws — returns {} when denied). */
export function getBrowserLocation(): Promise<{ lat?: number; lng?: number }> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({});
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
        }),
      () => resolve({}),
      { timeout: 8000, maximumAge: 60_000 },
    );
  });
}

// -----------------------------------------------------------------------------
// Admin
// -----------------------------------------------------------------------------

export type VerificationStatus = 'pending' | 'approved' | 'rejected';

/**
 * Users created without a real name are stored with the literal placeholder
 * `'User'` (see auth-server/src/users.js). Rendering that verbatim looks like
 * garbage data in the admin panel, so map placeholder/empty names to a neutral
 * label everywhere names are shown.
 */
export function displayName(name: string | null | undefined): string {
  const value = typeof name === 'string' ? name.trim() : '';
  if (!value) return 'Name Not Set';
  if (value.toLowerCase() === 'user') return 'Name Not Set';
  return value;
}

export interface ApiAdminWorker {
  id: string;
  userId: string;
  skills: string[];
  experience: number;
  description?: string | null;
  hourlyRate: number;
  availability: ApiAvailability;
  portfolio?: string[];
  serviceAreas: string[];
  ratingAverage?: number;
  ratingCount?: number;
  completedJobs?: number;
  lat?: number | null;
  lng?: number | null;
  isApproved: boolean;
  verificationStatus: VerificationStatus;
  adminNotes?: string | null;
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  aadhaarNumber?: string | null;
  aadhaarPhotoUrl?: string | null;
  /** Trust & Penalty (record-only, admin decides any action). */
  cancelCount?: number;
  isFlagged?: boolean;
  createdAt: string;
  updatedAt?: string | null;
  user: {
    id: string;
    name: string;
    phone?: string | null;
    avatar?: string | null;
    locationArea?: string | null;
    locationCity?: string | null;
    createdAt?: string | null;
  } | null;
}

export type ApiPendingWorker = ApiAdminWorker;

export function listAdminWorkers(status: VerificationStatus, page = 1): Promise<{
  workers: ApiAdminWorker[];
  pagination: { total: number; page: number; pages: number; limit: number };
}> {
  return adminApiFetch(`/admin/workers?status=${encodeURIComponent(status)}&page=${page}`);
}

export function listPendingWorkers(): Promise<{
  workers: ApiPendingWorker[];
  pagination: { total: number; page: number; pages: number; limit: number };
}> {
  return listAdminWorkers('pending');
}

export function getAdminWorker(id: string): Promise<{ worker: ApiAdminWorker }> {
  return adminApiFetch(`/admin/workers/${encodeURIComponent(id)}`);
}

export function setWorkerApproval(
  id: string,
  approved: boolean,
  adminNotes?: string,
): Promise<{
  worker: {
    id: string;
    isApproved: boolean;
    verificationStatus: VerificationStatus;
    adminNotes: string | null;
    rejectionReason?: string | null;
    reviewedAt?: string | null;
  };
}> {
  return adminApiFetch(`/admin/workers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ approved, adminNotes }),
  });
}

export interface ApiAdminStats {
  totalUsers: number;
  totalHires: number;
  pendingVerifications: number;
  activeWorkers?: number;
}

export function getAdminStats(): Promise<{ stats: ApiAdminStats }> {
  return adminApiFetch('/admin/stats');
}

export interface ApiAdminUser {
  id: string;
  name: string;
  phone: string;
  role: 'worker' | 'employer';
  avatar: string | null;
  isActive: boolean;
  /** Trust & Penalty red flag (record-only). */
  isFlagged: boolean;
  createdAt: string;
}

export function listAdminUsers(
  role: 'worker' | 'employer',
  search = '',
  page = 1,
): Promise<{
  users: ApiAdminUser[];
  pagination: { total: number; page: number; pages: number; limit: number };
}> {
  const query = new URLSearchParams({ role, page: String(page) });
  if (search.trim()) query.set('search', search.trim());
  return adminApiFetch(`/admin/users?${query.toString()}`);
}

export function setAdminUserActive(
  id: string,
  isActive: boolean,
): Promise<{ user: { id: string; isActive: boolean } }> {
  return adminApiFetch(`/admin/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

/** Trust & Penalty — admin flag / unflag for a user (record-only). */
export function setAdminUserFlagged(
  id: string,
  isFlagged: boolean,
): Promise<{ user: { id: string; isFlagged: boolean } }> {
  return adminApiFetch(`/admin/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ isFlagged }),
  });
}

/** Trust & Penalty — admin flag / unflag for a kaarigar profile (record-only). */
export function setAdminWorkerFlagged(
  id: string,
  isFlagged: boolean,
): Promise<{ worker: ApiAdminWorker }> {
  return adminApiFetch(`/admin/workers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ isFlagged }),
  });
}

// -----------------------------------------------------------------------------
// User reports (POST /reports) — admin review queue
// -----------------------------------------------------------------------------

export interface ApiAdminReport {
  id: string;
  reason: string;
  description: string | null;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: string;
  reporter: { id: string; name: string; phone: string | null } | null;
  reported: { id: string; name: string; phone: string | null } | null;
}

export type AdminReportStatus = ApiAdminReport['status'];

export function listAdminReports(status: 'all' | AdminReportStatus = 'all', page = 1): Promise<{
  reports: ApiAdminReport[];
  pagination: { total: number; page: number; pages: number; limit: number };
}> {
  const query = new URLSearchParams({ status, page: String(page) });
  return adminApiFetch(`/admin/reports?${query.toString()}`);
}

export function setAdminReportStatus(
  id: string,
  status: Exclude<AdminReportStatus, 'pending'>,
): Promise<{ report: { id: string; status: AdminReportStatus } }> {
  return adminApiFetch(`/admin/reports/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export type AdminHireStatus = HireStatus;

export interface ApiWorkerLifetimeStats {
  accepted: number;
  rejected: number;
  completed: number;
  cancelled: number;
  pending: number;
  total: number;
}

export interface ApiAdminHire {
  id: string;
  employerId: string;
  workerId: string;
  description: string;
  location: string;
  proposedRate: number;
  status: AdminHireStatus;
  scheduledDate?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  employer: { id: string; name: string; phone: string | null } | null;
  worker:
    | { id: string; name: string; phone: string | null; lifetimeStats?: ApiWorkerLifetimeStats }
    | null;
  /** Lifetime aggregate across ALL of this worker's hire requests — not the
   *  status of this row. The UI labels it "Worker lifetime stats". */
  workerLifetimeStats?: ApiWorkerLifetimeStats;
}

export function listAdminHires(status = 'all', page = 1): Promise<{
  hires: ApiAdminHire[];
  pagination: { total: number; page: number; pages: number; limit: number };
}> {
  const query = new URLSearchParams({ status, page: String(page) });
  return adminApiFetch(`/admin/hires?${query.toString()}`);
}
