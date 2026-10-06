// =============================================================================
// SahiKaarigar auth-server — SMS delivery
// =============================================================================
// SuperTokens generates the one-time code; WE deliver it. Switching providers
// is a single env var (`SMS_PROVIDER`) because every adapter below exposes the
// same `({ phone, otp })` signature.
//
//   console         dev only — prints the OTP, sends nothing, costs nothing
//   msg91           India, cheapest, needs DLT registration
//   fast2sms        India, cheap, needs DLT registration
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

    // Route A — the dedicated OTP endpoint (cheapest per SMS).
    // Needs an "OTP template id" from the Fast2SMS dashboard, and it accepts
    // OUR otp value, so SuperTokens' code is the one the user receives.
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
      throw new Error(`Fast2SMS QuickSMS HTTP ${res.status}: ${body}`);
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
 * Deliver an OTP through the provider selected by `SMS_PROVIDER`.
 * @param {{ phone: string, otp: string }} input
 */
export async function sendOtpSms({ phone, otp }) {
  const name = (process.env.SMS_PROVIDER || 'console').toLowerCase();
  const provider = providers[name];
  if (!provider) {
    throw new Error(
      `Unknown SMS_PROVIDER "${name}". Use one of: ${SUPPORTED_SMS_PROVIDERS.join(', ')}`,
    );
  }
  return provider({ phone, otp });
}
