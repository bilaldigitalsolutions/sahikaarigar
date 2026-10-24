// =============================================================================
// SahiKaarigar auth-server — transactional email (admin notifications)
// =============================================================================
// Used for one thing so far: telling the admin that a new Kaarigar registered.
//
// Two transports, picked from the environment at send time:
//
//   RESEND_API_KEY=re_...        -> Resend HTTP API. No npm package needed.
//                                   Recommended on Render: its free tier blocks
//                                   outbound SMTP (25/465/587), so a Gmail/SMTP
//                                   transport silently times out there.
//
//   SMTP_HOST / SMTP_USER /      -> SMTP via nodemailer (Gmail App Password,
//   SMTP_PASS / SMTP_PORT           Brevo, Mailgun SMTP, ...).
//                                   Requires: npm install nodemailer
//
//   (neither)                    -> prints the message to the server log, so
//                                   local dev works with zero configuration.
//
// `sendEmail()` NEVER throws. It returns { ok } and logs failures instead, so
// callers can use `void sendEmail(...)` and never delay or fail a request.
// =============================================================================

/** Cached nodemailer transport (created on first SMTP send). */
let smtpTransport = null;

/** Escapes user-supplied text before it is put in the HTML part. */
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Fallback name for workers who never set one (matches the admin panel). */
function displayName(name) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  return trimmed && trimmed.toLowerCase() !== 'user' ? trimmed : 'Name Not Set';
}

/** Sender address. Resend requires a verified domain (or onboarding@resend.dev). */
function fromAddress() {
  return (
    process.env.EMAIL_FROM ||
    process.env.SMTP_USER ||
    'SahiKaarigar <onboarding@resend.dev>'
  );
}

/** True when at least one transport is configured. */
export function isEmailConfigured() {
  if (process.env.RESEND_API_KEY) return true;
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
  );
}

async function sendViaResend({ to, subject, text, html }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [to],
      subject,
      text,
      ...(html ? { html } : {}),
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 300);
    throw new Error(`Resend ${response.status}: ${detail || 'request failed'}`);
  }
}

async function getSmtpTransport() {
  if (smtpTransport) return smtpTransport;

  // Imported lazily so the dependency is only required when SMTP is configured.
  const { default: nodemailer } = await import('nodemailer');
  const port = Number(process.env.SMTP_PORT || 587);

  smtpTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465 = implicit TLS, 587 = STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return smtpTransport;
}

async function sendViaSmtp({ to, subject, text, html }) {
  const transport = await getSmtpTransport();
  await transport.sendMail({
    from: fromAddress(),
    to,
    subject,
    text,
    ...(html ? { html } : {}),
  });
}

/**
 * Sends one email. Best-effort: resolves with { ok: false, error } instead of
 * throwing, so a broken mail provider can never break a user-facing request.
 */
export async function sendEmail({ to, subject, text, html }) {
  const recipient = to || process.env.ADMIN_EMAIL;

  if (!recipient) {
    console.warn(
      '[email] skipped: ADMIN_EMAIL is not set (add it to the server environment).',
    );
    return { ok: false, error: 'ADMIN_EMAIL not configured' };
  }

  try {
    if (process.env.RESEND_API_KEY) {
      await sendViaResend({ to: recipient, subject, text, html });
    } else if (
      process.env.SMTP_HOST &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
    ) {
      await sendViaSmtp({ to: recipient, subject, text, html });
    } else {
      // Dev fallback — no credentials needed, nothing is actually delivered.
      console.log(
        `[email] no transport configured; would send to ${recipient}\n` +
          `[email] subject: ${subject}\n[email] body:\n${text}`,
      );
      return { ok: false, error: 'no transport configured' };
    }

    console.log(`[email] sent "${subject}" -> ${recipient}`);
    return { ok: true };
  } catch (error) {
    // Never rethrow — the caller is usually a registration request.
    console.warn(`[email] failed "${subject}" -> ${recipient}: ${error.message}`);
    return { ok: false, error: error.message };
  }
}

/**
 * Alerts the admin that a new Kaarigar profile has been submitted for review.
 *
 * Fire-and-forget by design: returns synchronously and delivers in the
 * background, so a slow (or down) mail provider never delays registration.
 */
export function sendNewWorkerAdminAlert({
  name,
  phone,
  skills,
  serviceAreas,
  profileId,
} = {}) {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.warn(
      '[email] new-worker alert skipped: ADMIN_EMAIL is not set on the server.',
    );
    return;
  }

  const workerName = displayName(name);
  const phoneText = phone ? String(phone) : 'Not provided';
  const skillList =
    Array.isArray(skills) && skills.length
      ? skills.map((skill) => String(skill)).join(', ')
      : 'Not specified';
  const areaList =
    Array.isArray(serviceAreas) && serviceAreas.length
      ? serviceAreas.map((area) => String(area)).join(', ')
      : null;

  const subject = `New Kaarigar Registered: ${workerName}`;

  const lines = [
    'A new worker has registered.',
    '',
    `Name: ${workerName}`,
    `Phone: ${phoneText}`,
    `Skill: ${skillList}`,
  ];
  if (areaList) lines.push(`Service areas: ${areaList}`);
  if (profileId) lines.push(`Profile ID: ${profileId}`);
  lines.push('', 'Please login to the Admin Panel to verify them.');

  const text = lines.join('\n');

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#111827">
      <h2 style="margin:0 0 12px;font-size:18px">New Kaarigar Registered</h2>
      <p style="margin:0 0 12px">A new worker has registered.</p>
      <table style="border-collapse:collapse;font-size:14px">
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Name</td><td style="padding:4px 0"><strong>${esc(workerName)}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Phone</td><td style="padding:4px 0">${esc(phoneText)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Skill</td><td style="padding:4px 0">${esc(skillList)}</td></tr>
        ${areaList ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">Service areas</td><td style="padding:4px 0">${esc(areaList)}</td></tr>` : ''}
        ${profileId ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">Profile ID</td><td style="padding:4px 0;font-family:monospace;font-size:12px">${esc(profileId)}</td></tr>` : ''}
      </table>
      <p style="margin:16px 0 0">Please login to the Admin Panel to verify them.</p>
    </div>
  `.trim();

  // `void` keeps the caller non-blocking even though sendEmail never throws.
  void sendEmail({ to: adminEmail, subject, text, html });
}
