// =============================================================================
// SahiKaarigar auth-server — SuperTokens (passwordless phone OTP) + Express
// =============================================================================
//   npm install && cp .env.example .env && npm start        (configure a real SMS provider)
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

// -----------------------------------------------------------------------------
// Suspension enforcement — users.is_active is checked on every authenticated
// request. A suspended user (is_active = false) gets 403 { error: "Account
// suspended" } and their existing SuperTokens sessions are revoked by the admin
// suspension endpoint (see admin.js setUserActive).
// -----------------------------------------------------------------------------
async function requireActiveUser(req, res) {
  const session = await Session.getSession(req, res, { sessionRequired: true });
  const { authUserId, phone } = await resolveSession(session);
  const user = await getOrCreateUserByAuthId(authUserId, phone);
  if (!user.is_active) {
    res.status(403).json({ error: 'Account suspended' });
    return null;
  }
  return { session, authUserId, phone, user };
}

import { sendOtpSms, resolveSmsProvider, SUPPORTED_SMS_PROVIDERS } from './sms.js';
import {
  db,
  getOrCreateUserByAuthId,
  upsertWorkerProfile,
  uploadWorkerImages,
  updateUser,
  savePushToken,
  deleteUserAccount,
  encryptLegacyAadhaarNumbers,
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
  createCustomerReview,
  createPlatformFeedback,
  listReviewsByWorker,
  getReviewByHireRequest,
  getCustomerReviewByHireRequest,
} from './reviews.js';
import { createReport } from './reports.js';
import { sendEmail } from './email.js';
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
  forceCloseHire,
  sendBroadcastNotification,
  countBroadcastRecipients,
  normalizeBroadcastAudience,
} from './admin.js';
import {
  isValidPushToken,
  notifyHireUpdate,
  sendProfileCompletionReminders,
  sendProfileReminderToWorker,
} from './push.js';

const PORT = Number(process.env.PORT || 4000);
// Render exposes a web service's public URL as RENDER_EXTERNAL_URL, so the
// deployment works without hand-setting API_DOMAIN.
const API_DOMAIN =
  process.env.API_DOMAIN || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
const WEBSITE_DOMAIN = (process.env.WEBSITE_DOMAIN || 'http://localhost:3000').replace(/\/+$/, '');
const API_BASE_PATH = process.env.API_BASE_PATH || '/auth';
const APP_NAME = process.env.APP_NAME || 'SahiKaarigar';

// -----------------------------------------------------------------------------
// Play Store review logins — reusable OTP sign-in for Google's reviewers.
// Login is phone + random SMS OTP; Google's reviewers cannot receive Indian
// SMS, and Play requires reusable sign-in details for OTP apps in the App
// Access form. REVIEW_LOGIN_PHONES (comma-separated Indian numbers) always
// sign in with the fixed REVIEW_LOGIN_OTP — the code is forced at creation
// time and no SMS is ever sent for these numbers. With both envs unset the
// behaviour for real users is unchanged.
// -----------------------------------------------------------------------------
const REVIEW_LOGIN_OTP = process.env.REVIEW_LOGIN_OTP || '';
const REVIEW_LOGIN_PHONES = (process.env.REVIEW_LOGIN_PHONES || '')
  .split(',')
  .map((raw) => normalizeIndianPhone(raw.trim()))
  .filter(Boolean);
const isReviewLoginPhone = (phone) =>
  Boolean(REVIEW_LOGIN_OTP && phone && REVIEW_LOGIN_PHONES.includes(phone));

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

            // Play review accounts sign in with the fixed REVIEW_LOGIN_OTP —
            // never spend SMS balance (or text a real code) on them.
            if (isReviewLoginPhone(phone)) {
              console.log(`[review-login] SMS skipped for review phone ${phone}`);
              return;
            }

            await sendOtpSms({ phone, otp });
          },
        }),
      },
      // Force the fixed review OTP at code-creation time. SuperTokens verifies
      // the code the user enters against the one it STORED — so the fixed
      // value must be the stored code, not merely the delivered one.
      override: {
        functions: (originalImplementation) => ({
          ...originalImplementation,
          createNewCodeForPhoneNumber: async (input) => {
            const phone = normalizeIndianPhone(input?.phoneNumber ?? '');
            if (isReviewLoginPhone(phone)) {
              return originalImplementation.createNewCodeForPhoneNumber({
                ...input,
                userInputCode: REVIEW_LOGIN_OTP,
              });
            }
            return originalImplementation.createNewCodeForPhoneNumber(input);
          },
        }),
      },
    }),
    Session.init(),
  ],
});

