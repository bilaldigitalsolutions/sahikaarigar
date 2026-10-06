'use client';

import { mapUser, mapWorkerProfile } from '@/lib/mappers';
import type { Skill, User, WorkerProfile } from '@/types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export interface AuthApiResult {
  user: User;
  workerProfile?: WorkerProfile;
}

export interface WorkerRegistrationProfile {
  skills: Skill[];
  experience: number;
  description?: string;
  hourlyRate: number;
  serviceAreas: string[];
  lat?: number;
  lng?: number;
}

interface AuthApiResponse {
  ok: boolean;
  code?: string;
  message?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workerProfile?: any;
}

/**
 * Calls the Supabase Edge Function `auth` (see supabase/functions/auth).
 *
 * The site is served statically from Firebase Hosting, so there is no Next.js
 * API route to talk to — this function is the server side of auth.
 */
async function callAuthApi(payload: Record<string, unknown>): Promise<AuthApiResponse> {
  if (!SUPABASE_URL) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not configured.');
  }

  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('Server se connect nahi ho paya. Internet check karo.');
  }

  const data = (await response.json().catch(() => null)) as AuthApiResponse | null;

  if (!response.ok || !data?.ok) {
    throw new Error(data?.message || 'Request fail ho gayi. Dobara try karo.');
  }

  return data;
}

/** Login (or silently create the base user row). */
export async function loginWithToken(token: string, name?: string): Promise<AuthApiResult> {
  const data = await callAuthApi({ action: 'login', token, name });
  if (!data.user) throw new Error('Server se user data nahi mila.');
  return { user: mapUser(data.user) };
}

/** Register as a worker: creates/updates the user + the worker profile. */
export async function registerWorker(
  token: string,
  name: string,
  profile: WorkerRegistrationProfile
): Promise<AuthApiResult> {
  const data = await callAuthApi({
    action: 'register-worker',
    token,
    name,
    profile,
  });

  if (!data.user) throw new Error('Server se user data nahi mila.');

  return {
    user: mapUser(data.user),
    workerProfile: data.workerProfile ? mapWorkerProfile(data.workerProfile) : undefined,
  };
}
