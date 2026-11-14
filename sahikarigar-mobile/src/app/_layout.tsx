import { Stack, usePathname, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Application from 'expo-application';
import * as Font from 'expo-font';
import { Ionicons } from '@expo/vector-icons';

// Initialize i18n
import { initLanguage } from '@/lib/i18n';
import '@/lib/i18n';
import { useTranslation } from 'react-i18next';

import { BrandLogo, TopNotificationBanner } from '@/components';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ModeProvider } from '@/contexts/ModeContext';
import {
  configureNotificationHandler,
  ensureNotificationChannel,
  promptForNotificationPermissionOnce,
  useHireRequestNotificationRoute,
} from '@/lib/notifications';
import { initObservability, posthog, reportError, setAnalyticsUserId, setObservabilityUser, trackEvent } from '@/lib/observability';
import { PostHogProvider } from 'posthog-react-native';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

SplashScreen.preventAutoHideAsync();

// Crash reporting boots first — every later init is wrapped so a failure lands
// in Sentry instead of a silent blank screen.
initObservability();

// Build identity — confirms in logcat exactly which CI run is installed:
//   adb logcat | findstr "\[Build\]"
// `dev` means the bundle was built locally (EXPO_PUBLIC_BUILD_ID not set).
console.log(
  `[Build] id=${process.env.EXPO_PUBLIC_BUILD_ID ?? 'dev'} version=${Application.nativeApplicationVersion ?? '?'} code=${Application.nativeBuildVersion ?? '?'}`,
);

// Show hire status banners even while the app is open.
configureNotificationHandler();

// Create the loud 'hires' channel at every app start — channels need NO
// notification permission, so it exists before any sign-in and pushes to a
// killed app always find their channel. No-op on non-Android.
void ensureNotificationChannel();

/**
 * Shown while the stored session is being restored — the native splash screen
 * hides as soon as this mounts, so the user always sees the brand + spinner
 * instead of a blank frame.
 */
function AppLoading() {
  const { t } = useTranslation();
  return (
    <View style={styles.loading}>
      <BrandLogo size={64} showWordmark={false} />
      <Text style={styles.loadingTitle}>Sahi Kaarigar</Text>
      <ActivityIndicator color={colors.primaryDark} style={styles.loadingSpinner} />
      <Text style={styles.loadingText}>{t('common.loading')}</Text>
    </View>
  );
}