const app = express();

// Render terminates TLS behind one reverse proxy; without this, every client
// shares the proxy's IP. Consequences: admin-login lockout collapses into one
// global bucket (5 wrong passwords lock ALL admins out), and rate limits keyed
// on req.ip group unrelated users. `1` = trust exactly one hop (Render's
// proxy) — req.ip then reflects the real client address from X-Forwarded-For.
app.set('trust proxy', 1);

// Order matters: SuperTokens' middleware must see its own routes BEFORE the
// JSON body parser consumes the request body.
// CORS: allow the configured website domain(s), localhost dev origins (Expo web
// runs on :8081 / :19006) and native apps, which send no Origin header at all.
const EXTRA_ORIGINS = (process.env.EXTRA_CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);
// Origins of the deployed ADMIN PANEL. The panel is hosted separately from
// this API (e.g. on Vercel) so its origin must be listed explicitly —
// otherwise the browser blocks every /admin/* response and the panel shows
// the opaque "Failed to fetch" error.
const ADMIN_PANEL_ORIGINS = (process.env.ADMIN_PANEL_ORIGINS || '')
  .split(',')
  .map((o) => o.trim().replace(/\/+$/, ''))
  .filter(Boolean);
// The Firebase-hosted admin panel. Always allowed, even if WEBSITE_DOMAIN is
// missing from the environment, so the admin API never fails CORS in prod.
const PRODUCTION_ORIGIN = 'https://sahi-kaarigar.web.app';
// The Vercel-hosted ADMIN PANEL — the primary production deployment of the
// panel (https://sahikaarigar.vercel.app). It must always be in the allow-list,
// otherwise the browser blocks every /admin/* request from this origin with a
// CORS error ("No 'Access-Control-Allow-Origin' header is present") and the
// admin panel can neither load nor auto-refresh.
const VERCEL_ADMIN_ORIGIN = 'https://sahikaarigar.vercel.app';
const ALLOWED_ORIGINS = [
  ...new Set([
    PRODUCTION_ORIGIN,
    VERCEL_ADMIN_ORIGIN,
    WEBSITE_DOMAIN,
    ...ADMIN_PANEL_ORIGINS,
    ...EXTRA_ORIGINS,
  ]),
];
const LOCALHOST_RE = /^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?$/;

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true); // native app / curl
      if (ALLOWED_ORIGINS.includes(origin) || LOCALHOST_RE.test(origin)) {
        return callback(null, true);
      }
      // Log it: a rejected origin is invisible in the browser (it only shows
      // up as "Failed to fetch"), so the server log is the only place where
      // it can be diagnosed.
      console.warn(
        `[cors] rejected origin "${origin}". Allowed: ${ALLOWED_ORIGINS.join(', ') || '(none)'}. ` +
          'Add it to ADMIN_PANEL_ORIGINS on the server.',
      );
      return callback(null, false);
    },
    // `authorization` is required for the admin panel's Bearer token. Without
    // it the browser's preflight blocks every /admin/* request.
    allowedHeaders: ['content-type', 'authorization', ...supertokens.getAllCORSHeaders()],
    credentials: true,
  }),
);

// ---------------------------------------------------------------------------
// Rate limiting for login OTP.
//
// Three separate budgets:
//   * code creation/resend — 3 per minute per IP + phone (in-memory; real-time
//     SMS bombing)
//   * code verification  — 5 per 5 minutes per preAuthSessionId + deviceId
//                          (in-memory brute-force protection; rotating IP/phone
//                          does not reset the attempt budget for a challenge)
//   * persistent SMS spend budget — `rate_limits` table, survives redeploys:
//       - 8 codes/day per phone (a real user rarely needs more than 2-3)
//       - 200 codes/hour GLOBAL — a script rotating phone numbers hits this
//         ceiling instead of billing unlimited SMS (~₹0.25 each)
//     Review-login phones are exempt (no SMS is ever sent for them). DB
//     failures fail OPEN — a rate_limits outage must not lock every user out;
//     the in-memory 3/min limiter still applies.
// ---------------------------------------------------------------------------
const LOGIN_OTP_MAX_ATTEMPTS = 3;
const LOGIN_OTP_WINDOW_MS = 60_000;
const loginOtpAttempts = new Map();

const LOGIN_OTP_CONSUME_MAX_ATTEMPTS = 5;
const LOGIN_OTP_CONSUME_WINDOW_MS = 5 * 60_000;
const loginOtpConsumeAttempts = new Map();

