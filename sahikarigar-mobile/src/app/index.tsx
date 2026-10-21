import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { getHasSeenOnboarding, getLocation, getRole } from '@/lib/storage';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

/** Tagline shown under the logo. */
const TAGLINE = 'Trusted Kaarigar, Har Kaam Ke Liye';

export default function LoadingScreen() {
  const router = useRouter();
  const { user, initializing } = useAuth();
  const routedRef = useRef(false);

  useEffect(() => {
    if (routedRef.current) return;
    // Route as soon as the session restore finishes - no artificial delay.
    if (initializing) return;
    routedRef.current = true;

    (async () => {
      if (user) {
        const storedRole = await getRole();
        const onboarded = await getHasSeenOnboarding();
        if (storedRole) {
          router.replace('/(tabs)');
          return;
        }
        router.replace((onboarded ? '/role-selection' : '/onboarding/role') as never);
        return;
      }

      const location = await getLocation();
      router.replace((location ? '/onboarding/role' : '/onboarding/location') as never);
    })().catch(() => {
      routedRef.current = false;
    });
  }, [initializing, user, router]);

  return (
    <View style={styles.container}>
      <Image
        source={require('../../assets/images/loading-banner.png')}
        style={styles.banner}
        resizeMode="cover"
      />
      <View style={styles.content}>
        <Text style={styles.tagline}>{TAGLINE}</Text>
        <View style={styles.spinnerWrap}>
          <ActivityIndicator size="large" color={colors.white} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#16A34A' },
  banner: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, width: '100%' },
  tagline: { fontSize: 20, fontWeight: '700', color: '#fff', textAlign: 'center', marginBottom: 12 },
  spinnerWrap: { marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 16 },
});