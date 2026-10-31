// =============================================================================
// Ola Maps REST integration — area / location autosuggest + forward geocode
// =============================================================================
// Docs:
//   Autocomplete: https://maps.olakrutrim.com/docs/places-apis/autocomplete-api
//   Geocode:      https://maps.olakrutrim.com/docs/geocoding/geocoding-api
//
// Auth:
//   EXPO_PUBLIC_OLA_MAPS_API_KEY — build-time API key from Krutrim Cloud.
//   Ola Maps expects it as the `api_key` query parameter.
//
// Endpoints:
//   GET https://api.olamaps.io/places/v1/autocomplete
//       ?input=<query>&api_key=...&language=en[&location=lat,lng]
//   GET https://api.olamaps.io/places/v1/geocode
//       ?address=<address>&api_key=...&language=en
//
// Both functions are best-effort: failures return []/{} so LocationPicker can
// fall back to Google Places, Photon, then the built-in Hyderabad area list.
// =============================================================================

import { OLA_MAPS_API_KEY } from '@/lib/config';

const AUTOCOMPLETE_URL = 'https://api.olamaps.io/places/v1/autocomplete';
const GEOCODE_URL = 'https://api.olamaps.io/places/v1/geocode';
const LOG_PREFIX = '[OlaMaps]';
const DEBUG =
  (typeof __DEV__ !== 'undefined' && __DEV__) ||
  process.env.EXPO_PUBLIC_OLA_MAPS_DEBUG === '1';

type Numeric = number | string | null | undefined;

interface OlaLatLng {
  lat?: Numeric;
  lng?: Numeric;
  latitude?: Numeric;
  longitude?: Numeric;
}

export interface OlaMapsPlace {
  /** Human readable label, e.g. "Gachibowli, Hyderabad, Telangana, 500032, India". */
  description: string;
  /** Ola Maps place id, e.g. "ola-platform:6000085760878". */
  placeId?: string;
  lat?: number;
  lng?: number;
}

interface OlaPrediction {
  description?: string;
  place_id?: string;
  reference?: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
  geometry?: { location?: OlaLatLng };
  latitude?: Numeric;
  longitude?: Numeric;
  lat?: Numeric;
  lng?: Numeric;
}

interface OlaAutocompleteResponse {
  predictions?: OlaPrediction[];
  status?: string;
  error_message?: string;
}

interface OlaGeocodeResult {
  formatted_address?: string;
  geometry?: { location?: OlaLatLng };
  latitude?: Numeric;
  longitude?: Numeric;
  lat?: Numeric;
  lng?: Numeric;
}

interface OlaGeocodeResponse {
  /** Current Ola Maps response field. */
  geocodingResults?: OlaGeocodeResult[];
  /** Kept for compatibility with older/alternate response shapes. */
  results?: OlaGeocodeResult[];
  status?: string;
  error_message?: string;
}

/** True when an Ola Maps API key is configured. */
export const olaMapsEnabled = OLA_MAPS_API_KEY.length > 0;

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

/** Never print the API key that is embedded in the request query string. */
function redactUrl(url: string): string {
  return url.replace(/([?&](?:api_key|key)=)[^&]*/gi, '$1***redacted***');
}

function requestHeaders(): Record<string, string> {
  // Keep this to a simple CORS-safelisted header so Ola Maps also works on web.
  return { Accept: 'application/json' };
}

function toFiniteNumber(value: Numeric): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readCoordinates(value: OlaLatLng | undefined): {
  lat?: number;
  lng?: number;
} {
  const lat = toFiniteNumber(value?.lat ?? value?.latitude);
  const lng = toFiniteNumber(value?.lng ?? value?.longitude);
  return lat != null && lng != null ? { lat, lng } : {};
}

async function readErrorBody(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return '';
  }
}

function parseAutosuggestResponse(data: OlaAutocompleteResponse): OlaMapsPlace[] {
  const seen = new Set<string>();
  const out: OlaMapsPlace[] = [];

  for (const item of data.predictions ?? []) {
    const description =
      item.description?.trim() ||
      [item.structured_formatting?.main_text, item.structured_formatting?.secondary_text]
        .filter((part): part is string => Boolean(part?.trim()))
        .join(', ');

    if (!description || seen.has(description)) continue;
    seen.add(description);

    const placeId = item.place_id || item.reference || undefined;
    const location = readCoordinates({
      ...item.geometry?.location,
      latitude: item.geometry?.location?.latitude ?? item.latitude,
      longitude: item.geometry?.location?.longitude ?? item.longitude,
      lat: item.geometry?.location?.lat ?? item.lat,
      lng: item.geometry?.location?.lng ?? item.lng,
    });

    out.push({
      description,
      ...(placeId ? { placeId } : {}),
      ...location,
    });

    if (out.length >= 8) break;
  }

  return out;
}

