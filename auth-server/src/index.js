// =============================================================================
// SahiKaarigar auth-server — SuperTokens (passwordless phone OTP) + Express
// =============================================================================
//   npm install && cp .env.example .env && npm start        (SMS_PROVIDER=console)
//
// Endpoints
//   /auth/*            SuperTokens managed (createCode, signinup/code/consume, ...)
//   GET  /me           signed-in user's Supabase row (creates it on first login)
//   POST /register-worker  upsert the worker profile (session protected)
//   GET  /health       liveness
// =============================================================================

import 'dotenv/config';
import * as Sentry from '@sentry/node';
import express from 'express';
import cors from 'cors';
import supertokens from 'supertokens-node';
import Passwordless from 'supertokens-node/recipe/passwordless';
import Session from 'supertokens-node/recipe/session';
import { middleware, errorHandler } from 'supertokens-node/framework/express';

import { sendOtpSms, resolveSmsProvider, SUPPORTED_SMS_PROVIDERS } from './sms.js';
import {
  getOrCreateUserByAuthId,
  upsertWorkerProfile,
  uploadWorkerImages,
  updateUser,
  savePushToken,
  deleteUserAccount,
  normalizeIndianPhone,
  isValidIndianPhone,
} from './users.js';
import { searchWorkers, getWorkerById, getWorkerProfileIdForUser } from './workers.js';
import {
  getOwnWorkerProfile,
  getWorkerDashboard,
  setWorkerAvailability,
  updateOwnWorkerProfile,
} from './worker-dashboard.js';
import {
  createHireRequest,
  listHiresForUser,
  getHireById,
  getHireStartOtp,
  hireAction,
} from './hires.js';
import {
  createReview,
  createPlatformFeedback,
  listReviewsByWorker,
  getReviewByHireRequest,
} from './reviews.js';
import { createReport } from './reports.js';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_MS,
  getAdminStats,
  getAdminSession,
  getAdminWorker,
  loginAdmin,
  listAdminHires,
  listAdminReports,
  listAdminUsers,
  listAdminWorkers,
  setReportStatus,
  setUserActive,
  setUserFlagged,
  setWorkerApproval,
  setWorkerFlagged,
} from './admin.js';
import { notifyHireUpdate, notifyWorkerOfNewHire } from './push.js';

const PORT = Number(process.env.PORT || 4000);
// Render exposes a web service's public URL as RENDER_EXTERNAL_URL, so the
// deployment works without hand-setting API_DOMAIN.
const API_DOMAIN =
  process.env.API_DOMAIN || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
const WEBSITE_DOMAIN = (process.env.WEBSITE_DOMAIN || 'http://localhost:3000').replace(/\/+$/, '');
const API_BASE_PATH = process.env.API_BASE_PATH || '/auth';
const APP_NAME = process.env.APP_NAME || 'SahiKaarigar';

// Sentry error tracking — optional; only active when SENTRY_DSN is set.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    tracesSampleRate: 0.1,
  });
}

if (!process.env.SUPERTOKENS_CONNECTION_URI) {
  console.error('✗ SUPERTOKENS_CONNECTION_URI is not set — see .env.example');
  process.exit(1);
}

