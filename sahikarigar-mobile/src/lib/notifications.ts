// =============================================================================
// SahiKaarigar — push notifications (Expo Push, free)
// =============================================================================
// The app shows a one-time rationale before asking for notification permission.
// Once granted, it grabs the Expo push token and hands it to the auth-server
// (POST /me/push-token). The server then pings this device when a hire is
// accepted / en route / arrived / completed.
//
// Everything is best-effort: denied permission or a missing Expo project id
// simply means no push — the app works exactly as before.
// =============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert, AppState, Linking, Platform } from 'react-native';

import { savePushToken, getHire } from './api';

import i18n from '@/lib/i18n';

import { formatCurrency } from '../utils';

/** AsyncStorage flag: the one-time in-app permission rationale was shown. */
const PERMISSION_PROMPT_KEY = 'notif_permission_prompted_v1';

/**
 * Open the OS notification settings and register the push token as soon as the
 * user comes back with notifications enabled. Without this the token would
 * only reach the server on the next cold start.
 */
async function openNotificationSettings(): Promise<void> {
  const subscription = AppState.addEventListener('change', (nextState) => {
    if (nextState !== 'active') return;
    subscription.remove();
    void (async () => {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        if (status === 'granted') void registerForPushNotifications();
      } catch {
        // Best-effort — the next app launch registers the token anyway.
      }
    })();
  });

  try {
    await Linking.openSettings();
  } catch {
    subscription.remove();
  }
}

/**
 * One-time, explain-before-asking notification permission prompt.
 *
 * The old flow requested permission silently at startup, so a denial left the
 * user with an unexplained warning and no way to fix it. This shows a proper
 * rationale instead, only while the permission is not granted, and at most once
 * per install. If Android/iOS will no longer show the native prompt, the button
 * opens the app settings page.
 *
 * Never throws — permission UI must not break app startup.
 */
export async function promptForNotificationPermissionOnce(): Promise<void> {
  try {
    if (Platform.OS === 'web') return;

    const permission = await Notifications.getPermissionsAsync();
    if (permission.status === 'granted') return;

    const alreadyPrompted = await AsyncStorage.getItem(PERMISSION_PROMPT_KEY);
    if (alreadyPrompted === '1') return;
    // Set the flag before showing the dialog so a re-render/remount can't stack
    // two prompts on top of each other.
    await AsyncStorage.setItem(PERMISSION_PROMPT_KEY, '1');

    const needsSettings = permission.status === 'denied' || !permission.canAskAgain;

    Alert.alert(
      i18n.t('notifications.enableTitle'),
      i18n.t('notifications.enableBody'),
      [
        { text: i18n.t('notifications.notNow'), style: 'cancel' },
        {
          text: needsSettings ? i18n.t('onboarding.openSettings') : i18n.t('notifications.enable'),
          onPress: () => {
            void (async () => {
              try {
                if (!needsSettings) {
                  const request = await Notifications.requestPermissionsAsync();
                  if (request.status === 'granted') {
                    // The user may have enabled notifications after login; give
                    // the server the token now instead of waiting for relaunch.
                    void registerForPushNotifications();
                    return;
                  }
                }
                await openNotificationSettings();
              } catch {
                // Ignore — the user can still turn notifications on in Settings.
              }
            })();
          },
        },
      ],
      { cancelable: true },
    );
  } catch {
    // Best-effort: a failed rationale must never affect app startup.
  }
}

/**
 * Create the loud notification channel. Android channels are IMMUTABLE after
 * creation — the first build shipped 'default' with DEFAULT importance (no
 * heads-up, no guaranteed sound), so the channel id changed to 'hires'.
 *
 * The channel ships with a bundled custom sound (hire_ding.wav, added to
 * res/raw at build time by the expo-notifications plugin 'sounds' config in
 * app.json). Without an explicit sound, Android creates the channel silent —
 * the channel's settings override whatever the push message requests, which is
 * why notifications were easy to miss before.
 *
 * Runs at app start (root layout) — channel creation does NOT need
 * notification permission, so the channel exists even before the user signs
 * in, and pushes delivered to a killed app always find their channel.
 * Never throws.
 */
export async function ensureNotificationChannel(): Promise<void> {
  try {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync('hires', {
      name: 'SahiKaarigar',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'hire_ding.wav',
      enableVibrate: true,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#16A34A',
    });
  } catch {
    // Best-effort — a failed channel creation must not break app startup.
  }
}

/** Foreground handler — show the banner even while the app is open. */
export function configureNotificationHandler() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Fetch the Expo push token (only when permission is already granted) and
 * register it with the server. Never throws.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Physical devices only — simulators / web can't receive push.
    if (Platform.OS === 'web') return null;

    // Permission is requested only from promptForNotificationPermissionOnce()
    // so the user always sees the rationale first. Registration stays silent.
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return null;

    // Loud channel (heads-up + custom ding sound) — created here again as a
    // no-op safety net; the root layout already runs it at every app start.
    if (Platform.OS === 'android') {
      await ensureNotificationChannel();
    }

    // The token is tied to the Expo project ID in app.json → extra.eas.projectId
    // (required by getExpoPushTokenAsync for push — not an EAS build dependency).
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

// -----------------------------------------------------------------------------
// Hire-push listeners — screens (worker dashboard, hire lists) subscribe so
// their lists refresh INSTANTLY when a hire push arrives or is tapped, instead
// of waiting for the next poll tick. Without this a new request can sit hidden
// until the worker pulls to refresh.
// -----------------------------------------------------------------------------

const hirePushListeners = new Set<(hireId?: string) => void>();

/** Subscribe to hire-push events. Returns an unsubscribe function. */
export function onHirePush(listener: (hireId?: string) => void): () => void {
  hirePushListeners.add(listener);
  return () => {
    hirePushListeners.delete(listener);
  };
}

function emitHirePush(hireId?: string): void {
  hirePushListeners.forEach((listener) => {
    try {
      listener(hireId);
    } catch {
      // ignore — one broken screen must never block the others
    }
  });
}

function bannerPayloadOf(content: Notifications.NotificationContent): AppBannerPayload {
  return {
    title: content.title ?? i18n.t('common.newJobRequestTitle'),
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

    // Push RECEIVED while the app is open — pop the in-app banner for new
    // requests and refresh any hire lists that are on screen.
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as
        | { action?: string; hireId?: string }
        | undefined;
      if (data?.action === 'created') emitRequestBanner(notification.request.content);
      if (data?.hireId) emitHirePush(data.hireId);
    });

    // Foreground/background tap — navigate + show the banner + refresh lists.
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as
        | { action?: string; hireId?: string }
        | undefined;
      if (isNewRequestPush(response)) {
        openRequests();
        emitRequestBanner(response.notification.request.content);
      }
      if (data?.hireId) emitHirePush(data.hireId);
    });

    // Cold start — the app process began with this tap.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response || !mounted) return;
      const data = response.notification.request.content.data as
        | { action?: string; hireId?: string }
        | undefined;
      if (isNewRequestPush(response)) {
        openRequests();
        emitRequestBanner(response.notification.request.content);
      }
      if (data?.hireId) emitHirePush(data.hireId);
    });

    return () => {
      mounted = false;
      subscription.remove();
      receivedSubscription.remove();
    };
  }, [enabled, router]);
}