/** Fetch area / locality suggestions for a partially typed query. */
export async function olaMapsAutosuggest(
  query: string,
  bias?: { lat?: number; lng?: number },
  signal?: AbortSignal,
): Promise<OlaMapsPlace[]> {
  const q = query.trim();
  if (!q) return [];

  const keyPresent = OLA_MAPS_API_KEY.length > 0;

  debugLog('autosuggest start', {
    query: q,
    olaMapsEnabled,
    keyPresent,
    keyLength: OLA_MAPS_API_KEY.length,
  });

  if (!olaMapsEnabled) {
    debugLog('autosuggest skipped: no Ola Maps API key');
    return [];
  }

  const params = new URLSearchParams({
    input: q,
    api_key: OLA_MAPS_API_KEY,
    language: 'en',
  });

  if (bias?.lat != null && bias?.lng != null) {
    params.set('location', `${bias.lat},${bias.lng}`);
  }

  const url = `${AUTOCOMPLETE_URL}?${params.toString()}`;
  const headers = requestHeaders();
  const startedAt = Date.now();

  debugLog('autosuggest request', {
    url: redactUrl(url),
    headers,
    keyPresent,
    keyLength: OLA_MAPS_API_KEY.length,
  });

  try {
    const res = await fetch(url, { headers, signal });

    debugLog('autosuggest response', {
      status: res.status,
      statusText: res.statusText,
      ok: res.ok,
      durationMs: Date.now() - startedAt,
      contentType: res.headers.get('content-type'),
    });

    if (res.status === 204) return [];

    if (res.status === 429) {
      warnLog('autosuggest 429: rate limited', {
        retryAfter: res.headers.get('retry-after'),
      });
      return [];
    }

    if (!res.ok) {
      warnLog('autosuggest request failed', {
        status: res.status,
        body: await readErrorBody(res),
      });
      return [];
    }

    const data = (await res.json()) as OlaAutocompleteResponse;
    debugLog('autosuggest raw response', data);

    if (data.error_message) {
      warnLog('autosuggest API error', {
        status: data.status,
        errorMessage: data.error_message,
      });
      return [];
    }

    const parsed = parseAutosuggestResponse(data);
    debugLog('autosuggest parsed', {
      status: data.status,
      predictionsCount: data.predictions?.length ?? 0,
      count: parsed.length,
      results: parsed,
    });
    return parsed;
  } catch (error) {
    if (signal?.aborted || isAbortError(error)) {
      debugLog('autosuggest aborted/timed out');
    } else {
      warnLog('autosuggest network error', { error: describeError(error) });
    }
    return [];
  }
}

/**
 * Best-effort forward geocode — turns an address string into coordinates.
 * Autocomplete rows normally include `geometry.location`, so this is only used
 * when a selected row (or the free-text "Use ..." row) has no coordinates.
 */
export async function olaMapsGeocode(
  address: string,
  signal?: AbortSignal,
): Promise<{ lat?: number; lng?: number }> {
  const value = address.trim();
  if (!value) return {};

  if (!olaMapsEnabled) {
    debugLog('geocode skipped: no Ola Maps API key');
    return {};
  }

  const params = new URLSearchParams({
    address: value,
    api_key: OLA_MAPS_API_KEY,
    language: 'en',
  });
  const url = `${GEOCODE_URL}?${params.toString()}`;
  const headers = requestHeaders();
  const startedAt = Date.now();

  debugLog('geocode request', {
    url: redactUrl(url),
    headers,
  });

  try {
    const res = await fetch(url, { headers, signal });

    debugLog('geocode response', {
      status: res.status,
      ok: res.ok,
      durationMs: Date.now() - startedAt,
      contentType: res.headers.get('content-type'),
    });

    if (res.status === 204) return {};

    if (res.status === 429) {
      warnLog('geocode 429: rate limited', {
        retryAfter: res.headers.get('retry-after'),
      });
      return {};
    }

    if (!res.ok) {
      warnLog('geocode request failed', {
        status: res.status,
        body: await readErrorBody(res),
      });
      return {};
    }

    const data = (await res.json()) as OlaGeocodeResponse;
    debugLog('geocode raw response', data);

    if (data.error_message) {
      warnLog('geocode API error', {
        status: data.status,
        errorMessage: data.error_message,
      });
      return {};
    }

    const results = data.geocodingResults ?? data.results ?? [];
    for (const result of results) {
      const location = readCoordinates({
        ...result.geometry?.location,
        latitude: result.geometry?.location?.latitude ?? result.latitude,
        longitude: result.geometry?.location?.longitude ?? result.longitude,
        lat: result.geometry?.location?.lat ?? result.lat,
        lng: result.geometry?.location?.lng ?? result.lng,
      });

      if (location.lat != null && location.lng != null) {
        debugLog('geocode parsed', location);
        return location;
      }
    }

    debugLog('geocode parsed: no numeric coordinates');
    return {};
  } catch (error) {
    if (signal?.aborted || isAbortError(error)) {
      debugLog('geocode aborted/timed out');
    } else {
      warnLog('geocode network error', { error: describeError(error) });
    }
    return {};
  }
}

if (DEBUG) {
  console.log(`${LOG_PREFIX} config`, {
    enabled: olaMapsEnabled,
    keyLength: OLA_MAPS_API_KEY.length,
    autocompleteUrl: AUTOCOMPLETE_URL,
    geocodeUrl: GEOCODE_URL,
  });

  if (!olaMapsEnabled) {
    console.log(
      `${LOG_PREFIX} REST search is DISABLED. Set EXPO_PUBLIC_OLA_MAPS_API_KEY in ` +
        '.env (and in the CI build env). LocationPicker will use Google Places / ' +
        'Photon / local Hyderabad areas.',
    );
  }
}
