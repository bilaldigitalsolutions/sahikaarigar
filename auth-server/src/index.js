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
  updateUser,
  normalizeIndianPhone,
  isValidIndianPhone,
} from './users.js';
import { searchWorkers, getWorkerById } from './workers.js';
import { createHireRequest, listHiresForUser, getHireById, hireAction } from './hires.js';
import {
  createReview,
  createPlatformFeedback,
  listReviewsByWorker,
  getReviewByHireRequest,
} from './reviews.js';
import { isAdmin, listPendingWorkers, setWorkerApproval } from './admin.js';

const PORT = Number(process.env.PORT || 4000);
// Render exposes a web service's public URL as RENDER_EXTERNAL_URL, so the
// deployment works without hand-setting API_DOMAIN.
const API_DOMAIN =
  process.env.API_DOMAIN || process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
const WEBSITE_DOMAIN = (process.env.WEBSITE_DOMAIN || 'http://localhost:3000').replace(/\/+$/, '');
const API_BASE_PATH = process.env.API_BASE_PATH || '/auth';
const APP_NAME = process.env.APP_NAME || 'SahiKaarigar';

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

            await sendOtpSms({ phone, otp });
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
app.use(
  cors({
    origin: WEBSITE_DOMAIN,
    allowedHeaders: ['content-type', ...supertokens.getAllCORSHeaders()],
    credentials: true,
  }),
);
app.use(middleware());
app.use(express.json());

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

app.post('/register-worker', async (req, res, next) => {
  try {
    const session = await Session.getSession(req, res, { sessionRequired: true });
    const { authUserId, phone } = await resolveSession(session);
    const user = await getOrCreateUserByAuthId(authUserId, phone, req.body?.name);
    const workerProfile = await upsertWorkerProfile(user.id, req.body?.profile ?? {});
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
    res.json({ ok: true, hire });
  } catch (error) {
    next(error);
  }
});

app.get('/hires/:id', async (req, res, next) => {
  try {
    await Session.getSession(req, res, { sessionRequired: true });
    const hire = await getHireById(req.params.id);
    if (!hire) {
      res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'Hire request nahi mila' });
      return;
    }
    const review = await getReviewByHireRequest(req.params.id);
    res.json({ ok: true, hire, review });
  } catch (error) {
    next(error);
  }
});

// One route for every state change: accept | reject | en_route | arrived |
// complete | cancel. `hires.js` decides who is allowed to do what.
app.patch('/hires/:id', async (req, res, next) => {
  try {
    const session = await Session.getSession(req, res, { sessionRequired: true });
    const { authUserId, phone } = await resolveSession(session);
    const user = await getOrCreateUserByAuthId(authUserId, phone);
    const hire = await hireAction({
      hireId: req.params.id,
      userId: user.id,
      action: req.body?.action,
      lat: req.body?.lat,
      lng: req.body?.lng,
    });
    res.json({ ok: true, hire });
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
    });
    res.json({ ok: true, review });
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
// Admin — worker approval. New profiles start unapproved, so nothing appears in
// search until an admin approves it here.
// ---------------------------------------------------------------------------
async function requireAdmin(req, res) {
  const session = await Session.getSession(req, res, { sessionRequired: true });
  const { authUserId, phone } = await resolveSession(session);
  const user = await getOrCreateUserByAuthId(authUserId, phone);
  if (!isAdmin(user)) {
    res.status(403).json({ ok: false, code: 'FORBIDDEN', message: 'Aap admin nahi ho' });
    return null;
  }
  return user;
}

app.get('/admin/workers', async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const result = await listPendingWorkers(req.query.page, req.query.limit);
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

app.patch('/admin/workers/:id', async (req, res, next) => {
  try {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const worker = await setWorkerApproval(
      req.params.id,
      req.body?.approved,
      req.body?.adminNotes,
    );
    res.json({ ok: true, worker });
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
  if (res.headersSent) return;

  if (req.path.startsWith(API_BASE_PATH)) {
    res.status(200).json({ status: 'GENERAL_ERROR', message });
    return;
  }
  res.status(400).json({ ok: false, code: 'BAD_REQUEST', message });
});

app.listen(PORT, () => {
  console.log(`\n✓ SahiKaarigar auth-server on ${API_DOMAIN}`);
  console.log(`  SMS provider : ${resolveSmsProvider()}`);
  console.log(`  Core         : ${process.env.SUPERTOKENS_CONNECTION_URI}`);
  console.log(`  CORS origin  : ${WEBSITE_DOMAIN}\n`);
});
