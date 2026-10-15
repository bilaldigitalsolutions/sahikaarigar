import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ModeProvider } from '@/contexts/ModeContext';
import { requestLocationPermission } from '@/lib/location';
import {
  configureNotificationHandler,
  requestNotificationPermission,
} from '@/lib/notifications';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

SplashScreen.preventAutoHideAsync();

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
  const { initializing } = useAuth();

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

  // Keep the loading screen visible until the stored session is restored.
  if (initializing) return <AppLoading />;

  return (
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
      <Stack.Screen name="worker/[id]" options={{ headerShown: false }} />
      <Stack.Screen
        name="hire/[workerId]"
        options={{ headerShown: true, title: 'Book a Worker', headerBackTitle: 'Back' }}
      />
      <Stack.Screen name="hire/detail/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="hire/feedback/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="register-worker" options={{ headerShown: false }} />
      <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
      <Stack.Screen name="search" options={{ headerShown: false }} />
      <Stack.Screen name="map" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ModeProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </ModeProvider>
        </AuthProvider>
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
