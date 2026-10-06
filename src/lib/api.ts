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
