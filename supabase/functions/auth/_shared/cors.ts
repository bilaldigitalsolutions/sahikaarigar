// =============================================================================
// SahiKaarigar — shared CORS helpers for Edge Functions
// =============================================================================
// The site is served statically from Firebase Hosting, so every function is
// called cross-origin from the browser. The anon key is public by design; the
// functions verify the Firebase ID token server-side.
// =============================================================================

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

export function json(status: number, body: unknown): Response {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  for (const [key, value] of Object.entries(corsHeaders)) headers.set(key, value);
  return new Response(JSON.stringify(body), { status, headers });
}

export function preflight(): Response {
  const headers = new Headers();
  for (const [key, value] of Object.entries(corsHeaders)) headers.set(key, value);
  return new Response(null, { status: 204, headers });
}
