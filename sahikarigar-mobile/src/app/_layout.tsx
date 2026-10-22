import { Stack, usePathname, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Font from 'expo-font';
import { Ionicons } from '@expo/vector-icons';

import { BrandLogo, TopNotificationBanner } from '@/components';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ModeProvider } from '@/contexts/ModeContext';
import { requestLocationPermission } from '@/lib/location';
import {
  configureNotificationHandler,
  requestNotificationPermission,
  useHireRequestNotificationRoute,
} from '@/lib/notifications';
import { initObservability, POSTHOG_HOST, reportError, setObservabilityUser, trackEvent } from '@/lib/observability';
import { PostHogProvider } from 'posthog-react-native';
import { PostHog } from 'posthog-react-native';
const posthog = new PostHog(process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '', { host: POSTHOG_HOST });
import { colors, fontSize, fontWeight, spacing } from '@/theme';

SplashScreen.preventAutoHideAsync();

// Crash reporting boots first — every later init is wrapped so a failure lands
// in Sentry instead of a silent blank screen.
initObservability();

// Show hire status banners even while the app is open.
configureNotificationHandler();

/**
 * Shown while the stored session is being restored — the native splash screen
 * hides as soon as this mounts, so the user always sees the brand + spinner
 * instead of a blank frame.
 */
function AppLoading() {
  return (
    <View style={styles.loading}>
      <BrandLogo size={64} showWordmark={false} />
      <Text style={styles.loadingTitle}>Sahi Kaarigar</Text>
      <ActivityIndicator color={colors.primaryDark} style={styles.loadingSpinner} />
      <Text style={styles.loadingText}>Loading…</Text>
    </View>
  );
}

function RootNavigator() {
  const { initializing, user } = useAuth();
  const pathname = usePathname();
  const segments = useSegments();
  // Route pattern without dynamic ids, e.g. "worker/[id]" or "(tabs)/index".
  const screenName = segments.join('/') || 'index';

  // Vector icons (Ionicons) must be loaded via Font.loadAsync BEFORE any screen
  // renders, otherwise tab bar icons and header back chevrons show as 'X' boxes.
  // useFonts hook can be unreliable in Expo Router root layout; manual loadAsync
  // with SplashScreen gate is the proven pattern.
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await Font.loadAsync(Ionicons.font);
        if (active) setFontsLoaded(true);
      } catch (e) {
        // Even if font load fails, unblock the UI so tabs show text labels
        if (active) setFontsLoaded(true);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Tag crash reports + PostHog with the signed-in account (id + role only, never PII).
  useEffect(() => {
    try {
      setObservabilityUser(user ? { id: user.id, role: user.role } : null);
      if (user) {
        posthog.identify(String(user.id), { role: String(user.role) });
      } else {
        posthog.reset();
      }
    } catch (e) {
      reportError(e, { where: 'RootNavigator.setObservabilityUser' });
    }
  }, [user]);

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

  // Ask for location + notification permission ONCE at startup, so the user
  // is never prompted in the middle of searching or booking. Best-effort —
  // denying either one just disables nearby sorting / push updates.
  useEffect(() => {
    void requestLocationPermission();
    void requestNotificationPermission();
  }, []);

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
        <Stack.Screen name="worker/[id]" options={{ headerShown: true, title: 'Worker Profile', headerBackTitle: 'Back' }} />
        <Stack.Screen
          name="hire/[workerId]"
          options={{ headerShown: true, title: 'Book a Worker', headerBackTitle: 'Back' }}
        />
        <Stack.Screen name="hire/detail/[id]" options={{ headerShown: true, title: 'Booking Details', headerBackTitle: 'Back' }} />
        <Stack.Screen name="hire/feedback/[id]" options={{ headerShown: true, title: 'Feedback', headerBackTitle: 'Back' }} />
        <Stack.Screen name="/help/faq" />
        <Stack.Screen name="register-worker" options={{ headerShown: true, title: 'Join as Kaarigar', headerBackTitle: 'Back' }} />
        <Stack.Screen name="edit-profile" options={{ headerShown: true, title: 'Edit Profile', headerBackTitle: 'Back' }} />
        <Stack.Screen name="search" options={{ headerShown: true, title: 'Search Workers', headerBackTitle: 'Back' }} />
        <Stack.Screen name="map" options={{ headerShown: true, title: 'Map', headerBackTitle: 'Back' }} />
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
        <PostHogProvider
          apiKey={process.env.EXPO_PUBLIC_POSTHOG_KEY}
          options={{ host: POSTHOG_HOST }}
        >
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