supertokens.init({
  framework: 'express',
  supertokens: {
    connectionURI: process.env.SUPERTOKENS_CONNECTION_URI,
    apiKey: process.env.SUPERTOKENS_API_KEY || undefined,
  },
  appInfo: {
    appName: APP_NAME,
    apiDomain: API_DOMAIN,
    websiteDomain: WEBSITE_DOMAIN,
    apiBasePath: API_BASE_PATH,
    websiteBasePath: '/auth',
  },
  recipeList: [
    Passwordless.init({
      contactMethod: 'PHONE',
      flowType: 'USER_INPUT_CODE',
      // Only Indian mobile numbers may sign in.
      validatePhoneNumber: (phoneNumber) =>
        isValidIndianPhone(normalizeIndianPhone(phoneNumber))
          ? undefined
          : 'Sahi 10-digit Indian mobile number daalo (6, 7, 8 ya 9 se shuru).',
      // SuperTokens makes the code; WE deliver it (see src/sms.js).
      // sendSms receives TypePasswordlessSmsDeliveryInput:
      //   { type: "PASSWORDLESS_LOGIN", phoneNumber, userInputCode, codeLifetime, ... }
      smsDelivery: {
        override: (originalImplementation) => ({
          ...originalImplementation,
          sendSms: async (input) => {
            const otp = String(input?.userInputCode ?? '');
            const phone = normalizeIndianPhone(input?.phoneNumber ?? '');

            if (!otp) throw new Error('SuperTokens did not supply an OTP to deliver');
            if (!phone) throw new Error('SuperTokens did not supply a phone number to deliver to');

            // Stashed on the request's userContext so createCodePOST below can
            // echo it back when no real SMS provider is configured (dev only).
            if (input?.userContext) input.userContext.devOtp = otp;

            await sendOtpSms({ phone, otp });
          },
        }),
      },
      // Dev convenience: with no SMS provider configured the OTP only reaches
      // the server logs, so we also return it in the createCode response and the
      // app shows / auto-fills it (see OtpVerifier). As soon as a real provider
      // is configured (see src/sms.js) the code never leaves the server.
      override: {
        apis: (originalImplementation) => ({
          ...originalImplementation,
          createCodePOST: async (input) => {
            const response = await originalImplementation.createCodePOST(input);
            if (response?.status === 'OK' && resolveSmsProvider() === 'console') {
              const devOtp = input?.userContext?.devOtp;
              if (devOtp) return { ...response, userInputCode: String(devOtp) };
            }
            return response;
          },
        }),
      },
    }),
    Session.init(),
  ],
});

const app = express();

// Order matters: SuperTokens' middleware must see its own routes BEFORE the
// JSON body parser consumes the request body.
// CORS: allow the configured website domain(s), localhost dev origins (Expo web
// runs on :8081 / :19006) and native apps, which send no Origin header at all.
const EXTRA_ORIGINS = (process.env.EXTRA_CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);
// The Firebase-hosted admin panel. Always allowed, even if WEBSITE_DOMAIN is
// missing from the environment, so the admin API never fails CORS in prod.
const PRODUCTION_ORIGIN = 'https://sahi-kaarigar.web.app';
const ALLOWED_ORIGINS = [...new Set([PRODUCTION_ORIGIN, WEBSITE_DOMAIN, ...EXTRA_ORIGINS])];
const LOCALHOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?$/;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true); // native app / curl
      if (ALLOWED_ORIGINS.includes(origin) || LOCALHOST_RE.test(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    // `authorization` is required for the admin panel's Bearer token. Without
    // it the browser's preflight blocks every /admin/* request.
    allowedHeaders: ['content-type', 'authorization', ...supertokens.getAllCORSHeaders()],
    credentials: true,
  }),
);

// ---------------------------------------------------------------------------
// Rate limiting for login OTP — prevents SMS bombing
// Max 3 requests per minute per IP+phone combination.
// In-memory map is fine here: SMS bombing is a real-time attack, and a
// redeploy resetting the counter is acceptable. (Start-work OTP rate limiting
// uses the persistent `rate_limits` table in hires.js.)
// ---------------------------------------------------------------------------
const LOGIN_OTP_MAX_ATTEMPTS = 3;
const LOGIN_OTP_WINDOW_MS = 60_000;
const loginOtpAttempts = new Map();

app.use(
  '/auth/signinup/code',
  express.json({ limit: '15mb' }),
  async (_req, res, next) => {
    // Only POST requests create OTPs; GET/other methods pass through.
    if (_req.method !== 'POST') return next();

    const phone = _req.body?.phoneNumber || '';
    const ip = _req.ip || _req.socket.remoteAddress || 'unknown';
    const key = `login_otp:${ip}:${phone}`;
    const now = Date.now();

    let attempts = loginOtpAttempts.get(key) ?? [];
    attempts = attempts.filter((t) => now - t < LOGIN_OTP_WINDOW_MS);

    if (attempts.length >= LOGIN_OTP_MAX_ATTEMPTS) {
      return res.status(429).json({
        status: 'GENERAL_ERROR',
        message:
          'Bahut zyada OTP requests. Kripya 1 minute baad try karein.',
      });
    }

    attempts.push(now);
    loginOtpAttempts.set(key, attempts);
    next();
  },
);

