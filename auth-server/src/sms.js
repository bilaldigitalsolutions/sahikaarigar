// =============================================================================
// SahiKaarigar auth-server — SMS delivery
// =============================================================================
// SuperTokens generates the one-time code; WE deliver it. Switching providers
// is a single env var (`SMS_PROVIDER`) because every adapter below exposes the
// same `({ phone, otp })` signature.
//
//   console         dev only — prints the OTP, sends nothing, costs nothing
//   startmessaging  India, DLT-FREE SMS OTP (~Rs.0.25/OTP) — accepts our own code
//   msg91           India, cheapest, needs DLT registration
//   fast2sms        India, cheap (~Rs.0.25/SMS). Smart-OTP SMS needs DLT;
//                   route=q (Quick SMS) is DLT-free but ~Rs.5/SMS
//   messagecentral  India, DLT-free managed OTP (~Rs.0.30 / OTP)
//   twilio          global, requires a card
// =============================================================================

const TIMEOUT_MS = 10_000;

function need(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set (required by SMS_PROVIDER=${process.env.SMS_PROVIDER})`,
    );
  }
  return value;
}

async function readBody(res) {
  const text = await res.text().catch(() => '');
  return text ? text.slice(0, 400) : '';
}

/** Build the plain-text message for providers that send free text. */
export function buildMessage(otp, appName = process.env.APP_NAME || 'SahiKaarigar') {
  return `${otp} is your ${appName} verification code. Valid for 5 minutes. Do not share it with anyone.`;
}

// -----------------------------------------------------------------------------
// Adapters — each receives { phone, otp } where phone is a 10-digit IN number
// -----------------------------------------------------------------------------

const providers = {
  async console({ phone, otp }) {
    console.log(`\n[SMS:console] OTP for +91${phone} -> ${otp}\n`);
  },

  async msg91({ phone, otp }) {
    const key = need('MSG91_AUTH_KEY');
    const templateId = need('MSG91_TEMPLATE_ID');
    const url =
      'https://control.msg91.com/api/v5/otp' +
      `?template_id=${encodeURIComponent(templateId)}` +
      `&mobile=91${phone}` +
      `&authkey=${encodeURIComponent(key)}` +
      `&otp=${encodeURIComponent(otp)}`;

    const res = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) throw new Error(`MSG91 HTTP ${res.status}: ${await readBody(res)}`);
  },

  async fast2sms({ phone, otp }) {
    const key = need('FAST2SMS_API_KEY');
    const otpTemplateId = process.env.FAST2SMS_OTP_TEMPLATE_ID;

    // Route A — the dedicated OTP endpoint (cheapest per SMS, ~Rs.0.25).
    // Needs a "Smart OTP" template id from the Fast2SMS dashboard, and it
    // accepts OUR otp value, so SuperTokens' code is the one the user receives.
    // NOTE: an SMS-channel OTP template requires DLT registration (TRAI); a
    // WhatsApp-channel OTP template does not (only a one-time Meta approval).
    if (otpTemplateId) {
      const res = await fetch('https://www.fast2sms.com/dev/otp/send', {
        method: 'POST',
        headers: { authorization: key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mobile: phone,
          otp_id: otpTemplateId,
          otp,
          otp_length: otp.length,
          otp_expiry: 15,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const body = await readBody(res);
      if (!res.ok || /"return"\s*:\s*false/.test(body)) {
        throw new Error(`Fast2SMS OTP HTTP ${res.status}: ${body}`);
      }
      return;
    }

    // Route B — "Quick SMS" (route=q). Needs ONLY the API key: DLT-free, random
    // sender id, but billed at the premium rate. We send the whole message text
    // so SuperTokens' own OTP travels inside it.
    // https://docs.fast2sms.com/reference/quick-sms-post
    const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: { authorization: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ route: 'q', message: buildMessage(otp), numbers: phone }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await readBody(res);
    if (!res.ok || /"return"\s*:\s*false/.test(body)) {
      // 999 = "complete one transaction of 100 INR or more" — the Quick SMS API
      // stays locked until the Fast2SMS wallet has had a real top-up.
      const hint = /"status_code"\s*:\s*999/.test(body)
        ? ' — Fast2SMS requires a one-time top-up of Rs.100+ before the Quick SMS'
          + ' API unlocks; or set FAST2SMS_OTP_TEMPLATE_ID to use Smart OTP instead.'
        : '';
      throw new Error(`Fast2SMS QuickSMS HTTP ${res.status}: ${body}${hint}`);
    }
  },

  // StartMessaging — https://startmessaging.com  (India, DLT-FREE, ~Rs.0.25/OTP)
  // The DLT-free SMS OTP provider that lets us pass OUR OWN otp value: the
  // `variables.otp` field is required, so SuperTokens' code is what the user
  // receives. Sign up (email + one-time KYC), top up via UPI, create an API key
  // ("sm_live_..."). No DLT entity, sender ID or template approval needed.
  // https://startmessaging.com/otp-api/
  async startmessaging({ phone, otp }) {
    const key = need('STARTMESSAGING_API_KEY');
    const base = (
      process.env.STARTMESSAGING_BASE_URL || 'https://api.startmessaging.com'
    ).replace(/\/+$/, '');
    const templateId = process.env.STARTMESSAGING_TEMPLATE_ID; // optional

    const res = await fetch(`${base}/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': key },
      body: JSON.stringify({
        phoneNumber: `+91${phone}`, // E.164, e.g. +919876543210
        ...(templateId ? { templateId } : {}),
        variables: { otp, appName: process.env.APP_NAME || 'SahiKaarigar' },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await readBody(res);
    if (!res.ok || /"success"\s*:\s*false/.test(body)) {
      throw new Error(`StartMessaging HTTP ${res.status}: ${body}`);
    }
  },

  async messagecentral({ phone, otp }) {
    const base = process.env.MESSAGECENTRAL_BASE_URL || 'https://cpaas.messagecentral.com';
    const customerId = need('MESSAGECENTRAL_CUSTOMER_ID');
    const password = need('MESSAGECENTRAL_PASSWORD');

    const authRes = await fetch(
      `${base}/auth/v1/authentication/token` +
        `?customerId=${encodeURIComponent(customerId)}` +
        `&key=${encodeURIComponent(password)}&scope=NEW&country=91`,
      { method: 'POST', signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
    if (!authRes.ok) throw new Error(`MessageCentral auth HTTP ${authRes.status}`);
    const auth = await authRes.json().catch(() => ({}));
    const token = auth.token || auth.authToken;
    if (!token) throw new Error('MessageCentral: no auth token returned');

    const sendRes = await fetch(
      `${base}/verification/v3/send` +
        `?countryCode=91&customerId=${encodeURIComponent(customerId)}` +
        `&flowType=SMS&mobileNumber=${encodeURIComponent(phone)}`,
      {
        method: 'POST',
        headers: { authToken: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp, otpLength: otp.length }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!sendRes.ok) {
      throw new Error(`MessageCentral send HTTP ${sendRes.status}: ${await readBody(sendRes)}`);
    }
  },

  async twilio({ phone, otp }) {
    const sid = need('TWILIO_ACCOUNT_SID');
    const token = need('TWILIO_AUTH_TOKEN');
    const from = need('TWILIO_FROM');

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ To: `+91${phone}`, From: from, Body: buildMessage(otp) }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!res.ok) throw new Error(`Twilio HTTP ${res.status}: ${await readBody(res)}`);
  },
};

export const SUPPORTED_SMS_PROVIDERS = Object.keys(providers);

/**
 * The env vars each provider cannot work without. Used to decide whether a
 * provider is actually usable, so a half-configured host degrades gracefully
 * instead of failing every single OTP request.
 */
const REQUIRED_ENV = {
  startmessaging: ['STARTMESSAGING_API_KEY'],
  msg91: ['MSG91_AUTH_KEY', 'MSG91_TEMPLATE_ID'],
  // The Quick-SMS route only needs the key (FAST2SMS_OTP_TEMPLATE_ID is optional).
  fast2sms: ['FAST2SMS_API_KEY'],
  messagecentral: ['MESSAGECENTRAL_CUSTOMER_ID', 'MESSAGECENTRAL_PASSWORD'],
  twilio: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM'],
};

/**
 * Auto-detect order. `startmessaging` is first because it is the only DLT-free
 * SMS OTP route here (no DLT portal, sender ID or template approval).
 */
const AUTO_DETECT_ORDER = ['startmessaging', 'fast2sms', 'msg91', 'messagecentral', 'twilio'];

/** True when every env var the provider needs is present and non-empty. */
export function isSmsProviderConfigured(name) {
  const keys = REQUIRED_ENV[name];
  if (!keys) return false;
  return keys.every((key) => String(process.env[key] || '').trim().length > 0);
}

/**
 * Which provider should actually deliver the OTP?
 *
 * `SMS_PROVIDER` wins when it names a real provider, but a bare `console`
 * (or nothing at all) means "auto-detect": if any provider's credentials are
 * present we use that one. This way dropping a single API key into the host's
 * environment is enough to switch from logs to real SMS — no second setting to
 * keep in sync (and no Blueprint sync to fight with).
 *
 * A provider that is selected but NOT configured (e.g. `SMS_PROVIDER=fast2sms`
 * with no `FAST2SMS_API_KEY` on the host) falls back to `console` with a loud
 * warning, instead of throwing `<KEY> is not set` on every OTP request — that
 * used to make the whole sign-in / hire flow unusable.
 */
export function resolveSmsProvider() {
  const explicit = (process.env.SMS_PROVIDER || '').trim().toLowerCase();

  if (explicit && explicit !== 'console') {
    if (isSmsProviderConfigured(explicit)) return explicit;
    console.warn(
      `[sms] SMS_PROVIDER="${explicit}" is set but ${(REQUIRED_ENV[explicit] || ['its credentials']).join(
        ' + ',
      )} is missing — falling back to "console" (OTP goes to the logs). ` +
        'Add the key in the host dashboard to switch to real SMS.',
    );
    return 'console';
  }

  return AUTO_DETECT_ORDER.find(isSmsProviderConfigured) || 'console';
}

/**
 * Deliver an OTP through the resolved provider.
 * @param {{ phone: string, otp: string }} input
 */
export async function sendOtpSms({ phone, otp }) {
  const name = resolveSmsProvider();
  const provider = providers[name];
  if (!provider) {
    throw new Error(
      `Unknown SMS_PROVIDER "${name}". Use one of: ${SUPPORTED_SMS_PROVIDERS.join(', ')}`,
    );
  }
  return provider({ phone, otp });
}
