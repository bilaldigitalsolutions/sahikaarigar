// =============================================================================
// Mappls (MapmyIndia) REST integration — area / location autosuggest + geocode
// =============================================================================
// Docs: https://developer.mappls.com  •  Console: https://auth.mappls.com/console
//
// Auth (pick ONE):
//   a) EXPO_PUBLIC_MAPPLS_ACCESS_TOKEN  — a static token copied from the console
//      ("Credentials" section). Simplest; no extra network call.
//   b) EXPO_PUBLIC_MAPPLS_CLIENT_ID + EXPO_PUBLIC_MAPPLS_CLIENT_SECRET — the app
//      fetches a short-lived token itself via the OAuth endpoint and caches it.
//
// Autosuggest endpoints (both are supported):
//   • Atlas/current: GET https://atlas.mappls.com/api/places/search/json
//     Auth: Authorization: Bearer <token>
//     Response: suggestedLocations + userAddedLocation (singular)
//   • Legacy: GET https://search.mappls.com/search/places/autosuggest/json
//     Auth: access_token query parameter
//     Response: suggestedLocations + userAddedLocations (plural)
//
// We try Atlas first and fall back to the legacy endpoint, so the app works
// with either console entitlement.
//
// Everything here is best-effort: failures return []/{} and LocationPicker
// falls back to Photon, then to the built-in Hyderabad area list.
// =============================================================================

import { MAPPLS_ACCESS_TOKEN, MAPPLS_CLIENT_ID, MAPPLS_CLIENT_SECRET } from '@/lib/config';

const TOKEN_URL = 'https://outpost.mappls.com/api/security/oauth/token';
const GEOCODE_URL = 'https://search.mappls.com/search/address/geocode';
const TOKEN_TIMEOUT_MS = 8_000;
const LOG_PREFIX = '[Mappls]';
// Dev builds always log. For an internal/release APK, set
// EXPO_PUBLIC_MAPPLS_DEBUG=1 at build time (never enable it for public builds:
// responses contain the user's location query).
const DEBUG =
  (typeof __DEV__ !== 'undefined' && __DEV__) ||
  process.env.EXPO_PUBLIC_MAPPLS_DEBUG === '1';

interface AutosuggestEndpoint {
  label: 'atlas' | 'legacy';
  url: string;
  auth: 'bearer' | 'query';
}

const AUTOSUGGEST_ENDPOINTS: AutosuggestEndpoint[] = [
  {
    label: 'atlas',
    url: 'https://atlas.mappls.com/api/places/search/json',
    auth: 'bearer',
  },
  {
    label: 'legacy',
    url: 'https://search.mappls.com/search/places/autosuggest/json',
    auth: 'query',
  },
];

/** True when the app has enough credentials to talk to Mappls. */
export const mapplsEnabled =
  MAPPLS_ACCESS_TOKEN.length > 0 ||
  (MAPPLS_CLIENT_ID.length > 0 && MAPPLS_CLIENT_SECRET.length > 0);

export interface MapplsPlace {
  /** Human readable label, e.g. "Gachibowli, Hyderabad, Telangana". */
  description: string;
  /** Mappls unique location id (6-char code). */
  eLoc?: string;
  lat?: number;
  lng?: number;
}

interface MapplsSuggestion {
  placeName?: string;
  placeAddress?: string;
  eLoc?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
}

interface AutosuggestResponse {
  suggestedLocations?: MapplsSuggestion[];
  /** Atlas/current response shape. */
  userAddedLocation?: MapplsSuggestion[];
  /** Legacy response shape. */
  userAddedLocations?: MapplsSuggestion[];
}

interface GeocodeResponse {
  results?: {
    latitude?: number | string | null;
    longitude?: number | string | null;
    lat?: number | string | null;
    lng?: number | string | null;
  }[];
}

interface TokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number | string;
  error?: string;
  error_description?: string;
}

type AutosuggestAttempt =
  | { kind: 'response'; res: Response }
  | { kind: 'aborted' }
  | { kind: 'network-error'; message: string };

let cachedToken: { value: string; expiresAt: number } | null = null;

function debugLog(message: string, data?: unknown): void {
  if (!DEBUG) return;
  if (data === undefined) console.log(`${LOG_PREFIX} ${message}`);
  else console.log(`${LOG_PREFIX} ${message}`, data);
}