app.use(middleware());
app.use(express.json({ limit: '15mb' }));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    // Render injects RENDER_GIT_COMMIT — lets you confirm WHICH commit is live.
    build: (process.env.RENDER_GIT_COMMIT || '').slice(0, 7) || 'dev',
    smsProvider: resolveSmsProvider(),
    supportedSmsProviders: SUPPORTED_SMS_PROVIDERS,
  });
});

/** SuperTokens user id -> the phone number SuperTokens stored at sign-up. */
async function resolveSession(session) {
  const authUserId = session.getUserId();
  let phone = '';
  try {
    const stUser = await supertokens.getUser(authUserId, {});
    phone = normalizeIndianPhone(stUser?.phoneNumbers?.[0] ?? '');
  } catch (error) {
    console.error('supertokens.getUser failed:', error);
  }
  return { authUserId, phone };
}

app.get('/me', async (req, res, next) => {
  try {
    const session = await Session.getSession(req, res, { sessionRequired: true });
    const { authUserId, phone } = await resolveSession(session);
    const user = await getOrCreateUserByAuthId(authUserId, phone);
    res.json({ ok: true, user });
  } catch (error) {
    next(error);
  }
});

// The mobile app calls this after login so hire status changes can reach the
// user's device through the free Expo Push API (see src/push.js). Sending an
// empty token clears the row (e.g. after the user denies notifications).
app.post('/me/push-token', async (req, res, next) => {
  try {
    const session = await Session.getSession(req, res, { sessionRequired: true });
    const { authUserId, phone } = await resolveSession(session);
    const user = await getOrCreateUserByAuthId(authUserId, phone);
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    if (token && !token.startsWith('ExponentPushToken[')) {
      res.status(400).json({ ok: false, code: 'BAD_REQUEST', message: 'Invalid push token' });
      return;
    }
    await savePushToken(user.id, token || null);
    res.json({ ok: true, saved: Boolean(token) });
  } catch (error) {
    next(error);
  }
});

app.post('/register-worker', async (req, res, next) => {
  try {
    const session = await Session.getSession(req, res, { sessionRequired: true });
    const { authUserId, phone } = await resolveSession(session);
    const user = await getOrCreateUserByAuthId(authUserId, phone, req.body?.name);
    const profile = req.body?.profile ?? {};
    const images = await uploadWorkerImages(user.id, {
      aadhaarPhotoDataUrl: profile.aadhaarPhotoDataUrl,
      profilePhotoDataUrl: profile.profilePhotoDataUrl,
      workPhotoDataUrls: profile.workPhotoDataUrls,
    });
    const workerProfile = await upsertWorkerProfile(user.id, {
      ...profile,
      aadhaarPhotoPath: images.aadhaarPhotoPath,
      workPhotoUrls: images.workPhotoUrls,
    });
    // upsertWorkerProfile promotes the row to role='worker' in the database;
    // reflect that in the response so the client can route on `user.role`
    // without waiting for the next /me round-trip.
    res.json({ ok: true, user: { ...user, role: 'worker' }, workerProfile });
  } catch (error) {
    next(error);
  }
});

// Update the signed-in user's own profile (used by employer registration and
// the /profile page — replaces the old Firebase `loginWithToken(token, name)`).
app.post('/profile', async (req, res, next) => {
  try {
    const session = await Session.getSession(req, res, { sessionRequired: true });
    const { authUserId, phone } = await resolveSession(session);
    const user = await getOrCreateUserByAuthId(authUserId, phone);
    const updated = await updateUser(user.id, req.body ?? {});
    res.json({ ok: true, user: updated });
  } catch (error) {
    next(error);
  }
});

