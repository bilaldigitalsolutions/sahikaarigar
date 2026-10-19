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

import { savePushToken } from './api';

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

/**
 * Tapping a new-job-request push lands the kaarigar straight on the Job
 * Requests tab. Handles both taps while the app runs and cold starts
 * (Android/iOS deep-open). Best-effort — a failed navigation never blocks.
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

    // Foreground/background tap.
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      if (isNewRequestPush(response)) openRequests();
    });

    // Cold start — the app process began with this tap.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response && mounted && isNewRequestPush(response)) openRequests();
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [enabled, router]);
}
