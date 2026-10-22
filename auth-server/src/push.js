// =============================================================================
// SahiKaarigar auth-server — Expo push notifications (free Expo Push API)
// =============================================================================
// The mobile app registers its Expo push token after login (POST /me/push-token
// stores it on the users row). Hire status changes then ping the OTHER party
// through the official `expo-server-sdk` — no FCM key, no Firebase project, no
// extra service.
//
// Tokens are looked up straight from the `users` table (never carried on the
// hire payloads), so a push token can never leak through an API response.
//
// Everything here is best-effort: a failed push must never fail the request
// that triggered it, so the send helpers swallow their own errors. The admin
// reminder helper still surfaces DB read errors to its endpoint.
// =============================================================================

import { Expo } from 'expo-server-sdk';

import { db } from './users.js';

// Reused across requests; the SDK handles chunking, retries and rate limits.
// EXPO_ACCESS_TOKEN is optional (only needed when "Enhanced Security for Push
// Notifications" is enabled in the Expo project).
const expo = new Expo({
  accessToken: process.env.EXPO_ACCESS_TOKEN || undefined,
});

/** users.id -> Expo push token (null when missing / notifications denied). */
async function pushTokenForUser(userId) {
  if (!userId) return null;
  try {
    const { data } = await db
      .from('users')
      .select('push_token')
      .eq('id', userId)
      .maybeSingle();
    return data?.push_token ?? null;
  } catch {
    return null;
  }
}

/** True for both ExponentPushToken[...] and ExpoPushToken[...]. */
export function isValidPushToken(token) {
  return typeof token === 'string' && Expo.isExpoPushToken(token);
}

/**
 * Send one or more Expo push messages through expo-server-sdk.
 * Invalid/missing tokens and API failures are skipped, never thrown.
 * @returns {Promise<{ sent: number, failed: number }>}
 */
export async function sendExpoPushMany(messages) {
  const payload = (messages ?? [])
    .filter((message) => isValidPushToken(message?.to))
    .map((message) => ({
      to: message.to,
      sound: message.sound ?? 'default',
      title: message.title || 'SahiKaarigar',
      body: message.body || '',
      data: message.data ?? {},
      priority: 'high',
      // expo-notifications creates this channel on Android (see the mobile
      // lib/notifications.ts); without it Android 8+ drops the notification.
      channelId: message.channelId ?? 'default',
    }));
  if (payload.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;
  for (const chunk of expo.chunkPushNotifications(payload)) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, index) => {
        if (ticket.status === 'ok') {
          sent += 1;
          return;
        }
        failed += 1;
        console.error(
          'expo push ticket error:',
          ticket.message,
          ticket.details?.error ?? '',
          'token:',
          chunk[index]?.to ?? '',
        );
      });
    } catch (error) {
      failed += chunk.length;
      console.error('expo push request failed:', error?.message ?? error);
    }
  }
  return { sent, failed };
}

/** Fire-and-forget one Expo push message. Never throws. */
async function sendExpoPush({ to, title, body, data }) {
  await sendExpoPushMany([{ to, title, body, data }]);
}

const STATUS_MESSAGES = {
  accept: {
    to: 'employer',
    title: 'Request accept ho gayi ✅',
    body: (hire) => `${hire?.worker?.user?.name ?? 'Kaarigar'} ne aapki request accept kar li hai.`,
  },
  reject: {
    to: 'employer',
    title: 'Request reject ho gayi',
    body: () => 'Kaarigar ne aapki request reject kar di hai. Doosra kaarigar try karo.',
  },
  en_route: {
    to: 'employer',
    title: 'Kaarigar raaste me hai 🚗',
    body: (hire) => `${hire?.worker?.user?.name ?? 'Kaarigar'} aa raha hai. Live tracking dekh sakte ho.`,
  },
  arrived: {
    to: 'employer',
    title: 'Kaarigar pahunch gaya 📍',
    body: (hire) => `${hire?.worker?.user?.name ?? 'Kaarigar'} aapki jagah pahunch gaya hai. OTP dekh kar kaam shuru karne dein.`,
  },
  start: {
    to: 'employer',
    title: 'Kaam shuru ho gaya 🛠️',
    body: (hire) => `${hire?.worker?.user?.name ?? 'Kaarigar'} ne OTP verify karke kaam shuru kar diya hai.`,
  },
  complete: {
    to: 'both',
    title: 'Kaam complete ho gaya 🎉',
    body: () => 'Kaam ho gaya. Ek chhota review dekar doosron ki madad karo.',
  },
  cancelled: {
    to: 'worker',
    title: 'Request cancel ho gayi',
    body: () => 'Customer ne request cancel kar di hai.',
  },
};

