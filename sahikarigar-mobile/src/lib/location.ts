// =============================================================================
// SahiKaarigar — device location helper (expo-location)
// =============================================================================
// Used by the search screen ("near me" sort) and the hire detail screen
// (worker shares live coordinates on en_route / arrived). Always best-effort:
// a denied permission or a timeout returns null and the app simply falls back
// to the profile's saved coordinates / area-based sorting.
// =============================================================================

import * as Location from 'expo-location';

export interface DeviceCoords {
  lat: number;
  lng: number;
}

let cached: DeviceCoords | null = null;

/**
 * Ask for foreground location permission ONLY (no position fix).
 * Screens that need a map can call this before rendering their own UI.
 * Never throws.
 */
export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Current device position, or null when denied / unavailable.
 * Results are cached for the app session so repeated calls stay free.
 */
export async function getDeviceCoords(): Promise<DeviceCoords | null> {
  if (cached) return cached;
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    if (!position?.coords) return null;

    cached = {
      lat: Number(position.coords.latitude.toFixed(6)),
      lng: Number(position.coords.longitude.toFixed(6)),
    };
    return cached;
  } catch {
    return null;
  }
}
