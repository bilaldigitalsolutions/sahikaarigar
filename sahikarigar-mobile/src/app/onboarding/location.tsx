// Location Step — the manual "Apna Area Chuno" screen is REMOVED. This screen
// now silently picks the current GPS location (reverse-geocoded to an area
// name), saves it to AsyncStorage `user_location`, and forwards to the role
// screen ("Aap Kaun Hain?"). Permission denied / GPS failure falls back to the
// default Hyderabad area so a user is never stuck here.
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { BrandLogo, Screen } from '@/components';
import { setLocation } from '@/lib/storage';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

/** Default area when GPS is unavailable or permission is denied. */
const DEF = 'Madhapur';

export default function LocationStep() {
  const router = useRouter();
  const [status, setStatus] = useState<'locating' | 'saved'>('locating');
  const routedRef = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      let area = DEF;
      try {
        const { status: perm } = await Location.requestForegroundPermissionsAsync();
        if (perm === 'granted') {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (pos?.coords) {
            try {
              const rev = await Location.reverseGeocodeAsync({
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
              });
              if (rev.length > 0) {
                const first = rev[0];
                area = first.street || first.district || first.city || first.region || first.name || DEF;
              }
            } catch {
              // Reverse geocode failed — the raw GPS fix still counts; DEF keeps
              // the flow moving.
            }
          }
        }
        // Permission denied → DEF; either way we save and move on.
      } catch {
        // GPS/network error → DEF.
      }
      if (!active) return;
      try {
        await setLocation(area);
      } catch {
        // Storage failure must not trap the user on this screen.
      }
      if (!active) return;
      setStatus('saved');
      if (!routedRef.current) {
        routedRef.current = true;
        router.replace('/onboarding/role' as never);
      }
    })();
    return () => {
      active = false;
    };
  }, [router]);

  return (
    <Screen scroll={false}>
      <View style={styles.center}>
        <BrandLogo size={44} showWordmark={false} />
        <Text style={styles.title}>{status === 'saved' ? 'Ho gaya!' : 'Location le rahe hain…'}</Text>
        <Text style={styles.sub}>
          Aas-paas ke kaarigar aur jobs dikhane ke liye aapki current location use ho rahi hai.
        </Text>
        <ActivityIndicator color={colors.primaryDark} style={styles.spinner} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  title: {
    marginTop: spacing.lg,
    fontSize: fontSize.h2,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  sub: {
    marginTop: spacing.sm,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  spinner: { marginTop: spacing.xl },
});
