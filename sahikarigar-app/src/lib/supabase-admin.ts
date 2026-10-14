import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let adminClient: SupabaseClient | null = null;

/**
 * Server-side Supabase client authenticated with the `service_role` key.
 *
 * The service role BYPASSES Row Level Security, so this must only ever be
 * imported from server code (API routes, services, middleware). Never send this
 * key to the browser.
 *
 * The client is created lazily so that `next build` succeeds even when the
 * environment variables are not configured yet.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!SUPABASE_URL) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  if (!adminClient) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'x-application-name': 'sahikarigar-server' } },
    });
  }

  return adminClient;
}

/** Shorthand used inside services: `db().from('users')...` */
export const db = getSupabaseAdmin;

export default getSupabaseAdmin;
