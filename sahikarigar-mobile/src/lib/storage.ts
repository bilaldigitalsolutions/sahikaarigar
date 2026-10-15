// =============================================================================
// Storage utilities — AsyncStorage helpers for app state persistence
// =============================================================================
// NOTE: role/location/onboarding are stored as RAW strings (not JSON) so they
// stay compatible with values written by older builds (ModeContext writes
// plain 'worker' / 'employer').
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';

/** User's selected location area (e.g. "Madhapur", "LB Nagar"). */
export const LOCATION_KEY = 'user_location';

/** Chosen role: 'worker' | 'employer'. */
export const ROLE_KEY = 'user_role';

/** Whether onboarding (location + role) has been completed. */
export const ONBOARDING_KEY = 'has_seen_onboarding';

/** Legacy key — migrated on read, removed on write. */
export const LEGACY_MODE_KEY = 'sahikarigar.appMode';

async function getRaw(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function setRaw(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // Ignore storage errors (e.g., quota issues).
  }
}

async function removeKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}

// ─── Location helpers ───────────────────────────────────────────────

export async function getLocation(): Promise<string | null> {
  return getRaw(LOCATION_KEY);
}

export async function setLocation(location: string): Promise<void> {
  await setRaw(LOCATION_KEY, location);
}

export async function removeLocation(): Promise<void> {
  await removeKey(LOCATION_KEY);
}

// ─── Role helpers ───────────────────────────────────────────────────

export type StoredRole = 'worker' | 'employer';

function normalizeRole(value: string | null): StoredRole | null {
  if (value === 'worker') return 'worker';
  if (value === 'employer' || value === 'customer') return 'employer';
  // Tolerate values persisted via JSON.stringify by older helpers.
  if (value === '"worker"') return 'worker';
  if (value === '"employer"' || value === '"customer"') return 'employer';
  return null;
}

export async function getRole(): Promise<StoredRole | null> {
  const role = normalizeRole(await getRaw(ROLE_KEY));
  if (role) return role;
  // Migrate pre-role-selection installs.
  return normalizeRole(await getRaw(LEGACY_MODE_KEY));
}

export async function setRole(role: StoredRole): Promise<void> {
  await setRaw(ROLE_KEY, role);
  // Best-effort cleanup of the legacy key so the two never disagree.
  await removeKey(LEGACY_MODE_KEY);
}

export async function removeRole(): Promise<void> {
  await removeKey(ROLE_KEY);
  await removeKey(LEGACY_MODE_KEY);
}

// ─── Onboarding helpers ─────────────────────────────────────────────

export async function getHasSeenOnboarding(): Promise<boolean> {
  const val = await getRaw(ONBOARDING_KEY);
  return val === '1' || val === 'true';
}

export async function setHasSeenOnboarding(seen: boolean): Promise<void> {
  await setRaw(ONBOARDING_KEY, seen ? '1' : '0');
}

export async function removeOnboarding(): Promise<void> {
  await removeKey(ONBOARDING_KEY);
}