/**
 * Notify the relevant party after a hire status change.
 * @param {object} hire mapped hire (see mapHire in hires.js)
 * @param {string} action the action that just happened
 * Never throws.
 */
export async function notifyHireUpdate(hire, action) {
  try {
    const spec = STATUS_MESSAGES[action];
    if (!spec || !hire) return;

    const body = spec.body(hire);
    const data = { hireId: hire.id, status: hire.status, action };

    if (spec.to === 'employer' || spec.to === 'both') {
      const token = await pushTokenForUser(hire.employerId);
      await sendExpoPush({ to: token, title: spec.title, body, data });
    }
    if (spec.to === 'worker' || spec.to === 'both') {
      const workerUserId = hire.worker?.userId ?? null;
      const token = await pushTokenForUser(workerUserId);
      await sendExpoPush({ to: token, title: spec.title, body, data });
    }
  } catch (error) {
    console.error('notifyHireUpdate failed:', error?.message ?? error);
  }
}

/** Ping the worker when a NEW hire request lands. Never throws. */
export async function notifyWorkerOfNewHire(hire) {
  try {
    const workerUserId = hire?.worker?.userId ?? null;
    const token = await pushTokenForUser(workerUserId);
    const employerName = String(hire?.employer?.name || '').trim() || 'Customer';
    await sendExpoPush({
      to: token,
      title: 'Naya Kaam Aaya Hai!',
      body: `${employerName} ne aapko hire kiya hai. Details dekhne ke liye app kholiye.`,
      data: { hireId: hire?.id, status: hire?.status, action: 'created' },
    });
  } catch (error) {
    console.error('notifyWorkerOfNewHire failed:', error?.message ?? error);
  }
}

const PROFILE_REMINDER_BODY =
  'Apni profile complete karein! Profile complete karne ke baad hi aapko kaam milna shuru hoga.';

/**
 * Remind every worker whose profile is still incomplete — not approved yet,
 * or no Aadhaar number on file — to finish it.
 *
 * Called by POST /admin/send-profile-reminders. Sending is best-effort:
 * workers without a registered device are counted as `skipped`, and a failed
 * batch is counted as `failed`; the request itself still succeeds.
 *
 * @param {{ limit?: number }} [options] max profiles to scan in one run
 */
export async function sendProfileCompletionReminders({ limit = 500 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 500, 1), 1000);

  const { data, error } = await db
    .from('worker_profiles')
    .select(
      'id, user_id, is_approved, aadhaar_number, ' +
        'user:users!user_id(id, name, push_token)',
    )
    .or('is_approved.eq.false,is_approved.is.null,aadhaar_number.is.null')
    .limit(safeLimit);

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const messages = [];
  let skipped = 0;

  for (const row of rows) {
    const token = row.user?.push_token ?? null;
    if (!isValidPushToken(token)) {
      skipped += 1;
      continue;
    }
    messages.push({
      to: token,
      title: 'SahiKaarigar',
      body: PROFILE_REMINDER_BODY,
      data: { type: 'profile_reminder', workerProfileId: row.id },
    });
  }

  const { sent, failed } = await sendExpoPushMany(messages);

  return {
    incompleteProfiles: rows.length,
    withPushToken: messages.length,
    sent,
    failed,
    skipped,
  };
}