const SMS_DAILY_PER_PHONE_MAX = 8;
const SMS_DAILY_WINDOW_MS = 24 * 60 * 60_000;
const SMS_GLOBAL_HOURLY_MAX = 200;
const SMS_GLOBAL_WINDOW_MS = 60 * 60_000;

/** Count `rate_limits` rows for a key within a sliding window. Throws on DB
 *  errors so callers can fail open. */
async function countRateLimitRows(key, windowMs) {
  const cutoff = new Date(Date.now() - windowMs).toISOString();
  const { data, error } = await db
    .from('rate_limits')
    .select('id')
    .eq('key', key)
    .gte('created_at', cutoff);
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

/** Add one `rate_limits` row under the given key. */
async function recordRateLimitRow(key) {
  const { error } = await db.from('rate_limits').insert({ key });
  if (error) throw new Error(error.message);
}

/** Add one attempt to a sliding-window bucket; false when the limit is hit. */
const RATE_LIMIT_STORE_MAX_KEYS = 1000;
/** Longest window any of the in-memory limiters uses (delete-request = 1 h).
 *  Entries older than this are expired for EVERY map, so a sweep trimmed at
 *  this horizon can never reset an active brute-force/abuse counter. */
const RATE_LIMIT_MAX_WINDOW_MS = 60 * 60_000;

function takeRateLimitSlot(store, key, maxAttempts, windowMs) {
  const now = Date.now();
  const recent = (store.get(key) ?? []).filter((t) => now - t < windowMs);

  if (recent.length >= maxAttempts) {
    store.set(key, recent);
    return false;
  }

  recent.push(now);
  store.set(key, recent);

  // Memory guard (512 MB free tier): keys are client-controlled strings
  // (IP:phone, preAuthSessionId), so an attacker can grow the Map forever.
  // Past the cap, drop every key whose newest timestamp is older than the
  // LONGEST window — O(n), rare, and never resets an active bucket.
  if (store.size > RATE_LIMIT_STORE_MAX_KEYS) {
    for (const [expiredKey, timestamps] of store) {
      const newest = timestamps[timestamps.length - 1];
      if (!Number.isFinite(newest) || now - newest > RATE_LIMIT_MAX_WINDOW_MS) {
        store.delete(expiredKey);
      }
    }
  }
  return true;
}

// Exact POST routes only. `app.post` does not match `/consume` or any other
// sub-path, so the old prefix-mounted limiter no longer covers verification.
// `/resend` is included because it also sends an SMS and would otherwise allow
// SMS bombing after the prefix limiter is removed.
app.post(
  ['/auth/signinup/code', '/auth/signinup/code/resend'],
  express.json({ limit: '2mb' }),
  async (req, res, next) => {
    const rawPhone = String(req.body?.phoneNumber || '');
    const phone = normalizeIndianPhone(rawPhone);
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `login_otp:${ip}:${rawPhone.slice(0, 20)}`;

    if (
      !takeRateLimitSlot(loginOtpAttempts, key, LOGIN_OTP_MAX_ATTEMPTS, LOGIN_OTP_WINDOW_MS)
    ) {
      return res.status(429).json({
        status: 'GENERAL_ERROR',
        message: 'Bahut zyada OTP requests. Kripya 1 minute baad try karein.',
      });
    }

    // Persistent spend budget — only for well-formed numbers (an invalid one is
    // rejected by SuperTokens without any SMS, so it must not consume budget).
    if (isValidIndianPhone(phone) && !isReviewLoginPhone(phone)) {
      try {
        const [perPhone, global] = await Promise.all([
          countRateLimitRows(`login_sms_daily:${phone}`, SMS_DAILY_WINDOW_MS),
          countRateLimitRows('login_sms_global', SMS_GLOBAL_WINDOW_MS),
        ]);
        if (perPhone >= SMS_DAILY_PER_PHONE_MAX) {
          console.warn(`[sms-budget] per-phone cap hit: ${phone} (${perPhone}/day)`);
          return res.status(429).json({
            status: 'GENERAL_ERROR',
            message:
              'Aaj is number ke liye bahut zyada OTP maang liye. Kal try karein.',
          });
        }
        if (global >= SMS_GLOBAL_HOURLY_MAX) {
          console.error(
            `[sms-budget] GLOBAL hourly cap hit: ${global} codes in the last hour` +
              ' — possible SMS-abuse attack, check request logs.',
          );
          return res.status(429).json({
            status: 'GENERAL_ERROR',
            message: 'Server SMS limit hit ho gayi. Thodi der baad try karein.',
          });
        }
        await Promise.all([
          recordRateLimitRow(`login_sms_daily:${phone}`),
          recordRateLimitRow('login_sms_global'),
        ]);
      } catch (budgetError) {
        // Fail open: never let a rate_limits outage block all logins.
        console.error('[sms-budget] check failed (fail-open):', budgetError.message);
      }
    }

    return next();
  },
);

// Verification is keyed by the challenge, not by the caller-controlled phone
// number. That closes the bypass where a new phone/IP reset the old counter.
app.post(
  '/auth/signinup/code/consume',
  express.json({ limit: '2mb' }),
  (req, res, next) => {
    const preAuthSessionId = String(req.body?.preAuthSessionId || '').trim().slice(0, 200);
    const deviceId = String(req.body?.deviceId || '').trim().slice(0, 200);
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key =
      preAuthSessionId && deviceId
        ? `login_consume:${preAuthSessionId}:${deviceId}`
        : `login_consume:ip:${ip}`;

    if (
      !takeRateLimitSlot(
        loginOtpConsumeAttempts,
        key,
        LOGIN_OTP_CONSUME_MAX_ATTEMPTS,
        LOGIN_OTP_CONSUME_WINDOW_MS,
      )
    ) {
      return res.status(429).json({
        status: 'GENERAL_ERROR',
        message: 'Bahut zyada galat OTP attempts. Kripya naya code maangein.',
      });
    }

    return next();
  },
);

app.use(middleware());

// Body limits: 2 MB is enough for every normal JSON request. The three
// image-carrying routes register a 15 MB parser BEFORE the global one —
// express.json skips already-parsed bodies, so only those routes accept
// photo payloads (register-worker: Aadhaar + portfolio, profile: avatar,
// worker/profile: portfolio edits). Everything else 413s above 2 MB, which
// stops a single request from hogging the 512 MB free-tier worker.
app.post('/register-worker', express.json({ limit: '15mb' }), (_req, _res, next) => next());
app.post('/profile', express.json({ limit: '15mb' }), (_req, _res, next) => next());
app.patch('/worker/profile', express.json({ limit: '15mb' }), (_req, _res, next) => next());
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    // Render injects RENDER_GIT_COMMIT — lets you confirm WHICH commit is live.
    build: (process.env.RENDER_GIT_COMMIT || '').slice(0, 7) || 'dev',
    smsProvider: resolveSmsProvider(),
    supportedSmsProviders: SUPPORTED_SMS_PROVIDERS,
  });
});