// Delete the signed-in user's account and everything attached to it
// (worker profile, hires, reviews, reports, feedback + the SuperTokens
// identity). Play policy needs an in-app delete path; the privacy page
// promises it ("Contact page se humse sampark karo" wala para ab live hai).
app.delete('/account', async (req, res, next) => {
  try {
    const session = await Session.getSession(req, res, { sessionRequired: true });
    const { authUserId, phone } = await resolveSession(session);
    const user = await getOrCreateUserByAuthId(authUserId, phone);
    await deleteUserAccount({ userId: user.id, authUserId });
    try {
      await Session.revokeAllSessionsForUser(authUserId);
    } catch {
      // best-effort: rows + identity are already gone
    }
    res.json({ ok: true, deleted: true });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Workers — public reads (no session needed, phone is withheld from the list)
// ---------------------------------------------------------------------------
app.get('/workers', async (req, res, next) => {
  try {
    const result = await searchWorkers({
      skill: req.query.skill,
      area: req.query.area,
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

app.get('/workers/:id', async (req, res, next) => {
  try {
    const worker = await getWorkerById(req.params.id);
    if (!worker) {
      res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'Kaarigar nahi mila' });
      return;
    }
    const reviews = await listReviewsByWorker(req.params.id, 1, 20);
    res.json({ ok: true, worker, reviews: reviews.reviews, reviewCount: reviews.pagination.total });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Hires — session required. The session's phone is what proves the user, so a
// brand-new user is created on the spot (no separate signup form needed).
// ---------------------------------------------------------------------------
app.get('/hires', async (req, res, next) => {
  try {
    const session = await Session.getSession(req, res, { sessionRequired: true });
    const { authUserId, phone } = await resolveSession(session);
    const user = await getOrCreateUserByAuthId(authUserId, phone);
    const hires = await listHiresForUser(user.id);
    res.json({ ok: true, ...hires });
  } catch (error) {
    next(error);
  }
});

app.post('/hires', async (req, res, next) => {
  try {
    const session = await Session.getSession(req, res, { sessionRequired: true });
    const { authUserId, phone } = await resolveSession(session);
    const user = await getOrCreateUserByAuthId(authUserId, phone, req.body?.name);
    const hire = await createHireRequest({
      employerId: user.id,
      workerId: req.body?.workerId,
      description: req.body?.description,
      location: req.body?.location,
      proposedRate: req.body?.proposedRate,
      scheduledDate: req.body?.scheduledDate,
    });
    // Fire-and-forget: the kaarigar gets a push about the new request.
    void notifyWorkerOfNewHire(hire);
    res.json({ ok: true, hire });
  } catch (error) {
    next(error);
  }
});

app.get('/hires/:id', async (req, res, next) => {
  try {
    const session = await Session.getSession(req, res, { sessionRequired: true });
    const { authUserId, phone } = await resolveSession(session);
    const user = await getOrCreateUserByAuthId(authUserId, phone);
    const hire = await getHireById(req.params.id);
    if (!hire) {
      res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'Hire request nahi mila' });
      return;
    }
    // IDOR guard — a booking carries both parties' phone numbers and home
    // location, so ONLY its two sides may read it. Any other signed-in user
    // (or a leaked/guessed id) gets a 403 instead of the payload.
    const workerProfileId = await getWorkerProfileIdForUser(user.id);
    const isEmployer = hire.employerId === user.id;
    const isWorker = Boolean(workerProfileId) && hire.workerId === workerProfileId;
    if (!isEmployer && !isWorker) {
      res.status(403).json({ ok: false, code: 'FORBIDDEN', message: 'Ye booking aapki nahi hai' });
      return;
    }
    const review = await getReviewByHireRequest(req.params.id);
    res.json({ ok: true, hire, review });
  } catch (error) {
    next(error);
  }
});

// The "start work" OTP — EMPLOYER only, so the customer's screen can show the
// code the kaarigar must type to begin the job (privacy: the worker's own
// session can never read it).
app.get('/hires/:id/start-otp', async (req, res, next) => {
  try {
    const session = await Session.getSession(req, res, { sessionRequired: true });
    const { authUserId, phone } = await resolveSession(session);
    const user = await getOrCreateUserByAuthId(authUserId, phone);
    const { otp } = await getHireStartOtp({ hireId: req.params.id, userId: user.id });
    console.log('[OTP] hireId=%s employerId=%s otp=%s', req.params.id, user.id, otp);
    res.json({ ok: true, otp });
  } catch (error) {
    console.log('[OTP] hireId=%s error=%s', req.params.id, error instanceof Error ? error.message : String(error));
    next(error);
  }
});

// One route for every state change: accept | reject | en_route | arrived |
// start | complete | cancel. `hires.js` decides who is allowed to do what.
app.patch('/hires/:id', async (req, res, next) => {
  try {
    // The admin panel uses our HMAC admin token as a Bearer header. Valid
    // admin tokens must never mutate hires — only the assigned worker
    // (accept/reject) and employer (complete/cancel) may, through their
    // SuperTokens session (which the mobile SDK also sends as a Bearer JWT).
    const bearer = (req.get('authorization') || '').match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
    let isAdminToken = false;
    try {
      isAdminToken = Boolean(bearer && getAdminSession(bearer));
    } catch {
      isAdminToken = false;
    }
    if (isAdminToken) {
      res.status(403).json({
        ok: false,
        code: 'FORBIDDEN',
        message: 'Admin hire status nahi badal sakta.',
      });
      return;
    }
    const session = await Session.getSession(req, res, { sessionRequired: true });
    const { authUserId, phone } = await resolveSession(session);
    const user = await getOrCreateUserByAuthId(authUserId, phone);
    const hire = await hireAction({
      hireId: req.params.id,
      userId: user.id,
      action: req.body?.action,
      lat: req.body?.lat,
      lng: req.body?.lng,
      otp: req.body?.otp,
    });
    // Fire-and-forget: the OTHER party gets a push about the status change.
    void notifyHireUpdate(hire, req.body?.action);
    res.json({ ok: true, hire });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Worker dashboard — the kaarigar's own side of the app. Session required.
//   GET   /worker/dashboard     profile + availability + job buckets + stats
//   PATCH /worker/availability  { availability: 'available' | 'busy' | 'offline' }
// ---------------------------------------------------------------------------
app.get('/worker/dashboard', async (req, res, next) => {
  try {
    const session = await Session.getSession(req, res, { sessionRequired: true });
    const { authUserId, phone } = await resolveSession(session);
    const user = await getOrCreateUserByAuthId(authUserId, phone);
    const dashboard = await getWorkerDashboard(user.id);

    // Not a worker (yet) — an empty payload beats a 403 so the app can simply
    // hide the tab instead of showing an error.
    if (!dashboard) {
      res.json({
        ok: true,
        isWorker: false,
        worker: null,
        stats: null,
        requests: [],
        active: [],
        completed: [],
      });
      return;
    }
    res.json({ ok: true, isWorker: true, ...dashboard });
  } catch (error) {
    next(error);
  }
});

// The signed-in worker's own profile — read + editable fields (skills,
// experience, rate, service areas). Used by the mobile Edit Profile screen.
// Editing an existing profile must NOT reset is_approved/verification_status
// (unlike /register-worker, which re-enters the verification queue on purpose).
app.get('/worker/profile', async (req, res, next) => {
  try {
    const session = await Session.getSession(req, res, { sessionRequired: true });
    const { authUserId, phone } = await resolveSession(session);
    const user = await getOrCreateUserByAuthId(authUserId, phone);
    const worker = await getOwnWorkerProfile(user.id);
    res.json({ ok: true, worker });
  } catch (error) {
    next(error);
  }
});

app.patch('/worker/profile', async (req, res, next) => {
  try {
    const session = await Session.getSession(req, res, { sessionRequired: true });
    const { authUserId, phone } = await resolveSession(session);
    const user = await getOrCreateUserByAuthId(authUserId, phone);
    const worker = await updateOwnWorkerProfile(user.id, req.body ?? {});
    res.json({ ok: true, worker });
  } catch (error) {
    next(error);
  }
});

app.patch('/worker/availability', async (req, res, next) => {
  try {
    const session = await Session.getSession(req, res, { sessionRequired: true });
    const { authUserId, phone } = await resolveSession(session);
    const user = await getOrCreateUserByAuthId(authUserId, phone);
    const worker = await setWorkerAvailability(user.id, req.body?.availability);
    res.json({ ok: true, worker });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Reviews (of the worker) + platform feedback (of SahiKaarigar itself)
// ---------------------------------------------------------------------------
app.post('/reviews', async (req, res, next) => {
  try {
    const session = await Session.getSession(req, res, { sessionRequired: true });
    const { authUserId, phone } = await resolveSession(session);
    const user = await getOrCreateUserByAuthId(authUserId, phone);
    const review = await createReview({
      reviewerId: user.id,
      hireRequestId: req.body?.hireRequestId,
      rating: req.body?.rating,
      comment: req.body?.comment,
      tip: req.body?.tip,
      likes: req.body?.likes,
    });
    res.json({ ok: true, review });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Reports — lets any logged-in user report another user (Group 3).
// ---------------------------------------------------------------------------
app.post('/reports', async (req, res, next) => {
  try {
    const session = await Session.getSession(req, res, { sessionRequired: true });
    const { authUserId, phone } = await resolveSession(session);
    const user = await getOrCreateUserByAuthId(authUserId, phone);
    const report = await createReport({
      reporter_id: user.id,
      reported_id: req.body?.reported_id,
      reason: req.body?.reason,
      description: req.body?.description,
    });
    res.json({ ok: true, report });
  } catch (error) {
    next(error);
  }
});

app.post('/feedback', async (req, res, next) => {
  try {
    const session = await Session.getSession(req, res, { sessionRequired: true });
    const { authUserId, phone } = await resolveSession(session);
    const user = await getOrCreateUserByAuthId(authUserId, phone);
    const feedback = await createPlatformFeedback({
      userId: user.id,
      hireRequestId: req.body?.hireRequestId,
      rating: req.body?.rating,
      comment: req.body?.comment,
    });
    res.json({ ok: true, feedback });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Admin — email/password panel. Sessions are stateless HMAC tokens:
// `<base64url(payload)>.<base64url(hmac-sha256)>`, signed with
// ADMIN_SESSION_SECRET. Every /admin/* route except POST /admin/login is
// protected by requireAdmin(), which reads `Authorization: Bearer <token>`.
// ---------------------------------------------------------------------------
function isAdminAuthConfigured() {
  return Buffer.byteLength(process.env.ADMIN_SESSION_SECRET || '', 'utf8') >= 32;
}

/**
 * Minimal `Cookie` header parser — avoids pulling in a dependency. Returns the
 * value for `name` or undefined. Values are URL-decoded; malformed pairs are
 * ignored rather than throwing.
 */
function readCookie(req, name) {
  const header = req.get('Cookie') || req.get('cookie') || '';
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    if (key !== name) continue;
    const raw = part.slice(index + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return undefined;
}

/**
 * The admin session token is read from the HttpOnly cookie first (the secure
 * path used by the browser panel) and falls back to `Authorization: Bearer`
 * for non-browser clients and for a graceful migration window.
 */
function readAdminToken(req) {
  const cookieToken = readCookie(req, ADMIN_SESSION_COOKIE);
  if (cookieToken) return cookieToken.trim();
  const authorization = req.get('Authorization') || req.get('authorization') || '';
  const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);
  return tokenMatch ? tokenMatch[1].trim() : '';
}

async function requireAdmin(req, res) {
  // A missing/short secret is a server misconfiguration, not an expired
  // session. Return 503 so the frontend keeps the session instead of logging
  // the admin out on every request.
  if (!isAdminAuthConfigured()) {
    res.status(503).json({
      ok: false,
      code: 'ADMIN_AUTH_NOT_CONFIGURED',
      message: 'ADMIN_SESSION_SECRET must be at least 32 characters on the server.',
    });
    return null;
  }

  const token = readAdminToken(req);
  const admin = token ? getAdminSession(token) : null;
  if (!admin) {
    // Clear a stale cookie so the browser stops resending a dead token.
    res.clearCookie(ADMIN_SESSION_COOKIE, adminCookieOptions());
    res.status(401).json({
      ok: false,
      code: 'UNAUTHORIZED',
      message: 'Admin email/password se login karein.',
    });
    return null;
  }
  return admin;
}

/**
 * Cookie options shared by set/clear. `sameSite: 'strict'` blocks CSRF from
 * cross-site pages; `secure` is on in production (Render/Firebase are HTTPS)
 * and relaxed on localhost so `npm run dev` works over http.
 */
function adminCookieOptions() {
  const isProduction = (process.env.NODE_ENV || 'production') === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
  };
}

const failedAdminLogins = new Map();
const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_LOGIN_MAX_FAILURES = 5;

app.post('/admin/login', (req, res, next) => {
  try {
    if (!isAdminAuthConfigured()) {
      res.status(503).json({
        ok: false,
        code: 'ADMIN_AUTH_NOT_CONFIGURED',
        message: 'ADMIN_SESSION_SECRET must be at least 32 characters on the server.',
      });
      return;
    }

    const clientKey = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const attempt = failedAdminLogins.get(clientKey);
    if (attempt && now - attempt.startedAt > ADMIN_LOGIN_WINDOW_MS) {
      failedAdminLogins.delete(clientKey);
    }
    const activeAttempt = failedAdminLogins.get(clientKey);
    if (activeAttempt && activeAttempt.count >= ADMIN_LOGIN_MAX_FAILURES) {
      res.status(429).json({
        ok: false,
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many failed admin login attempts. Try again in 15 minutes.',
      });
      return;
    }
    if (failedAdminLogins.size > 1000) {
      for (const [key, value] of failedAdminLogins) {
        if (now - value.startedAt > ADMIN_LOGIN_WINDOW_MS) failedAdminLogins.delete(key);
      }
    }

    const email = req.body?.email;
    const password = req.body?.password;
    if (typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({
        ok: false,
        code: 'BAD_REQUEST',
        message: 'Email aur password required hain.',
      });
      return;
    }
    const session = loginAdmin(email, password);
    if (!session) {
      const failed = failedAdminLogins.get(clientKey);
      failedAdminLogins.set(clientKey, {
        startedAt: failed?.startedAt ?? now,
        count: (failed?.count ?? 0) + 1,
      });
      res.status(401).json({
        ok: false,
        code: 'UNAUTHORIZED',
        message: 'Email ya password galat hai.',
      });
      return;
    }
    failedAdminLogins.delete(clientKey);
    // Set the session as an HttpOnly cookie. The token is still returned in the
    // body for non-browser/legacy clients, but the browser panel ignores it and
    // relies solely on the cookie so JavaScript can never read the session.
    res.cookie(ADMIN_SESSION_COOKIE, session.token, {
      ...adminCookieOptions(),
      maxAge: ADMIN_SESSION_TTL_MS,
    });
    res.json({ ok: true, ...session });
  } catch (error) {
    next(error);
  }
});

app.post('/admin/logout', (req, res) => {
  res.clearCookie(ADMIN_SESSION_COOKIE, adminCookieOptions());
  res.json({ ok: true });
});

app.get('/admin/session', async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ ok: true, admin: { email: admin.email || null, role: 'admin' } });
  } catch (error) {
    next(error);
  }
});

app.get('/admin/workers', async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const result = await listAdminWorkers(
      req.query.status || 'pending',
      req.query.page,
      req.query.limit,
    );
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

app.get('/admin/workers/:id', async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const worker = await getAdminWorker(req.params.id);
    if (!worker) {
      res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'Worker profile nahi mila.' });
      return;
    }
    res.json({ ok: true, worker });
  } catch (error) {
    next(error);
  }
});

app.patch('/admin/workers/:id', async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const hasApproval = typeof req.body?.approved === 'boolean';
    const hasFlagged = typeof req.body?.isFlagged === 'boolean';
    if (!hasApproval && !hasFlagged) {
      res.status(400).json({
        ok: false,
        code: 'BAD_REQUEST',
        message: 'approved ya isFlagged boolean chahiye',
      });
      return;
    }
    let worker = null;
    // Flag toggle first so the approval response (when both are sent) carries
    // the approval result — the modal refreshes from it.
    if (hasFlagged) worker = await setWorkerFlagged(req.params.id, req.body.isFlagged);
    if (hasApproval) {
      if (req.body?.adminNotes !== undefined && typeof req.body.adminNotes !== 'string') {
        res.status(400).json({ ok: false, code: 'BAD_REQUEST', message: 'adminNotes string chahiye' });
        return;
      }
      worker = await setWorkerApproval(req.params.id, req.body.approved, req.body.adminNotes);
    }
    res.json({ ok: true, worker });
  } catch (error) {
    next(error);
  }
});

app.get('/admin/stats', async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.json({ ok: true, stats: await getAdminStats() });
  } catch (error) {
    next(error);
  }
});

app.get('/admin/users', async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const result = await listAdminUsers(
      req.query.role,
      req.query.search,
      req.query.page,
      req.query.limit,
    );
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

app.patch('/admin/users/:id', async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const hasActive = typeof req.body?.isActive === 'boolean';
    const hasFlagged = typeof req.body?.isFlagged === 'boolean';
    // Trust & Penalty: block/suspend (isActive) aur flag (isFlagged) — dono
    // admin ke manual decisions, dono PATCH ke through.
    if (!hasActive && !hasFlagged) {
      res
        .status(400)
        .json({ ok: false, code: 'BAD_REQUEST', message: 'isActive ya isFlagged boolean chahiye' });
      return;
    }
    let user;
    if (hasActive) user = await setUserActive(req.params.id, req.body.isActive);
    if (hasFlagged) user = await setUserFlagged(req.params.id, req.body.isFlagged);
    res.json({ ok: true, user });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// User reports — admin review queue for POST /reports submissions.
// ---------------------------------------------------------------------------
app.get('/admin/reports', async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const result = await listAdminReports(req.query.status, req.query.page, req.query.limit);
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

app.patch('/admin/reports/:id', async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const report = await setReportStatus(req.params.id, req.body?.status);
    res.json({ ok: true, report });
  } catch (error) {
    next(error);
  }
});

app.get('/admin/hires', async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const result = await listAdminHires(req.query.status, req.query.page, req.query.limit);
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

// Admins can monitor hires but must never change their status: only the
// assigned worker may accept/reject (PATCH /hires/:id with a user session) and
// only the employer may complete/cancel. Keep an explicit 403 here so stale
// clients get a clear answer instead of silently mutating data.
app.patch('/admin/hires/:id', async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    res.status(403).json({
      ok: false,
      code: 'FORBIDDEN',
      message:
        'Admin hire status nahi badal sakta. Worker accept/reject karta hai aur employer complete/cancel.',
    });
  } catch (error) {
    next(error);
  }
});

// SuperTokens turns its own errors (e.g. missing session) into proper responses.
app.use(errorHandler());

// Fallback error handler.
//  - SuperTokens' own /auth/* routes expect `{ status: "GENERAL_ERROR", message }`
//    (HTTP 200) — that is what makes the browser SDK surface `message` to the
//    user, e.g. "FAST2SMS_API_KEY is not set", instead of a generic failure.
//  - Our own routes keep the `{ ok, code, message }` shape.
app.use((error, req, res, _next) => {
  const message = error instanceof Error ? error.message : 'Unexpected error';
  console.error('auth-server error:', message);
  // Report the error to Sentry with request context (route + method only —
  // no bodies or auth headers, so no PII leaks).
  Sentry.withScope((scope) => {
    scope.setTag('route', req.path);
    scope.setTag('method', req.method);
    Sentry.captureException(error);
  });
  if (res.headersSent) return;

  if (req.path.startsWith(API_BASE_PATH)) {
    res.status(200).json({ status: 'GENERAL_ERROR', message });
    return;
  }
  // Errors that carry their own HTTP status (e.g. the start-OTP rate limiter
  // answers 429) keep the { ok, code, message } shape with the real status.
  if (error && typeof error.status === 'number' && error.status >= 400 && error.status < 600) {
    res.status(error.status).json({
      ok: false,
      code: typeof error.code === 'string' ? error.code : 'ERROR',
      message,
    });
    return;
  }
  res.status(400).json({ ok: false, code: 'BAD_REQUEST', message });
});

// Route logger — print all registered routes on server start (debug only).
console.log("=== REGISTERED ROUTES ===");
app._router.stack.forEach(function(r){
  if (r.route && r.route.path){
    console.log(Object.keys(r.route.methods).join(', ').toUpperCase(), r.route.path);
  } else if (r.name === 'router') {
    console.log('Router mounted:', r.regexp);
  }
});
console.log("========================");

app.listen(PORT, () => {
  console.log(`\n✓ SahiKaarigar auth-server on ${API_DOMAIN}`);
  console.log(`  SMS provider : ${resolveSmsProvider()}`);
  console.log(`  Core         : ${process.env.SUPERTOKENS_CONNECTION_URI}`);
  console.log(`  CORS origin  : ${WEBSITE_DOMAIN}\n`);
});