function RootNavigator() {
  const { t } = useTranslation();
  const { initializing, user } = useAuth();
  const pathname = usePathname();
  const segments = useSegments();
  // Route pattern without dynamic ids, e.g. "worker/[id]" or "(tabs)/index".
  const screenName = segments.join('/') || 'index';

  // Vector icons (Ionicons) must be loaded via Font.loadAsync BEFORE any screen
  // renders, otherwise icons show as 'X' boxes.
  const [fontsLoaded, setFontsLoaded] = useState(false);

  // Restore the language the user picked in Profile (falls back to the device
  // language). i18next's changeLanguage re-renders every t() consumer.
  useEffect(() => {
    void initLanguage();
  }, []);

  useEffect(() => {
    let active = true;
    // Hard 3 s timeout: a broken native font pipeline must never brick the app
    // on the loading screen. In-app <Ionicons> components auto-load per mount
    // (build/createIconSet.js componentDidMount), so this gate is only a
    // best-effort pre-load, not a hard requirement.
    const timeout = setTimeout(() => {
      if (active) {
        console.warn('[Font] Ionicons load timed out after 3s — continuing anyway.');
        setFontsLoaded(true);
      }
    }, 3000);
    (async () => {
      try {
        await Font.loadAsync(Ionicons.font);
        if (active) {
          console.log('[Font] Ionicons loadAsync resolved. isLoaded =', Font.isLoaded('ionicons'));
        }
      } catch (e) {
        console.error('[Font] Failed to load Ionicons:', e);
      } finally {
        clearTimeout(timeout);
        if (active) setFontsLoaded(true); // always proceed — never block on the font
      }
    })();
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, []);

  // Tag crash reports + PostHog with the signed-in account (id + role only, never PII).
  useEffect(() => {
    // Wait for session restoration before identifying/resetting analytics. Resetting
    // during the initial null-user render would rotate the anonymous ID while the
    // SDK is capturing Application Installed / Application Opened.
    if (initializing) return;
    try {
      setObservabilityUser(user ? { id: user.id, role: user.role } : null);
      if (user) {
        posthog.identify(String(user.id), { role: String(user.role) });
        setAnalyticsUserId(String(user.id));
      } else {
        posthog.reset();
        setAnalyticsUserId(null);
      }
    } catch (e) {
      reportError(e, { where: 'RootNavigator.setObservabilityUser' });
    }
  }, [initializing, user, setAnalyticsUserId]);

  // Screen funnel: fire once per navigation. `pathname` changes on every route
  // push/replace/back, and the route pattern is used as `screen_name` so no
  // dynamic ids leak into analytics. Role is the coarse account type only.
  const userRole = user ? String(user.role) : 'guest';
  useEffect(() => {
    trackEvent('screen_view', {
      screen_name: screenName,
      user_role: userRole,
    });
  }, [pathname, screenName, userRole]);

  // Hide the native splash the first frame we can render (loading screen).
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Why: the previous unconditional `requestPermissionsAsync()` at startup
  // asked without context. Ask once, with a rationale, and never on the location
  // screen where it would stack on top of the GPS permission dialog.
  const notificationPromptedRef = useRef(false);
  useEffect(() => {
    if (initializing || !fontsLoaded || notificationPromptedRef.current) return undefined;
    if (pathname === '/' || pathname.startsWith('/onboarding/location')) return undefined;

    const timer = setTimeout(() => {
      if (notificationPromptedRef.current) return;
      notificationPromptedRef.current = true;
      void promptForNotificationPermissionOnce();
    }, 700);

    return () => clearTimeout(timer);
  }, [initializing, fontsLoaded, pathname]);

  // Tapping a "Nayi kaam ki request 🛠️" push opens the Job Requests tab once
  // the session is restored (route exists only for signed-in workers).
  useHireRequestNotificationRoute(!initializing && Boolean(user));

  // Keep the loading screen visible until the stored session is restored
  // AND the icon font has loaded (prevents 'X' boxes on tabs/headers).
  if (initializing || !fontsLoaded) return <AppLoading />;

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.primaryDark,
          headerTitleStyle: { color: colors.textPrimary },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding/location" />
        <Stack.Screen name="onboarding/role" />
        <Stack.Screen name="role-selection" />
        <Stack.Screen name="welcome" />
        {/* These routes render their OWN custom <Header/> (brand bar + back
            chevron + top-inset handling). The native Stack header must stay
            OFF here — showing both stacked two title bars and a dead white
            band below the real header. */}
        <Stack.Screen name="worker/[id]" options={{ headerShown: false, title: t('workerScreen.title') }} />
        <Stack.Screen
          name="hire/[workerId]"
          options={{ headerShown: true, title: t('hire.bookWorkerTitle'), headerBackTitle: t('common.back') }}
        />
        <Stack.Screen name="hire/detail/[id]" options={{ headerShown: false, title: t('hireDetail.title') }} />
        <Stack.Screen name="hire/feedback/[id]" options={{ headerShown: true, title: t('feedback.title'), headerBackTitle: t('common.back') }} />
        <Stack.Screen name="/help/faq" />
        <Stack.Screen name="register-worker" options={{ headerShown: false, title: t('profile.joiningAs') }} />
        <Stack.Screen name="edit-profile" options={{ headerShown: false, title: t('profile.editProfile') }} />
        <Stack.Screen name="search" options={{ headerShown: true, title: t('dashboard.searchWorkers'), headerBackTitle: t('common.back') }} />
        <Stack.Screen name="map" options={{ headerShown: false, title: t('map.title') }} />
      </Stack>
      {/* Rapido/Porter-style in-app push banner — slides down under the status
          bar when a new job request notification arrives. */}
      <TopNotificationBanner />
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PostHogProvider client={posthog}>
          <AuthProvider>
            <ModeProvider>
              <StatusBar style="dark" />
              <RootNavigator />
            </ModeProvider>
          </AuthProvider>
        </PostHogProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  loadingTitle: {
    marginTop: spacing.md,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  loadingSpinner: { marginTop: spacing.xl },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: fontSize.caption,
    color: colors.textSecondary,
  },
});
