/**
 * Is Firebase Phone Auth actually usable for this project?
 *
 * Since September 2024 Firebase requires a Cloud Billing account (Blaze) to
 * send SMS to REAL numbers. Registered TEST phone numbers are exempt and keep
 * working on the free Spark plan. This script tells you which case you are in,
 * without sending any SMS.
 *
 * Usage:
 *   npm run auth:check                  # probes +919999999999
 *   npm run auth:check -- +919876543210 # probe a different number
 *
 * Safe: a fake reCAPTCHA token is sent, so the backend never delivers an SMS.
 */
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadEnvFile(name) {
  const file = path.join(root, name);
  if (!existsSync(file)) return {};

  const env = {};
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
  return env;
}

const env = { ...loadEnvFile('.env.local'), ...process.env };
const apiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY;
const phone = process.argv[2] || '+919999999999';

if (!apiKey) {
  console.error('✗ NEXT_PUBLIC_FIREBASE_API_KEY is missing in .env.local');
  process.exit(1);
}

console.log(`\n🔎 Firebase Phone Auth check — probing ${phone}\n`);

// 1) Project config (authorized domains + whether any sign-in method is on)
const config = await fetch(
  `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig?key=${apiKey}`,
).then((res) => res.json());

console.log('1) getProjectConfig');
console.log(JSON.stringify(config, null, 2));
console.log(
  config?.signIn?.phoneNumber?.enabled
    ? '   ✅ Phone provider reports enabled\n'
    : '   ⚠️  No signIn.phoneNumber.enabled — the Phone provider may not be saved\n',
);

// 2) Ask the backend to start a verification. A fake reCAPTCHA token means it
//    can never actually deliver an SMS, so this is free and side-effect free.
const probeResponse = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:sendVerificationCode?key=${apiKey}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: phone, recaptchaToken: 'bogus' }),
  },
);
const probe = await probeResponse.json().catch(() => null);
const message = probe?.error?.message ?? '';

console.log(`2) sendVerificationCode  [HTTP ${probeResponse.status}]`);
console.log(JSON.stringify(probe, null, 2));
console.log('');

console.log('--- verdict ---');
if (message.startsWith('BILLING_NOT_ENABLED')) {
  console.log('❌ BILLING_NOT_ENABLED — blocked before a session was created.');
  console.log('   • If this should be a TEST number it is not registered yet:');
  console.log('     Authentication → Sign-in method → Phone → "Phone numbers for testing"');
  console.log('   • Real numbers additionally need Cloud Billing (Blaze) since Sept 2024.');
} else if (probe?.sessionInfo) {
  console.log('✅ A session was created and NO SMS was sent → this IS a test number.');
  console.log('   Phone Auth is usable right now. Try it on the live site.');
} else if (message.startsWith('INVALID_PHONE_NUMBER')) {
  console.log('ℹ️  The number format was rejected (use E.164, e.g. +919876543210).');
} else {
  console.log(`ℹ️  Got "${message || 'no error'}" instead of BILLING_NOT_ENABLED →`);
  console.log('   the request got PAST the billing/entitlement check.');
  console.log('   A reCAPTCHA/token error is expected here (this probe sends a fake token),');
  console.log('   so the real browser flow should now work.');
}
console.log('');
