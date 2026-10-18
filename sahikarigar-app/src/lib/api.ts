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

const ADMIN_SESSION_KEY = 'admin_token';

export interface AdminSession {
  email: string;
  role: 'admin';
}

/**
 * Normalise a token read from localStorage. Guards against the literal strings
 * `undefined` / `null` ever being written and against accidental whitespace —
 * either would make the server reject the `Authorization` header with a 401.
 */
function normalizeAdminToken(value: string | null): string | null {
  const token = value?.trim();
  if (!token || token === 'undefined' || token === 'null') return null;
  return token;
}

function getStoredAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return normalizeAdminToken(window.localStorage.getItem(ADMIN_SESSION_KEY));
  } catch {
    return null;
  }
}

export function clearAdminSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ADMIN_SESSION_KEY);
  } catch {
    /* storage unavailable (private mode) — nothing to clear */
  }
}

export function getAdminToken(): string | null {
  return getStoredAdminToken();
}

async function adminApiFetch<T>(
  path: string,
  init?: RequestInit,
  token = getStoredAdminToken(),
): Promise<T> {
  if (!AUTH_API_URL) {
    throw new Error('Auth server configure nahi hai (NEXT_PUBLIC_AUTH_API_URL).');
  }
  // Only send the header when we actually have a token — never
  // `Authorization: Bearer undefined`.
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${AUTH_API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });
  const data = (await response.json().catch(() => null)) as
    | { ok?: boolean; message?: string; token?: string; admin?: AdminSession }
    | null;

  // Network failures never reach this point (fetch rejects) and a 5xx is a
  // server problem — in both cases the stored token is kept. Only a genuine
  // 401 means the session is invalid/expired, so only then do we log out.
  if (response.status === 401 && token) {
    clearAdminSession();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('sahikarigar-admin-unauthorized'));
    }
  }

  if (!response.ok || !data?.ok) {
    throw new Error(data?.message || 'Admin request fail ho gayi. Dobara try karo.');
  }
  return data as T;
}

export async function adminLogin(payload: {
  email: string;
  password: string;
}): Promise<{ admin: AdminSession }> {
  const data = await adminApiFetch<{ token: string; admin: AdminSession }>(
    '/admin/login',
    { method: 'POST', body: JSON.stringify(payload) },
    null,
  );
  window.localStorage.setItem(ADMIN_SESSION_KEY, data.token);
  return { admin: data.admin };
}

export function getAdminSession(): Promise<{ admin: AdminSession }> {
  return adminApiFetch('/admin/session');
}

export function adminLogout(): void {
  clearAdminSession();
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

export type AdminHireStatus = HireStatus;

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
  worker: { id: string; name: string; phone: string | null } | null;
}

export function listAdminHires(status = 'all', page = 1): Promise<{
  hires: ApiAdminHire[];
  pagination: { total: number; page: number; pages: number; limit: number };
}> {
  const query = new URLSearchParams({ status, page: String(page) });
  return adminApiFetch(`/admin/hires?${query.toString()}`);
}

export function setAdminHireStatus(
  id: string,
  status: AdminHireStatus,
): Promise<{ hire: { id: string; status: AdminHireStatus; updatedAt: string } }> {
  return adminApiFetch(`/admin/hires/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
