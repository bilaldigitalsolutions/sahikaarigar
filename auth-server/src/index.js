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

import { sendOtpSms, SUPPORTED_SMS_PROVIDERS } from './sms.js';
import {
  getOrCreateUserByAuthId,
  upsertWorkerProfile,
  updateUser,
  normalizeIndianPhone,
  isValidIndianPhone,
} from './users.js';

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
    smsProvider: (process.env.SMS_PROVIDER || 'console').toLowerCase(),
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

// SuperTokens turns its own errors (e.g. missing session) into proper responses.
app.use(errorHandler());

// Fallback: our validation / Supabase errors -> 400 JSON (matches the edge function).
app.use((error, _req, res, _next) => {
  const message = error instanceof Error ? error.message : 'Unexpected error';
  console.error('auth-server error:', message);
  if (res.headersSent) return;
  res.status(400).json({ ok: false, code: 'BAD_REQUEST', message });
});

app.listen(PORT, () => {
  console.log(`\n✓ SahiKaarigar auth-server on ${API_DOMAIN}`);
  console.log(`  SMS provider : ${(process.env.SMS_PROVIDER || 'console').toLowerCase()}`);
  console.log(`  Core         : ${process.env.SUPERTOKENS_CONNECTION_URI}`);
  console.log(`  CORS origin  : ${WEBSITE_DOMAIN}\n`);
});
