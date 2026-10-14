// =============================================================================
// SahiKaarigar auth-server — Expo push notifications (free Expo Push API)
// =============================================================================
// The mobile app registers its Expo push token after login (POST /me/push-token
// stores it on the users row). Hire status changes then ping the OTHER party
// through https://exp.host — no FCM key, no Firebase project, no extra service.
//
// Tokens are looked up straight from the `users` table (never carried on the
// hire payloads), so a push token can never leak through an API response.
//
// Everything here is best-effort: a failed push must never fail the request
// that triggered it, so every export swallows its own errors.
// =============================================================================

import { db } from './users.js';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

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

/** Fire-and-forget one Expo push message. Never throws. */
async function sendExpoPush({ to, title, body, data }) {
  if (!to || typeof to !== 'string' || !to.startsWith('ExponentPushToken[')) return;
  try {
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        sound: 'default',
        title: title || 'SahiKaarigar',
        body: body || '',
        data: data ?? {},
      }),
    });
  } catch (error) {
    console.error('expo push failed:', error?.message ?? error);
  }
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
    body: (hire) => `${hire?.worker?.user?.name ?? 'Kaarigar'} aapki jagah pahunch gaya hai.`,
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
    await sendExpoPush({
      to: token,
      title: 'Nayi kaam ki request 🛠️',
      body: `${hire?.employer?.name ?? 'Customer'} ne aapko hire karne ki request bheji hai.`,
      data: { hireId: hire?.id, status: hire?.status, action: 'created' },
    });
  } catch (error) {
    console.error('notifyWorkerOfNewHire failed:', error?.message ?? error);
  }
}
