// =============================================================================
// SuperTokens auth (passwordless phone OTP) — React Native
// =============================================================================
// `supertokens-react-native` only manages SESSIONS (token storage, refresh and
// a patched global `fetch` that adds `Authorization: Bearer …`). The OTP flow
// itself is done by calling the auth-server's SuperTokens REST endpoints
// directly:
//
//   POST /auth/signinup/code          create + SMS an OTP
//   POST /auth/signinup/code/consume  verify the OTP, create the session
//   POST /auth/signinup/code/resend   resend the OTP
//
// The RN SDK's fetch interceptor captures the session tokens returned by
// `/code/consume`, so every later request through the API client is authorised.
// =============================================================================

import SuperTokens from 'supertokens-react-native';

import { AUTH_API_URL, requireAuthApiUrl } from './config';

let initialised = false;

/** Idempotent — safe to call from every entry point. */
export function initAuth(): void {
  if (initialised) return;
  requireAuthApiUrl();

  SuperTokens.init({
    apiDomain: AUTH_API_URL,
    apiBasePath: '/auth',
    // Header tokens work everywhere (no third-party cookies on mobile).
    tokenTransferMethod: 'header',
    enableDebugLogs: __DEV__,
  });

  // Fire-and-forget warm-up so a sleeping host (e.g. Render's free tier) is
  // awake by the time the user asks for an OTP.
  fetch(`${AUTH_API_URL}/health`).catch(() => {});

  initialised = true;
}

export interface OtpChallenge {
  preAuthSessionId: string;
  deviceId: string;
  /** Only present when the server runs with SMS_PROVIDER=console (dev). */
  userInputCode?: string;
}

interface SupertokensResponse {
  status?: string;
  message?: string;
  preAuthSessionId?: string;
  deviceId?: string;
  userInputCode?: string;
}

async function postAuth(path: string, body: Record<string, unknown>): Promise<SupertokensResponse> {
  const base = requireAuthApiUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Auth server slow hai. Thodi der baad try karo.');
    }
    throw new Error('Could not reach the auth server. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
  }
  const data = (await response.json().catch(() => null)) as SupertokensResponse | null;
  if (!data) throw new Error('Unexpected response from the server. Please try again.');
  return data;
}

/** Step 1 — ask the server to create + SMS an OTP for a 10-digit number. */
export async function requestOtp(phone: string): Promise<OtpChallenge> {
  initAuth();
  const data = await postAuth('/auth/signinup/code', { phoneNumber: `+91${phone}` });

  if (data.status !== 'OK' || !data.preAuthSessionId || !data.deviceId) {
    throw new Error(data.message || 'Could not send the OTP. Please try again.');
  }

  return {
    preAuthSessionId: data.preAuthSessionId,
    deviceId: data.deviceId,
    userInputCode: data.userInputCode,
  };
}

/** Step 2 — verify the OTP. On success SuperTokens has created the session. */
export async function verifyOtp(input: {
  preAuthSessionId: string;
  deviceId: string;
  code: string;
}): Promise<void> {
  initAuth();
  const data = await postAuth('/auth/signinup/code/consume', {
    preAuthSessionId: input.preAuthSessionId,
    deviceId: input.deviceId,
    userInputCode: input.code,
  });

  if (data.status === 'OK') return;
  if (data.status === 'INCORRECT_USER_INPUT_CODE_ERROR') {
    throw new Error('Incorrect OTP. Check the 6-digit code from the SMS and try again.');
  }
  if (data.status === 'EXPIRED_USER_INPUT_CODE_ERROR') {
    throw new Error('The OTP expired. Tap "Resend OTP".');
  }
  throw new Error(data.message || 'OTP verification failed. Please try again.');
}

/** Re-send the OTP for the pending login attempt. */
export async function resendOtp(input: {
  preAuthSessionId: string;
  deviceId: string;
}): Promise<void> {
  initAuth();
  const data = await postAuth('/auth/signinup/code/resend', {
    preAuthSessionId: input.preAuthSessionId,
    deviceId: input.deviceId,
  });
  if (data.status !== 'OK') {
    throw new Error(data.message || 'Could not resend the OTP. Please try again in a moment.');
  }
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

export async function hasSession(): Promise<boolean> {
  try {
    initAuth();
    return await SuperTokens.doesSessionExist();
  } catch {
    return false;
  }
}

export async function getSessionUserId(): Promise<string | undefined> {
  initAuth();
  if (!(await SuperTokens.doesSessionExist())) return undefined;
  return SuperTokens.getUserId();
}

export async function logout(): Promise<void> {
  initAuth();
  await SuperTokens.signOut();
}

/**
 * Quick `/health` probe. Used to decide whether the app should fall back to the
 * bundled demo data (e.g. a browser blocked by CORS, or a sleeping host).
 */
export async function isAuthServerReachable(timeoutMs = 6000): Promise<boolean> {
  try {
    const base = requireAuthApiUrl();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${base}/health`, { signal: controller.signal });
      return res.ok;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return false;
  }
}

