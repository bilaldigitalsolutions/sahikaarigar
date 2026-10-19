// =============================================================================
// Loading / Splash Screen — Step 1 of the onboarding flow.
// =============================================================================
// Shows the brand logo + tagline + spinner for a MINIMUM of 2.5 seconds while
// the session restores and onboarding state loads, then routes automatically:
//
//   logged-in + role chosen  -> role dashboard (/(tabs))
//   logged-in, no role yet   -> /onboarding/role   (skip: already onboarded)
//   location missing         -> /onboarding/location
//   location ok, no role     -> /onboarding/role
// =============================================================================

import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { getHasSeenOnboarding, getLocation, getRole } from '@/lib/storage';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

/** Tagline shown under the logo. */
const TAGLINE = 'Trusted Kaarigar, Har Kaam Ke Liye';

/** Minimum time this screen stays visible (ms) — just long enough for the
 *  brand to register; the real gate is the session restore completing. */
const MIN_LOAD_TIME = 2500;

export default function LoadingScreen() {
  const router = useRouter();
  const { user, initializing } = useAuth();
  const [elapsed, setElapsed] = useState(0);
  const routedRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((prev) => prev + 100), 100);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (routedRef.current) return;
    if (initializing || elapsed < MIN_LOAD_TIME) return;
    routedRef.current = true;

    (async () => {
      // Logged-in returning user who already picked a role — straight to the dashboard.
      if (user) {
        const storedRole = await getRole();
        const onboarded = await getHasSeenOnboarding();
        if (storedRole) {
          router.replace('/(tabs)');
          return;
        }
        // Logged in but never picked a role — location was captured earlier or
        // defaults at search time; just ask the role question.
        router.replace((onboarded ? '/role-selection' : '/onboarding/role') as never);
        return;
      }

      // Fresh launch — location first, then role, then login.
      const location = await getLocation();
      router.replace((location ? '/onboarding/role' : '/onboarding/location') as never);
    })().catch(() => {
      routedRef.current = false;
    });
  }, [elapsed, initializing, user, router]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Loading banner — the new branded artwork. `contain` keeps the full
            image visible on every screen size, no awkward cropping. */}
        <Image
          source={require('../../assets/images/loading-banner.png')}
          style={styles.banner}
          resizeMode="contain"
        />
        <Text style={styles.tagline}>{TAGLINE}</Text>
        {/* Spinner block pinned towards the bottom, unchanged. */}
        <View style={styles.spinnerWrap}>
          <ActivityIndicator size="large" color={colors.white} />
          <Text style={styles.elapsed}>{Math.floor(elapsed / 1000)}s</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primaryDark,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    width: '100%',
  },
  // Banner spans the width; "contain" derives height so it never crops.
  banner: {
    width: '100%',
    height: 320,
    marginBottom: spacing.lg,
  },
  tagline: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
    color: colors.white,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.md,
  },
  // Pushes the spinner towards the bottom of the screen (loading "overlay").
  spinnerWrap: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  elapsed: {
    fontSize: fontSize.caption,
    color: colors.white,
    opacity: 0.7,
  },
});