// ---------------------------------------------------------------------------
// Account deletion WEB requests (Play policy).
//
// The mobile app deletes the account instantly (Profile -> Delete Account ->
// deleteUserAccount in users.js). This public endpoint is for users who cannot
// open the app — Google Play requires a web destination where deletion can be
// requested, and the delete-account page on the Vercel site posts here.
//
// Deletion is completed manually from the emailed request. Two deliberate
// properties:
//   * The response is ALWAYS the same for a well-formed number, so the endpoint
//     cannot be used to probe which phone numbers are registered.
//   * Rate limited per IP+phone so the admin inbox cannot be flooded.
// ---------------------------------------------------------------------------
const DELETE_REQUEST_MAX_ATTEMPTS = 5;
const DELETE_REQUEST_WINDOW_MS = 60 * 60_000;
const deleteRequestAttempts = new Map();

app.post('/account/delete-request', async (req, res) => {
  const phone = normalizeIndianPhone(String(req.body?.phone ?? ''));
  const reason = String(req.body?.reason ?? '').trim().slice(0, 500);
  // `trust proxy` is set, so req.ip is already the real client address.
  // (The old code manually trusted the first XFF hop — client-supplied, so the
  // 5/hour cap was bypassable by rotating fake XFF values.)
  const ip = req.ip || req.socket.remoteAddress || 'unknown';

  if (!isValidIndianPhone(phone)) {
    res.status(400).json({
      ok: false,
      error: 'Sahi 10-digit Indian mobile number daalo (6, 7, 8 ya 9 se shuru).',
    });
    return;
  }

  if (
    !takeRateLimitSlot(
      deleteRequestAttempts,
      `${ip}:${phone}`,
      DELETE_REQUEST_MAX_ATTEMPTS,
      DELETE_REQUEST_WINDOW_MS,
    )
  ) {
    res.status(429).json({
      ok: false,
      error: 'Bahut zyada requests. Thodi der baad try karein.',
    });
    return;
  }

  console.log(`[delete-request] ${phone} ip=${ip} reason=${reason ? 'yes' : 'no'}`);

  // PERSIST FIRST — before the 200. The email alone is not a durable record:
  // sendEmail swallows failures and ADMIN_EMAIL can be unset, in which case the
  // request used to vanish while the user was told "7 days". A DB failure here
  // must not break the user flow, but it is logged loudly (and to Sentry) so
  // the admin notices instead of silently losing the request.
  let requestId = null;
  try {
    const { data, error } = await db
      .from('delete_requests')
      .insert({ phone, reason: reason || null })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    requestId = data?.id ?? null;
  } catch (persistError) {
    console.error(
      `[delete-request] DB PERSIST FAILED for ${phone}: ${persistError.message}` +
        ' — Supabase me 0028_delete_requests.sql migration chalao. Email ke bina ye request sirf log me hai.',
    );
    Sentry.withScope((scope) => {
      scope.setTag('route', '/account/delete-request');
      scope.setLevel('error');
      Sentry.captureException(persistError);
    });
  }

  const sendAdminEmail = async () => {
    const result = await sendEmail({
      subject: `Account deletion request - ${phone}`,
      text:
        `Phone: ${phone}\n` +
        `Received: ${new Date().toISOString()}\n` +
        `Request IP: ${ip}\n` +
        `Reason: ${reason || '(not provided)'}\n` +
        (requestId ? `Request ID: ${requestId}\n` : '') +
        '\n' +
        'Delete this account: the app runs deleteUserAccount() in src/users.js\n' +
        'from Profile -> Delete Account. Log in as this number and run it, or\n' +
        'remove the users row + attached data manually and revoke the\n' +
        'SuperTokens identity. Then mark the delete_requests row processed.\n',
    });
    if (!result.ok) {
      console.error(
        `[delete-request] EMAIL FAILED for ${phone}: ${result.error}` +
          ' — request DB me saved hai (0028), admin ko manually dekhna hoga.',
      );
      if (requestId) {
        const { error: updateError } = await db
          .from('delete_requests')
          .update({ email_sent: false, email_error: result.error })
          .eq('id', requestId);
        if (updateError) console.error(`[delete-request] email-status update failed: ${updateError.message}`);
      }
      return;
    }
    if (requestId) {
      const { error: updateError } = await db
        .from('delete_requests')
        .update({ email_sent: true, email_error: null })
        .eq('id', requestId);
      if (updateError) console.error(`[delete-request] email-status update failed: ${updateError.message}`);
    }
  };

  // Fire-and-forget: the persisted row already makes this request durable, so
  // email delivery must not delay the response.
  void sendAdminEmail();

  res.json({
    ok: true,
    message:
      'Request mil gayi. Aapka account aur data 7 din ke andar delete kar diye jayenge.',
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
    const active = await requireActiveUser(req, res);
    if (!active) return;
    res.json({ ok: true, user: active.user });
  } catch (error) {
    next(error);
  }
});

// The mobile app calls this after login so hire status changes can reach the
// user's device through the free Expo Push API (see src/push.js). Sending an
// empty token clears the row (e.g. after the user denies notifications).
app.post('/me/push-token', async (req, res, next) => {
  try {
    const active = await requireActiveUser(req, res);
    if (!active) return;
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    if (token && !isValidPushToken(token)) {
      res.status(400).json({ ok: false, code: 'BAD_REQUEST', message: 'Invalid push token' });
      return;
    }
    await savePushToken(active.user.id, token || null);
    res.json({ ok: true, saved: Boolean(token) });
  } catch (error) {
    next(error);
  }
});

app.post('/register-worker', async (req, res, next) => {
  try {
    const active = await requireActiveUser(req, res);
    if (!active) return;
    const user = await getOrCreateUserByAuthId(active.authUserId, active.phone, req.body?.name);
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
    const active = await requireActiveUser(req, res);
    if (!active) return;
    const updated = await updateUser(active.user.id, req.body ?? {});
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
    const active = await requireActiveUser(req, res);
    if (!active) return;
    await deleteUserAccount({ userId: active.user.id, authUserId: active.authUserId });
    try {
      await Session.revokeAllSessionsForUser(active.authUserId);
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
      lat: req.query.lat,
      lng: req.query.lng,
      radius: req.query.radius,
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
    const active = await requireActiveUser(req, res);
    if (!active) return;
    const hires = await listHiresForUser(active.user.id);
    res.json({ ok: true, ...hires });
  } catch (error) {
    next(error);
  }
});

app.post('/hires', async (req, res, next) => {
  try {
    const active = await requireActiveUser(req, res);
    if (!active) return;
    const hire = await createHireRequest({
      employerId: active.user.id,
      workerId: req.body?.workerId,
      description: req.body?.description,
      location: req.body?.location,
      homeLocation: req.body?.homeLocation,
      proposedRate: req.body?.proposedRate,
      scheduledDate: req.body?.scheduledDate,
    });
    // createHireRequest() already fires the worker push (fire-and-forget).
    res.json({ ok: true, hire });
  } catch (error) {
    next(error);
  }
});

app.get('/hires/:id', async (req, res, next) => {
  try {
    const active = await requireActiveUser(req, res);
    if (!active) return;
    const hire = await getHireById(req.params.id);
    if (!hire) {
      res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'Hire request nahi mila' });
      return;
    }
    // IDOR guard - a booking carries both parties' phone numbers and home
    // location, so ONLY its two sides may read it. Any other signed-in user
    // (or a leaked/guessed id) gets a 403 instead of the payload.
    const workerProfileId = await getWorkerProfileIdForUser(active.user.id);
    const isEmployer = hire.employerId === active.user.id;
    const isWorker = Boolean(workerProfileId) && hire.workerId === workerProfileId;
    if (!isEmployer && !isWorker) {
      res.status(403).json({ ok: false, code: 'FORBIDDEN', message: 'Ye booking aapki nahi hai' });
      return;
    }
    const [review, customerReview] = await Promise.all([
      getReviewByHireRequest(req.params.id),
      getCustomerReviewByHireRequest(req.params.id),
    ]);
    res.json({ ok: true, hire, review, customerReview });
  } catch (error) {
    next(error);
  }
});

