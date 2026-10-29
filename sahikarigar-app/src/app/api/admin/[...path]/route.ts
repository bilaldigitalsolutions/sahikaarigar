// =============================================================================
// SahiKaarigar — same-origin ADMIN PROXY  (/api/admin/… ➜ auth-server /admin/…)
// =============================================================================
// WHY THIS EXISTS
//
// The admin panel runs on https://sahikaarigar.vercel.app while the auth
// server is a DIFFERENT site (https://sahikaarigar-auth.onrender.com). The
// admin session (`sk_admin_session`) is an HttpOnly cookie, and a cookie set
// by the Render origin is a THIRD-PARTY cookie from the panel's point of view.
// Modern browsers (Chromium storage-access deprecation, Safari ITP, Firefox
// ETP) refuse to store/echo third-party cookies — live diagnosis showed
// `POST /admin/login` returning 200 yet the follow-up `GET /admin/session`
// arriving with NO `Cookie` header at all, which produced the confusing
// "correct credentials, still 401".
//
// THE FIX — make the cookie FIRST-PARTY:
//   1. The panel calls its own origin:  /api/admin/…  (same-origin).
//   2. This handler forwards the request to the auth server.
//   3. Any `sk_admin_session` Set-Cookie from the backend is REWRITTEN
//      (HttpOnly + Secure + SameSite=Lax + Path=/) on the panel's own origin,
//      so the browser happily stores and echoes it.
//
// HttpOnly is preserved (the token is still unreadable to JS), and because the
// cookie is now SameSite=Lax on the panel origin, it is NOT attached to
// cross-site POSTs from other sites — the CSRF defence is unchanged.
//
// The backend URL is read from the SERVER-side env:
//   AUTH_API_URL (preferred) → NEXT_PUBLIC_AUTH_API_URL (fallback).
// =============================================================================

export const dynamic = 'force-dynamic';

const BACKEND_URL = (
  process.env.AUTH_API_URL ||
  process.env.NEXT_PUBLIC_AUTH_API_URL ||
  'https://sahikaarigar-auth.onrender.com'
).replace(/\/+$/, '');

const ADMIN_COOKIE_NAME = 'sk_admin_session';
/** Server default: 4h (ADMIN_SESSION_TTL_MS). Only used if Max-Age is absent. */
const ADMIN_COOKIE_TTL_SECONDS = 4 * 60 * 60;

type RouteContext = { params: { path: string[] } | Promise<{ path: string[] }> };

/**
 * Rewrites one Set-Cookie from the backend for the panel's own origin:
 *   • sk_admin_session  → re-issued HttpOnly + Secure + SameSite=Lax + Path=/
 *     with the backend's Max-Age preserved (or an explicit expiry when the
 *     backend is clearing the cookie, e.g. a stale-token 401 or logout).
 *   • anything else     → passed through unchanged.
 */
function rewriteSetCookie(raw: string): string {
  const head = raw.slice(0, raw.indexOf(';'));
  const eq = head.indexOf('=');
  const name = (eq === -1 ? head : head.slice(0, eq)).trim();
  if (name !== ADMIN_COOKIE_NAME) {
    // Other cookies (e.g. SuperTokens internals) are not the panel's concern.
    return raw;
  }
  const value = eq === -1 ? '' : head.slice(eq + 1).trim();
  const isDeletion =
    value === '' ||
    /max-age\s*=\s*0(?!\d)/i.test(raw) ||
    /expires\s*=\s*thu,\s*01\s+jan\s+1970/i.test(raw);

  const parts = [
    `${ADMIN_COOKIE_NAME}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');

  if (isDeletion) {
    parts.push('Max-Age=0', 'Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  } else {
    const maxAge = raw.match(/max-age\s*=\s*(\d+)/i);
    parts.push(`Max-Age=${maxAge ? maxAge[1] : ADMIN_COOKIE_TTL_SECONDS}`);
  }
  return parts.join('; ');
}

async function forward(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  const search = new URL(request.url).search;

  // Only forward what the backend actually needs. Its own CORS layer already
  // treats a request without Origin (server-to-server) as allowed.
  const headers = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  const authorization = request.headers.get('authorization');
  if (authorization) headers.set('authorization', authorization);
  const cookie = request.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);

  let backendResponse: Response;
  try {
    backendResponse = await fetch(`${BACKEND_URL}/${(path ?? []).join('/')}${search}`, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : await request.arrayBuffer(),
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch (failure) {
    // Render asleep / cold start — surface as 503 so the frontend keeps the
    // panel's session instead of logging the admin out.
    return Response.json(
      {
        ok: false,
        code: 'AUTH_SERVER_UNREACHABLE',
        message: 'Auth server se connection nahi ho paya (cold start or network).',
      },
      { status: 503 },
    );
  }

  const responseHeaders = new Headers({
    'content-type': backendResponse.headers.get('content-type') ?? 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });

  // getSetCookie() is required: `headers.get('set-cookie')` would merge several
  // Set-Cookie headers (login sets the session, 401 clears it, etc.) and
  // comma-splitting is unsafe because cookie Expires values contain commas.
  const setCookies =
    typeof backendResponse.headers.getSetCookie === 'function'
      ? backendResponse.headers.getSetCookie()
      : [];
  for (const raw of setCookies) {
    responseHeaders.append('set-cookie', rewriteSetCookie(raw));
  }

  return new Response(await backendResponse.arrayBuffer(), {
    status: backendResponse.status,
    headers: responseHeaders,
  });
}

export async function GET(request: Request, context: RouteContext) {
  return forward(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return forward(request, context);
}

export async function PATCH(request: Request, context: RouteContext) {
  return forward(request, context);
}

export async function PUT(request: Request, context: RouteContext) {
  return forward(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return forward(request, context);
}

export async function HEAD(request: Request, context: RouteContext) {
  return forward(request, context);
}
