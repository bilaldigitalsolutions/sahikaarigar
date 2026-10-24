// =============================================================================
// SahiKaarigar auth-server — distance + arrival-window helpers
// =============================================================================
// Used when a hire is created (store customer -> worker distance) and when the
// worker presses "Arrived" (decide whether the arrival was on time).
// =============================================================================

const EARTH_RADIUS_KM = 6371;

/** Middle window used when the booking distance is unknown. */
export const DEFAULT_ARRIVAL_WINDOW_MINUTES = 35;

/** Convert a DB numeric/string coordinate into a finite number (or null). */
export function toFiniteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * Haversine distance in kilometres, rounded to 2 decimals.
 * Returns null when any coordinate is missing/invalid.
 */
export function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const fromLat = toFiniteNumber(lat1);
  const fromLng = toFiniteNumber(lng1);
  const toLat = toFiniteNumber(lat2);
  const toLng = toFiniteNumber(lng2);

  if (fromLat === null || fromLng === null || toLat === null || toLng === null) {
    return null;
  }

  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLng / 2) ** 2;
  const km = 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));

  return Math.round(km * 100) / 100;
}

/**
 * Expected arrival window for a booking distance.
 *
 *   <= 3 km  -> 20 minutes
 *   <= 7 km  -> 35 minutes
 *   >  7 km  -> 50 minutes
 *
 * When distance is missing/invalid we use the middle tier (35 min) so legacy
 * bookings and incomplete locations still get a fair window.
 */
export function getExpectedArrivalTime(distanceKm) {
  const km = toFiniteNumber(distanceKm);

  if (km === null || km < 0) return DEFAULT_ARRIVAL_WINDOW_MINUTES;
  if (km <= 3) return 20;
  if (km <= 7) return 35;
  return 50;
}

/** Normalise a free-text area label / service-area id for loose matching. */
export function normalizeArea(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
