// =============================================================================
// Photon (Komoot) geocoder — a KEYLESS autocomplete fallback
// =============================================================================
// The area picker prefers Mappls / Google when a key is configured. When no key
// is available (or the configured provider returns nothing) we fall back to
// Photon: a free, CORS-enabled OpenStreetMap geocoder that needs no API key, so
// area suggestions work out of the box — including in the browser.
//
// Docs: https://photon.komoot.io  •  Data © OpenStreetMap contributors
// =============================================================================

const PHOTON_URL = 'https://photon.komoot.io/api/';

/** Default bias — the app targets Hyderabad, so keep results local. */
const DEFAULT_BIAS = { lat: 17.385, lng: 78.4867 };

export interface PhotonPlace {
  description: string;
  lat?: number;
  lng?: number;
}

interface PhotonFeature {
  properties?: {
    name?: string;
    street?: string;
    district?: string;
    city?: string;
    state?: string;
    country?: string;
    countrycode?: string;
  };
  geometry?: { coordinates?: [number, number] };
}

interface PhotonResponse {
  features?: PhotonFeature[];
}

/** Best-effort area suggestions — returns [] on any failure. */
export async function photonAutosuggest(
  query: string,
  bias: { lat?: number; lng?: number } = DEFAULT_BIAS,
  signal?: AbortSignal,
): Promise<PhotonPlace[]> {
  const lat = bias.lat ?? DEFAULT_BIAS.lat;
  const lng = bias.lng ?? DEFAULT_BIAS.lng;

  const url =
    `${PHOTON_URL}?q=${encodeURIComponent(query.trim())}` +
    `&limit=8&lang=en&lat=${lat}&lon=${lng}&location_bias_scale=0.4`;

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const data = (await res.json()) as PhotonResponse;

    const seen = new Set<string>();
    const out: PhotonPlace[] = [];

    for (const feature of data.features ?? []) {
      const p = feature.properties ?? {};
      // Keep the list India-focused; skip records that clearly aren't.
      if (p.countrycode && p.countrycode !== 'IN') continue;

      const parts = [p.name, p.street, p.district, p.city, p.state]
        .map((part) => (part ?? '').trim())
        .filter(Boolean);
      const description = [...new Set(parts)].join(', ');
      if (!description || seen.has(description)) continue;
      seen.add(description);

      const [plng, plat] = feature.geometry?.coordinates ?? [];
      out.push({ description, lat: plat, lng: plng });
      if (out.length >= 8) break;
    }

    return out;
  } catch {
    return [];
  }
}
