// =============================================================================
// Runtime configuration (read from EXPO_PUBLIC_* env vars at build time)
// =============================================================================

/** Base URL of the SuperTokens auth-server (Express, see auth-server/). */
export const AUTH_API_URL = (process.env.EXPO_PUBLIC_AUTH_API_URL ?? '').replace(/\/+$/, '');

export const APP_NAME = process.env.EXPO_PUBLIC_APP_NAME ?? 'Sahi Kaarigar';

/** When true the app uses local fake data and never touches the network. */
export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === '1';

/** Optional — only needed if you query Supabase directly from the app. */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Google Places API key — optional secondary area / location provider. Used
 * when Ola Maps is not configured or returned no results.
 */
export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

/**
 * Ola Maps API key — primary area / location provider. The key is sent as the
 * `api_key` query parameter by `lib/olaMaps.ts`. Because EXPO_PUBLIC_* values
 * are embedded in the app bundle, restrict the key in the Ola Maps console.
 */
const olaMapsEnv = (value: string | undefined) => (value ?? '').trim();

export const OLA_MAPS_API_KEY = olaMapsEnv(process.env.EXPO_PUBLIC_OLA_MAPS_API_KEY);

/**
 * Mappls (MapmyIndia) REST credentials — legacy fallback. LocationPicker now
 * uses Ola Maps, but `lib/mappls.ts` is retained for reference / manual use.
 * Provide EITHER a static access token, OR a client id + client secret
 * (the app then fetches a token automatically). See `lib/mappls.ts`.
 *
 *   EXPO_PUBLIC_MAPPLS_ACCESS_TOKEN   – copied from the Mappls console
 *   EXPO_PUBLIC_MAPPLS_CLIENT_ID      – from the Mappls console "credentials"
 *   EXPO_PUBLIC_MAPPLS_CLIENT_SECRET  – from the Mappls console "credentials"
 */
const mapplsEnv = (value: string | undefined) => (value ?? '').trim();

export const MAPPLS_ACCESS_TOKEN = mapplsEnv(
  process.env.EXPO_PUBLIC_MAPPLS_ACCESS_TOKEN ?? process.env.EXPO_PUBLIC_MAPPLS_API_KEY,
);
export const MAPPLS_API_KEY = mapplsEnv(process.env.EXPO_PUBLIC_MAPPLS_API_KEY);
export const MAPPLS_CLIENT_ID = mapplsEnv(process.env.EXPO_PUBLIC_MAPPLS_CLIENT_ID);
export const MAPPLS_CLIENT_SECRET = mapplsEnv(process.env.EXPO_PUBLIC_MAPPLS_CLIENT_SECRET);

/** Throws a friendly error when the auth server has not been configured. */
export function requireAuthApiUrl(): string {
  if (!AUTH_API_URL) {
    throw new Error(
      'Auth server is not configured. Set EXPO_PUBLIC_AUTH_API_URL in `.env` (see .env.example).',
    );
  }
  return AUTH_API_URL;
}
