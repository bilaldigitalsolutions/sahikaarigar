// =============================================================================
// Google Maps deep links — directions + live-location preview
// =============================================================================
// The app does not need a native maps SDK for the hire flow: Google Maps
// handles turn-by-turn navigation from the worker's current position to the
// customer's address. Keeping this in one helper makes both sides behave the
// same way (and gives a browser fallback when the Maps app is not installed).
// =============================================================================

import { Linking } from 'react-native';

export interface MapTarget {
  lat?: number | null;
  lng?: number | null;
  /** Address / area fallback when coordinates are unavailable. */
  label?: string | null;
}

function targetValue(target: MapTarget): string | null {
  const { lat, lng } = target;
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    return `${lat},${lng}`;
  }
  const label = target.label?.trim();
  return label ? label : null;
}

async function openExternal(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/** Open Google Maps turn-by-turn directions to `target`. */
export async function openDirections(target: MapTarget): Promise<boolean> {
  const destination = targetValue(target);
  if (!destination) return false;

  // encodeURIComponent instead of URLSearchParams: React Native's global
  // URLSearchParams has historically been incomplete on some engines.
  return openExternal(
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`,
  );
}

/**
 * Open a map pin for a location (used by the customer to track the worker).
 *
 * With real coordinates we open turn-by-turn DIRECTIONS to the pin: pushing a
 * raw "17.32739,78.488259" string through the SEARCH url makes Google Maps
 * treat it as a text query and render the suggestions screen (restaurants,
 * hotels, "Where to stay") instead of the pin. The directions sheet opens the
 * pin AND a usable route — what tracking actually needs.
 */
export async function openMapLocation(target: MapTarget): Promise<boolean> {
  const { lat, lng } = target;
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    return openExternal(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}&travelmode=driving`,
    );
  }

  // Text-only label (address / area) — the search url is correct for words.
  const label = target.label?.trim();
  if (!label) return false;

  return openExternal(
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}`,
  );
}
