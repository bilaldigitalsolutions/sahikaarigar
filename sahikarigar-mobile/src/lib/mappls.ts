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
// Everything here is best-effort: any failure returns an empty result so the
// LocationPicker can silently fall back to its built-in area list.
// =============================================================================

import { MAPPLS_ACCESS_TOKEN, MAPPLS_CLIENT_ID, MAPPLS_CLIENT_SECRET } from '@/lib/config';

const TOKEN_URL = 'https://outpost.mappls.com/api/security/oauth/token';
const AUTOSUGGEST_URL = 'https://search.mappls.com/search/places/autosuggest/json';
const GEOCODE_URL = 'https://search.mappls.com/search/address/geocode';

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
  eLoc?: string;
}

interface AutosuggestResponse {
  suggestedLocations?: MapplsSuggestion[];
  userAddedLocations?: MapplsSuggestion[];
}

interface GeocodeResponse {
  results?: { latitude?: number | string; longitude?: number | string }[];
}

let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * Resolve a usable Mappls `access_token`. Uses the static token when provided,
 * otherwise exchanges the client id + secret (result cached until it expires).
 */
export async function getMapplsToken(): Promise<string | null> {
  if (MAPPLS_ACCESS_TOKEN) return MAPPLS_ACCESS_TOKEN;
  if (!MAPPLS_CLIENT_ID || !MAPPLS_CLIENT_SECRET) return null;

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  try {
    const body =
      'grant_type=client_credentials' +
      `&client_id=${encodeURIComponent(MAPPLS_CLIENT_ID)}` +
      `&client_secret=${encodeURIComponent(MAPPLS_CLIENT_SECRET)}`;
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;
    cachedToken = {
      value: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 86_400) * 1000,
    };
    return data.access_token;
  } catch {
    return null;
  }
}

/** Fetch area / locality suggestions for a partially typed query. */
export async function mapplsAutosuggest(
  query: string,
  bias?: { lat?: number; lng?: number },
  signal?: AbortSignal,
): Promise<MapplsPlace[]> {
  const token = await getMapplsToken();
  if (!token) return [];

  let url = `${AUTOSUGGEST_URL}?query=${encodeURIComponent(query.trim())}`;
  if (bias?.lat != null && bias?.lng != null) {
    url += `&location=${bias.lat},${bias.lng}`;
  }
  url += `&access_token=${encodeURIComponent(token)}`;

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const data = (await res.json()) as AutosuggestResponse;
    const items = [...(data.suggestedLocations ?? []), ...(data.userAddedLocations ?? [])];

    const seen = new Set<string>();
    const out: MapplsPlace[] = [];
    for (const item of items) {
      const description = [item.placeName, item.placeAddress]
        .filter((part) => Boolean(part && part.trim()))
        .join(', ');
      if (!description || seen.has(description)) continue;
      seen.add(description);
      out.push({ description, eLoc: item.eLoc });
      if (out.length >= 8) break;
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Best-effort forward geocode — turns an address string into coordinates.
 * Mappls' autosuggest response does not include lat/lng, so we resolve it here
 * when the caller needs coordinates.
 */
export async function mapplsGeocode(address: string): Promise<{ lat?: number; lng?: number }> {
  const token = await getMapplsToken();
  if (!token) return {};

  const url = `${GEOCODE_URL}?address=${encodeURIComponent(address.trim())}&access_token=${encodeURIComponent(token)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return {};
    const data = (await res.json()) as GeocodeResponse;
    const first = data.results?.[0];
    if (!first) return {};
    const lat = Number(first.latitude);
    const lng = Number(first.longitude);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : {};
  } catch {
    return {};
  }
}
