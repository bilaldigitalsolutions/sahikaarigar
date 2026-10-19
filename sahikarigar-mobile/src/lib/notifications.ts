// =============================================================================
// SahiKaarigar — push notifications (Expo Push, free)
// =============================================================================
// After login the app asks for notification permission, grabs the Expo push
// token and hands it to the auth-server (POST /me/push-token). The server then
// pings this device when a hire is accepted / en route / arrived / completed.
//
// Everything is best-effort: denied permission or a missing EAS project id
// simply means no push — the app works exactly as before.
// =============================================================================

import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { savePushToken, getHire } from './api';

import { formatCurrency } from '../utils';

/**
 * Ask for notification permission ONLY (no token, no server call).
 * Called once at app startup so the user is never prompted mid-flow.
 * Never throws.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') return false;
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const request = await Notifications.requestPermissionsAsync();
    return request.status === 'granted';
  } catch {
    return false;
  }
}

/** Foreground handler — show the banner even while the app is open. */
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Ask permission, fetch the Expo push token and register it with the server.
 * Returns the token (or null when notifications are unavailable). Never throws.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Physical devices only — simulators / web can't receive push.
    if (Platform.OS === 'web') return null;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const request = await Notifications.requestPermissionsAsync();
      status = request.status;
    }
    if (status !== 'granted') return null;

    // Android needs a default channel for the sound/vibration to fire.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'SahiKaarigar',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#16A34A',
      });
    }

    // The token is tied to the EAS project (app.json → extra.eas.projectId).
    const tokenResponse = await Notifications.getExpoPushTokenAsync();
    const token = tokenResponse.data;

    // Hand it to the server — fire-and-forget, best-effort.
    void savePushToken(token).catch(() => {});

    return token;
  } catch {
    return null;
  }
}

/** True when a tapped notification is a "Nayi kaam ki request" for the worker. */
function isNewRequestPush(
  response: Notifications.NotificationResponse | null | undefined,
): boolean {
  const data = response?.notification.request.content.data as { action?: string } | undefined;
  return data?.action === 'created';
}

// -----------------------------------------------------------------------------
// In-app top banner (Rapido/Porter style) — "Nayi Kaam ki Request 🛠️"
// -----------------------------------------------------------------------------
// lib emits; the <TopNotificationBanner /> component mounted in the root layout
// listens and slides down. No circular imports: notifications.ts never imports
// components.

export interface AppBannerPayload {
  title: string;
  body: string;
  /** Hire rate — shown big and bold on the banner (Rapido-style). */
  price?: string;
  /** Customer's work location — a one-line brief under the price. */
  location?: string;
}

const bannerListeners = new Set<(payload: AppBannerPayload) => void>();

/** Subscribe to in-app banner events. Returns an unsubscribe function. */
export function onAppBanner(listener: (payload: AppBannerPayload) => void): () => void {
  bannerListeners.add(listener);
  return () => {
    bannerListeners.delete(listener);
  };
}

/** Fire an in-app banner. A broken listener must never block the others. */
export function emitAppBanner(payload: AppBannerPayload): void {
  bannerListeners.forEach((listener) => {
    try {
      listener(payload);
    } catch {
      // ignore — banner UI issues must never affect the notification flow
    }
  });
}

function bannerPayloadOf(content: Notifications.NotificationContent): AppBannerPayload {
  return {
    title: content.title ?? 'Nayi Kaam ki Request 🛠️',
    body: content.body ?? '',
  };
}

/**
 * Pop the banner for a new-request push, then quietly enrich it with the
 * actual card details (rate + location) once the hire is fetched — the banner
 * simply updates in place. Everything best-effort; a failed fetch just leaves
 * the text-only banner.
 */
function emitRequestBanner(content: Notifications.NotificationContent): void {
  emitAppBanner(bannerPayloadOf(content));

  const data = content.data as { hireId?: string } | undefined;
  if (!data?.hireId) return;
  void getHire(data.hireId)
    .then(({ hire }) => {
      emitAppBanner({
        ...bannerPayloadOf(content),
        price: formatCurrency(hire.proposedRate),
        location: hire.location,
      });
    })
    .catch(() => {
      // Server slow/offline — the text-only banner already popped above.
    });
}

/**
 * Tapping a new-job-request push lands the kaarigar straight on the Job
 * Requests tab. Handles both taps while the app runs and cold starts
 * (Android/iOS deep-open). Also pops the in-app top banner whenever a new
 * request push arrives. Best-effort — a failed step never blocks the next.
 *
 * @param enabled pass `false` while the session is still restoring.
 */
export function useHireRequestNotificationRoute(enabled: boolean) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return undefined;
    let mounted = true;

    const openRequests = () => {
      try {
        router.push('/(tabs)/jobs');
      } catch {
        // Router not wired yet — the Jobs tab refetches on focus anyway.
      }
    };

    // Push RECEIVED while the app is open — pop the in-app banner.
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as { action?: string } | undefined;
      if (data?.action === 'created') emitRequestBanner(notification.request.content);
    });

    // Foreground/background tap — navigate + show the banner.
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      if (isNewRequestPush(response)) {
        openRequests();
        emitRequestBanner(response.notification.request.content);
      }
    });

    // Cold start — the app process began with this tap.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response && mounted && isNewRequestPush(response)) {
        openRequests();
        emitRequestBanner(response.notification.request.content);
      }
    });

    return () => {
      mounted = false;
      subscription.remove();
      receivedSubscription.remove();
    };
  }, [enabled, router]);
}
