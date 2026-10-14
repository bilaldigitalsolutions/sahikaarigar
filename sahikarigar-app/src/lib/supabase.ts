import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Supabase Storage bucket names (see supabase/migrations/0002_storage.sql) */
export const STORAGE_BUCKETS = {
  AVATARS: 'avatars',
  PORTFOLIO: 'portfolio',
} as const;

let browserClient: SupabaseClient | null = null;

/**
 * Public (anon) Supabase client.
 *
 * Safe to use in the browser — it honours Row Level Security, and every table
 * in this project denies access to the `anon` role, so it is mainly useful for
 * uploading/reading public Storage objects. All database reads and writes
 * happen server-side through `getSupabaseAdmin()`.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables'
    );
  }

  if (!browserClient) {
    browserClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return browserClient;
}

/**
 * Build the public URL for an object stored in a public Supabase Storage bucket.
 */
export function getPublicStorageUrl(bucket: string, path: string): string {
  if (!SUPABASE_URL) return path;
  const cleanPath = path.replace(/^\/+/, '');
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${cleanPath}`;
}

/** Convenience helper for worker avatars. */
export function getAvatarUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  return getPublicStorageUrl(STORAGE_BUCKETS.AVATARS, path);
}