function warnLog(message: string, data?: unknown): void {
  if (!DEBUG) return;
  if (data === undefined) console.warn(`${LOG_PREFIX} ${message}`);
  else console.warn(`${LOG_PREFIX} ${message}`, data);
}

function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || /abort|timed?\s*out/i.test(error.message))
  );
}

/** Never print a static/OAuth token that was placed in a URL query string. */
function redactUrl(url: string): string {
  return url.replace(/([?&](?:access_token|token)=)[^&]*/gi, '$1***redacted***');
}

function redactedHeaders(headers: Record<string, string>): Record<string, string> {
  const copy = { ...headers };
  if (copy.Authorization) copy.Authorization = 'Bearer ***redacted***';
  return copy;
}

function toFiniteNumber(value: number | string | null | undefined): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (!trimmed || trimmed.toUpperCase() === 'RESTRICTED') return undefined;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function readErrorBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return '';
  }
}

/**
 * Resolve a usable Mappls `access_token`. Uses the static token when provided,
 * otherwise exchanges the client id + secret (result cached until it expires).
 */
export async function getMapplsToken(
  forceRefresh = false,
  signal?: AbortSignal,
): Promise<string | null> {
  if (signal?.aborted) {
    debugLog('auth: token request skipped because the caller aborted');
    return null;
  }

  if (MAPPLS_ACCESS_TOKEN) {
    debugLog('auth: using static EXPO_PUBLIC_MAPPLS_ACCESS_TOKEN');
    return MAPPLS_ACCESS_TOKEN;
  }

  if (!MAPPLS_CLIENT_ID || !MAPPLS_CLIENT_SECRET) {
    debugLog('auth: disabled — no static token and no client id/secret');
    return null;
  }

  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    debugLog('auth: using cached OAuth token', {
      expiresInSec: Math.max(0, Math.round((cachedToken.expiresAt - Date.now()) / 1000)),
    });
    return cachedToken.value;
  }

  const startedAt = Date.now();
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: MAPPLS_CLIENT_ID,
    client_secret: MAPPLS_CLIENT_SECRET,
  }).toString();

  debugLog('auth: OAuth token request', {
    url: TOKEN_URL,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: {
      grant_type: 'client_credentials',
      client_id: MAPPLS_CLIENT_ID,
      client_secret: '***redacted***',
    },
  });

  const controller = new AbortController();
  if (signal?.aborted) controller.abort();
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener('abort', abortFromCaller);
  const timeoutId = setTimeout(() => controller.abort(), TOKEN_TIMEOUT_MS);

  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
      signal: controller.signal,
    });

    const raw = await res.text();
    let data: TokenResponse = {};
    try {
      data = raw ? (JSON.parse(raw) as TokenResponse) : {};
    } catch {
      // Do not print the raw body here — a malformed success response may
      // contain a token. Only log that parsing failed.
      warnLog('auth: token response was not JSON', {
        status: res.status,
        bodyLength: raw.length,
      });
    }

    debugLog('auth: OAuth token response', {
      status: res.status,
      ok: res.ok,
      durationMs: Date.now() - startedAt,
      tokenType: data.token_type,
      expiresIn: data.expires_in,
      error: data.error,
      errorDescription: data.error_description,
    });

    if (!res.ok) {
      warnLog('auth: OAuth token request rejected', {
        status: res.status,
        error: data.error,
        errorDescription: data.error_description,
      });
      return null;
    }

    if (!data.access_token) {
      warnLog('auth: OAuth token response is missing access_token');
      return null;
    }

    const expiresIn = Number(data.expires_in);
    const ttl = Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 86_400;
    cachedToken = {
      value: data.access_token,
      expiresAt: Date.now() + ttl * 1000,
    };

    debugLog('auth: OAuth token acquired', {
      tokenLength: data.access_token.length,
      expiresInSec: ttl,
    });
    return data.access_token;
  } catch (error) {
    if (signal?.aborted || isAbortError(error)) {
      debugLog('auth: OAuth token request aborted/timed out');
    } else {
      warnLog('auth: OAuth token request failed', { error: describeError(error) });
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}

function buildAutosuggestUrl(
  endpoint: AutosuggestEndpoint,
  query: string,
  bias: { lat?: number; lng?: number } | undefined,
  token: string,
): string {
  const params = new URLSearchParams({ query, region: 'IND' });
  if (bias?.lat != null && bias?.lng != null) {
    params.set('location', `${bias.lat},${bias.lng}`);
  }
  if (endpoint.auth === 'query') {
    params.set('access_token', token);
  }
  return `${endpoint.url}?${params.toString()}`;
}

function buildAutosuggestHeaders(
  endpoint: AutosuggestEndpoint,
  token: string,
): Record<string, string> {
  return {
    Accept: 'application/json',
    ...(endpoint.auth === 'bearer' ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function requestAutosuggest(
  endpoint: AutosuggestEndpoint,
  query: string,
  bias: { lat?: number; lng?: number } | undefined,
  token: string,
  signal?: AbortSignal,
): Promise<AutosuggestAttempt> {
  const url = buildAutosuggestUrl(endpoint, query, bias, token);
  const headers = buildAutosuggestHeaders(endpoint, token);
  const startedAt = Date.now();

  debugLog('autosuggest request', {
    endpoint: endpoint.label,
    url: redactUrl(url),
    headers: redactedHeaders(headers),
  });

  try {
    const res = await fetch(url, { headers, signal });
    debugLog('autosuggest response', {
      endpoint: endpoint.label,
      status: res.status,
      ok: res.ok,
      durationMs: Date.now() - startedAt,
      contentType: res.headers.get('content-type'),
    });
    return { kind: 'response', res };
  } catch (error) {
    if (signal?.aborted || isAbortError(error)) {
      debugLog('autosuggest aborted/timed out', { endpoint: endpoint.label });
      return { kind: 'aborted' };
    }

    const message = describeError(error);
    warnLog('autosuggest network error', { endpoint: endpoint.label, error: message });
    return { kind: 'network-error', message };
  }
}

function parseAutosuggestResponse(data: AutosuggestResponse): MapplsPlace[] {
  const items = [
    ...(data.suggestedLocations ?? []),
    ...(data.userAddedLocation ?? []),
    ...(data.userAddedLocations ?? []),
  ];

  const seen = new Set<string>();
  const out: MapplsPlace[] = [];

  for (const item of items) {
    const description = [item.placeName, item.placeAddress]
      .map((part) => (part ?? '').trim())
      .filter(Boolean)
      .join(', ');

    if (!description || seen.has(description)) continue;
    seen.add(description);

    const lat = toFiniteNumber(item.latitude);
    const lng = toFiniteNumber(item.longitude);
    const eLoc = item.eLoc && item.eLoc !== 'null' ? item.eLoc : undefined;

    out.push({
      description,
      ...(eLoc ? { eLoc } : {}),
      ...(lat != null && lng != null ? { lat, lng } : {}),
    });

    if (out.length >= 8) break;
  }

  return out;
}

/** Fetch area / locality suggestions for a partially typed query. */
export async function mapplsAutosuggest(
  query: string,
  bias?: { lat?: number; lng?: number },
  signal?: AbortSignal,
): Promise<MapplsPlace[]> {
  const q = query.trim();
  if (!q) return [];

  let token = await getMapplsToken(false, signal);
  if (!token) {
    debugLog('autosuggest skipped: no Mappls token', { query: q });
    return [];
  }

  let refreshedAfter401 = false;

  for (const endpoint of AUTOSUGGEST_ENDPOINTS) {
    if (signal?.aborted) {
      debugLog('autosuggest aborted before trying the next endpoint');
      return [];
    }

    let attempt = await requestAutosuggest(endpoint, q, bias, token, signal);

    if (attempt.kind === 'aborted') return [];
    if (attempt.kind === 'network-error') continue;

    let res = attempt.res;

    // OAuth tokens can expire between requests. Refresh once and retry the
    // same endpoint; a static token cannot be refreshed.
    if (res.status === 401 && !refreshedAfter401 && !MAPPLS_ACCESS_TOKEN) {
      refreshedAfter401 = true;
      debugLog('autosuggest 401: refreshing OAuth token and retrying once', {
        endpoint: endpoint.label,
      });

      cachedToken = null;
      const refreshedToken = await getMapplsToken(true, signal);
      if (refreshedToken) {
        token = refreshedToken;
        attempt = await requestAutosuggest(endpoint, q, bias, token, signal);

        if (attempt.kind === 'aborted') return [];
        if (attempt.kind === 'network-error') continue;
        res = attempt.res;
      }
    }

    if (res.status === 204) {
      debugLog('autosuggest 204: no suggestions', { endpoint: endpoint.label });
      return [];
    }

    if (res.status === 429) {
      debugLog('autosuggest 429: rate limited — falling back', {
        endpoint: endpoint.label,
        retryAfter: res.headers.get('retry-after'),
      });
      return [];
    }

    if (!res.ok) {
      const body = await readErrorBody(res);
      warnLog('autosuggest request failed — trying next endpoint', {
        endpoint: endpoint.label,
        status: res.status,
        body,
      });
      continue;
    }

    let data: AutosuggestResponse;
    try {
      data = (await res.json()) as AutosuggestResponse;
    } catch (error) {
      warnLog('autosuggest response was not valid JSON — trying next endpoint', {
        endpoint: endpoint.label,
        error: describeError(error),
      });
      continue;
    }

    debugLog('autosuggest raw response', data);

    const parsed = parseAutosuggestResponse(data);
    debugLog('autosuggest parsed', {
      count: parsed.length,
      results: parsed,
    });
    return parsed;
  }

  warnLog('autosuggest failed on all endpoints — falling back to Photon/local');
  return [];
}

/**
 * Best-effort forward geocode — turns an address string into coordinates.
 * Atlas may return numeric latitude/longitude, but many accounts get
 * "RESTRICTED"; in either case this is the fallback when coordinates are
 * missing from the selected autosuggest row.
 */
export async function mapplsGeocode(
  address: string,
  signal?: AbortSignal,
): Promise<{ lat?: number; lng?: number }> {
  const value = address.trim();
  if (!value) return {};

  const token = await getMapplsToken(false, signal);
  if (!token) {
    debugLog('geocode skipped: no Mappls token');
    return {};
  }

  const url = `${GEOCODE_URL}?address=${encodeURIComponent(value)}&access_token=${encodeURIComponent(token)}`;
  const startedAt = Date.now();

  debugLog('geocode request', {
    url: redactUrl(url),
    headers: { Accept: 'application/json' },
  });

  try {
    const res = await fetch(url, { signal });

    debugLog('geocode response', {
      status: res.status,
      ok: res.ok,
      durationMs: Date.now() - startedAt,
      contentType: res.headers.get('content-type'),
    });

    if (res.status === 204) {
      debugLog('geocode 204: no results');
      return {};
    }

    if (res.status === 429) {
      debugLog('geocode 429: rate limited');
      return {};
    }

    if (!res.ok) {
      warnLog('geocode request failed', {
        status: res.status,
        body: await readErrorBody(res),
      });
      return {};
    }

    const data = (await res.json()) as GeocodeResponse;
    debugLog('geocode raw response', data);

    const first = data.results?.[0];
    if (!first) {
      debugLog('geocode parsed: no result');
      return {};
    }

    const lat = toFiniteNumber(first.latitude ?? first.lat);
    const lng = toFiniteNumber(first.longitude ?? first.lng);
    if (lat == null || lng == null) {
      debugLog('geocode parsed: coordinates unavailable', {
        latitude: first.latitude,
        longitude: first.longitude,
      });
      return {};
    }

    debugLog('geocode parsed', { lat, lng });
    return { lat, lng };
  } catch (error) {
    if (signal?.aborted || isAbortError(error)) {
      debugLog('geocode aborted/timed out');
    } else {
      warnLog('geocode request failed', { error: describeError(error) });
    }
    return {};
  }
}

if (DEBUG) {
  console.log(`${LOG_PREFIX} config`, {
    enabled: mapplsEnabled,
    authMode: MAPPLS_ACCESS_TOKEN
      ? 'static-token'
      : MAPPLS_CLIENT_ID && MAPPLS_CLIENT_SECRET
        ? 'oauth-client-credentials'
        : 'none',
    endpoints: AUTOSUGGEST_ENDPOINTS.map((endpoint) => endpoint.url),
  });

  if (!mapplsEnabled) {
    console.log(
      `${LOG_PREFIX} REST autosuggest is DISABLED. Set EXPO_PUBLIC_MAPPLS_ACCESS_TOKEN ` +
        'or EXPO_PUBLIC_MAPPLS_CLIENT_ID + EXPO_PUBLIC_MAPPLS_CLIENT_SECRET in .env ' +
        '(and in the CI build env). LocationPicker will use Photon/local Hyderabad areas.',
    );
  }
}
