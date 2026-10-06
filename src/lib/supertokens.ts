'use client';

// =============================================================================
// SahiKaarigar — SuperTokens browser client (passwordless phone OTP)
// =============================================================================
// Runs on top of `auth-server/` (see its README). Nothing here talks to the
// SuperTokens Core directly — the SDK only calls our own server.
//
// env: NEXT_PUBLIC_AUTH_API_URL  e.g. http://localhost:4000 | https://auth.example.com
// =============================================================================

import SuperTokens from 'supertokens-web-js';
import Session from 'supertokens-web-js/recipe/session';
import Passwordless from 'supertokens-web-js/recipe/passwordless';

const AUTH_API_URL = (process.env.NEXT_PUBLIC_AUTH_API_URL ?? '').replace(/\/+$/, '');
const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? 'SahiKaarigar';

let initialised = false;

/** Idempotent — safe to call from every entry point. */
export function initSuperTokens(): void {
  if (initialised) return;
  if (!AUTH_API_URL) {
    throw new Error(
      'Auth server configure nahi hai (NEXT_PUBLIC_AUTH_API_URL). See SUPERTOKENS_SETUP.md.',
    );
  }

  SuperTokens.init({
    appInfo: { appName: APP_NAME, apiDomain: AUTH_API_URL, apiBasePath: '/auth' },
    recipeList: [
      // ---------------------------------------------------------------------
      // HEADER mode, not cookies.
      // ---------------------------------------------------------------------
      // The static site (…web.app) and the auth-server (…onrender.com) are
      // DIFFERENT sites, so a session cookie would be a *third-party* cookie
      // and Chrome/Safari block those. In header mode the SDK keeps the tokens
      // (localStorage) and sends `Authorization: Bearer …` — which also works
      // on localhost, so dev and production behave identically.
      Session.init({ tokenTransferMethod: 'header' }),
      Passwordless.init(),
    ],
  });

  initialised = true;
}

// ---------------------------------------------------------------------------
// OTP flow
// ---------------------------------------------------------------------------

/** Step 1 — ask the server to generate + SMS an OTP.
 *  The SDK remembers the device/pre-auth ids internally. */
export async function requestOtp(phone: string): Promise<void> {
  initSuperTokens();

  const response = await Passwordless.createCode({ phoneNumber: `+91${phone}` });

  if (response.status === 'OK') {
    return;
  }
  if (response.status === 'SIGN_IN_UP_NOT_ALLOWED') {
    throw new Error(response.reason || 'Is number se sign-in allowed nahi hai.');
  }
  throw new Error('OTP bhejne me dikkat aayi. Dobara try karo.');
}

/** Step 2 — verify the OTP. On success SuperTokens has created the session. */
export async function verifyOtp(code: string): Promise<void> {
  initSuperTokens();

  const response = await Passwordless.consumeCode({ userInputCode: code });

  if (response.status === 'OK') return;

  if (response.status === 'INCORRECT_USER_INPUT_CODE_ERROR') {
    throw new Error('OTP galat hai. SMS me aaya 6-digit code dobara check karo.');
  }
  if (response.status === 'EXPIRED_USER_INPUT_CODE_ERROR') {
    throw new Error('OTP expire ho gaya. "Naya OTP bhejo" dabao.');
  }
  throw new Error('OTP verify nahi hua. Dobara try karo.');
}

/** Re-send the OTP for the pending login attempt (no reCAPTCHA needed). */
export async function resendOtp(): Promise<void> {
  initSuperTokens();
  const response = await Passwordless.resendCode();
  if (response.status !== 'OK') {
    throw new Error('Naya OTP nahi bhej paye. Thodi der baad try karo.');
  }
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export async function hasSession(): Promise<boolean> {
  initSuperTokens();
  try {
    return await Session.doesSessionExist();
  } catch {
    return false;
  }
}

export async function getSessionUserId(): Promise<string | undefined> {
  initSuperTokens();
  if (!(await Session.doesSessionExist())) return undefined;
  return Session.getUserId();
}

export async function logoutSuperTokens(): Promise<void> {
  initSuperTokens();
  await Session.signOut();
}

// ---------------------------------------------------------------------------
// Our own server (session cookie is sent automatically)
// ---------------------------------------------------------------------------

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

export function fetchMe<T>(): Promise<T> {
  return apiFetch<T>('/me');
}

export function registerWorkerViaSuperTokens<T>(payload: {
  name: string;
  profile: Record<string, unknown>;
}): Promise<T> {
  return apiFetch<T>('/register-worker', { method: 'POST', body: JSON.stringify(payload) });
}

/** Update the signed-in user's own profile (replaces loginWithToken(token, name)). */
export function updateProfile<T>(payload: {
  name?: string;
  address?: string;
  locationArea?: string;
  locationCity?: string;
}): Promise<T> {
  return apiFetch<T>('/profile', { method: 'POST', body: JSON.stringify(payload) });
}