// The "start work" OTP — EMPLOYER only, so the customer's screen can show the
// code the kaarigar must type to begin the job (privacy: the worker's own
// session can never read it).
app.get('/hires/:id/start-otp', async (req, res, next) => {
  try {
    const active = await requireActiveUser(req, res);
    if (!active) return;
    const { otp } = await getHireStartOtp({ hireId: req.params.id, userId: active.user.id });
    res.json({ ok: true, otp });
  } catch (error) {
    console.warn(
      '[hires] start-otp failed for hire %s: %s',
      req.params.id,
      error instanceof Error ? error.message : String(error),
    );
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
    const active = await requireActiveUser(req, res);
    if (!active) return;
    const hire = await hireAction({
      hireId: req.params.id,
      userId: active.user.id,
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
// Worker dashboard - the kaarigar's own side of the app. Session required.
//   GET   /worker/dashboard     profile + availability + job buckets + stats
//   PATCH /worker/availability  { availability: 'available' | 'busy' | 'offline' }
// ---------------------------------------------------------------------------
app.get('/worker/dashboard', async (req, res, next) => {
  try {
    const active = await requireActiveUser(req, res);
    if (!active) return;
    const dashboard = await getWorkerDashboard(active.user.id);

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
    const active = await requireActiveUser(req, res);
    if (!active) return;
    const worker = await getOwnWorkerProfile(active.user.id);
    res.json({ ok: true, worker });
  } catch (error) {
    next(error);
  }
});

app.patch('/worker/profile', async (req, res, next) => {
  try {
    const active = await requireActiveUser(req, res);
    if (!active) return;
    const worker = await updateOwnWorkerProfile(active.user.id, req.body ?? {});
    res.json({ ok: true, worker });
  } catch (error) {
    next(error);
  }
});

app.patch('/worker/availability', async (req, res, next) => {
  try {
    const active = await requireActiveUser(req, res);
    if (!active) return;
    const worker = await setWorkerAvailability(active.user.id, req.body?.availability);
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
    const active = await requireActiveUser(req, res);
    if (!active) return;
    const review = await createReview({
      reviewerId: active.user.id,
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

// Worker -> customer feedback. Separate from /reviews (customer -> worker).
app.post('/customer-reviews', async (req, res, next) => {
  try {
    const active = await requireActiveUser(req, res);
    if (!active) return;
    const customerReview = await createCustomerReview({
      reviewerId: active.user.id,
      hireRequestId: req.body?.hireRequestId,
      rating: req.body?.rating,
      comment: req.body?.comment,
    });
    res.json({ ok: true, customerReview });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// Reports — lets any logged-in user report another user (Group 3).
// ---------------------------------------------------------------------------
app.post('/reports', async (req, res, next) => {
  try {
    const active = await requireActiveUser(req, res);
    if (!active) return;
    const report = await createReport({
      reporter_id: active.user.id,
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
    const active = await requireActiveUser(req, res);
    if (!active) return;
    const feedback = await createPlatformFeedback({
      userId: active.user.id,
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
 * Cookie options shared by set/clear.
 *
 * `sameSite`:
 *   - The admin panel is deployed on a DIFFERENT site than this API (e.g.
 *     Vercel -> Render). A `SameSite=Strict` cookie is NOT sent on such a
 *     cross-site request, so the browser would never attach the session and
 *     every /admin/* call would 401. `SameSite=None` is therefore required
 *     for the split deployment and must be paired with `Secure` (browsers
 *     reject `SameSite=None` without it).
 *   - On plain http://localhost (local dev) a Secure cookie is dropped by the
 *     browser, so we fall back to `Lax` there.
 *   - Override with ADMIN_COOKIE_SAMESITE=strict|lax|none when the panel and
 *     the API really are served from the same site.
 *
 * CSRF: the admin API always answers with `Content-Type: application/json`
 * and the browser only sends it after a successful CORS preflight, so a
 * third-party site cannot drive it — the origin allow-list is the real
 * defence.
 */
function adminCookieOptions() {
  const isProduction = (process.env.NODE_ENV || 'production') === 'production';
  const configured = String(process.env.ADMIN_COOKIE_SAMESITE || '').trim().toLowerCase();
  let sameSite = ['strict', 'lax', 'none'].includes(configured) ? configured : 'none';
  if (!isProduction && sameSite === 'none') sameSite = 'lax';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite,
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

// ---------------------------------------------------------------------------
// Maintenance sweep — cron-friendly endpoint (Render free tier has no
// scheduler). Point an external cron (cron-job.org, GitHub Action, ...) at
// POST /admin/maintenance/sweep with the `x-cron-secret` header, and set
// CRON_SECRET on Render. Without the secret it answers 403 and reveals
// nothing. Every step is idempotent — safe to call as often as you like:
//   1. pending hire_requests older than 48 h -> 'rejected' + employer push.
//      A stale pending otherwise blocks new bookings for that employer-worker
//      pair FOREVER (0027's one-live-request index counts pending as live).
//   2. rate_limits rows older than 7 days -> deleted. start-OTP needs 1 min
//      and the SMS budget 24 h; 7 days keeps a small forensic tail.
// Accepted-but-never-started hires are deliberately NOT auto-cancelled: the
// worker has an explicit cancel button and admin force-close exists, and a
// silently cancelled committed job would render confusing UI on both sides.
// ---------------------------------------------------------------------------
app.post('/admin/maintenance/sweep', async (req, res, next) => {
  try {
    const secret = String(req.headers['x-cron-secret'] || '');
    const expected = process.env.CRON_SECRET || '';
    if (!expected || secret !== expected) {
      res.status(403).json({ ok: false, code: 'FORBIDDEN', message: 'Not allowed' });
      return;
    }

    // 1) Expire stale pending requests (48 h).
    const cutoffHires = new Date(Date.now() - 48 * 60 * 60_000).toISOString();
    const { data: stalePending, error: staleError } = await db
      .from('hire_requests')
      .update({ status: 'rejected' })
      .eq('status', 'pending')
      .lt('created_at', cutoffHires)
      .select('id');
    if (staleError) throw new Error(staleError.message);

    // Employer push per expired request (a healthy sweep touches zero rows).
    let expiredCount = 0;
    for (const row of stalePending ?? []) {
      expiredCount += 1;
      const hire = await getHireById(row.id);
      await notifyHireUpdate(hire, 'reject');
    }

    // 2) Purge old rate_limits rows (7 days).
    const cutoffLimits = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
    const { data: purgedRows, error: purgeError } = await db
      .from('rate_limits')
      .delete()
      .lt('created_at', cutoffLimits)
      .select('id');
    if (purgeError) throw new Error(purgeError.message);

    const purgedCount = (purgedRows ?? []).length;
    console.log(
      `[sweep] expired pending hires: ${expiredCount}, purged rate_limits rows: ${purgedCount}`,
    );
    res.json({ ok: true, expiredPendingHires: expiredCount, purgedRateLimitRows: purgedCount });
  } catch (error) {
    next(error);
  }
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

// Targeted "Send profile reminder" for ONE worker (worker detail modal). Sends
// to just this worker's device when their profile is still incomplete and has
// a registered device; reports `skipped` otherwise.
app.post('/admin/workers/:id/send-reminder', async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const result = await sendProfileReminderToWorker(req.params.id);
    if (result.profile === null) {
      res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'Worker profile nahi mila.' });
      return;
    }
    res.json({ ok: true, ...result });
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
      worker = await setWorkerApproval(
        req.params.id,
        req.body.approved,
        req.body.adminNotes,
        admin.email,
      );
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

// Manually (or cron-) trigger "complete your profile" push reminders.
// Selects worker_profiles that are not approved yet OR have no Aadhaar number,
// and pushes to every one that has a registered device. Optional body:
//   { "limit": 500 }   max profiles scanned in this run (1–1000)
app.post('/admin/send-profile-reminders', async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const result = await sendProfileCompletionReminders({ limit: req.body?.limit });
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

// GET /admin/broadcast/preview?audience=all|workers|customers
// Live device count — the Notifications tab shows this in its confirm dialog.
app.get('/admin/broadcast/preview', async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const audience = normalizeBroadcastAudience(req.query.audience);
    if (!audience) {
      return res
        .status(400)
        .json({ ok: false, message: 'audience galat hai (all | workers | customers)' });
    }
    const result = await countBroadcastRecipients(audience);
    res.json({ ok: true, audience, count: result.count });
  } catch (error) {
    next(error);
  }
});

// POST /admin/broadcast  body: { title, body, audience, testPhone? }
// With testPhone set, ONLY that user's device receives the message (preview
// mode). Without it, the message goes to every device in the audience.
app.post('/admin/broadcast', async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const result = await sendBroadcastNotification({
      title: req.body?.title,
      body: req.body?.body,
      audience: req.body?.audience,
      testPhone: req.body?.testPhone,
      adminEmail: admin.email,
    });
    res.json({ ok: true, ...result });
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

// Admins can monitor hires but must never change their status via PATCH:
// only the assigned worker may accept/reject and only the employer may
// complete/cancel. The explicit 403 below keeps that rule for the PATCH verb.
// Force-close (stuck jobs) is a separate, auditable admin action below.
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

// Option C — admin force-close for stuck jobs. Auditable: records who closed
// it, when, why, and the final status/amount.
app.post('/admin/hires/:id/force-close', async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const result = await forceCloseHire(req.params.id, {
      reason: req.body?.reason,
      targetStatus: req.body?.target_status,
      closedByAdminEmail: admin.email,
    });
    res.json({ ok: true, ...result });
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
//  - INFRA-looking failures (PostgREST/connection/schema/provider text) are
//    NEVER echoed to clients: they leak table names and credentials hints and
//    would read as gibberish Hinglish anyway. The client gets a clean 500 and
//    the real message stays in the Render log + Sentry.
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

  const infraLike =
    /postgrest|duplicate column|relation .* does not exist|column .* does not exist|violates (unique|foreign key|check) constraint|econnrefused|enotfound|etimedout|fetch failed|supabaseurl|service_role|invalid api key|permission denied/i.test(
      message,
    );

  if (req.path.startsWith(API_BASE_PATH)) {
    res.status(200).json({
      status: 'GENERAL_ERROR',
      message: infraLike ? 'Server me dikkat hai. Thodi der baad try karein.' : message,
    });
    return;
  }
  // Errors that carry their own HTTP status (e.g. the start-OTP rate limiter
  // answers 429) keep the { ok, code, message } shape with the real status.
  if (error && typeof error.status === 'number' && error.status >= 400 && error.status < 600) {
    res.status(error.status).json({
      ok: false,
      code: typeof error.code === 'string' ? error.code : 'ERROR',
      message: infraLike ? 'Server me dikkat hai. Thodi der baad try karein.' : message,
    });
    return;
  }
  // Unclassified failures: infra-like ones are 500 (our fault), everything
  // else stays a 400 (caller's fault) — both with a client-safe message.
  if (infraLike) {
    res.status(500).json({
      ok: false,
      code: 'SERVER_ERROR',
      message: 'Server me dikkat hai. Thodi der baad try karein.',
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

  // Idempotent: encrypt any Aadhaar rows created before encryption was added.
  // Fire-and-forget so a slow database can never block the health check.
  void encryptLegacyAadhaarNumbers()
    .then(({ scanned, updated }) => {
      if (scanned > 0) console.log(`[aadhaar] legacy rows scanned=${scanned} encrypted=${updated}`);
    })
    .catch((error) => console.warn(`[aadhaar] legacy backfill failed: ${error.message}`));
});
