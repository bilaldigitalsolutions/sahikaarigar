// Location Step — requests Android runtime permission, lets the user save an
// area, persists to AsyncStorage `user_location`, then moves to role pick.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandLogo, Button, LocationPicker, Screen, type PlaceResult } from '@/components';
import { setLocation } from '@/lib/storage';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';
const DEF = 'Madhapur';
export default function LocationStep() {
  const router = useRouter();
  const [area, setArea] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [perm, setPerm] = useState<'ask' | 'granted' | 'denied'>('ask');
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        setPerm(status === 'granted' ? 'granted' : 'denied');
      } catch { setPerm('denied'); }
    })();
  }, []);
  const pick = useCallback(async (desc: string) => {
    setBusy(true);
    try { await setLocation(desc); setArea(desc); router.replace('/onboarding/role' as never); }
    catch { Alert.alert('Error', 'Could not save location. Try again.'); }
    finally { setBusy(false); }
  }, [router]);
  const onSelect = (p: PlaceResult) => { void pick(p.description); };
  const useGPS = async () => {
    setBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setPerm('denied'); return; }
      setPerm('granted');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (pos?.coords) {
        try {
          const rev = await Location.reverseGeocodeAsync({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          if (rev.length > 0) {
            const first = rev[0];
            const area =
              first.street ||
              first.city ||
              first.region ||
              first.name ||
              DEF;
            await pick(area);
            return;
          }
        } catch {}
      }
      await pick(DEF);
    } catch { await pick(DEF); } finally { setBusy(false); }
  };
  return (
    <Screen scroll>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
        <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
      </Pressable>
      <View style={styles.head}>
        <BrandLogo size={44} showWordmark={false} />
        <Text style={styles.title}>Apna Area Chuno</Text>
        <Text style={styles.sub}>Aas-paas ke kaarigar aur jobs dikhane ke liye.</Text>
      </View>
      {perm === 'ask' ? (
        <View style={styles.ask}><ActivityIndicator color={colors.primaryDark} /><Text style={styles.askT}>Location permission maang rahe hain…</Text></View>
      ) : null}
      {perm === 'denied' ? (
        <View style={styles.warn}><Text style={styles.warnT}>Permission denied hai — GPS band rahega, list se area chuno.</Text></View>
      ) : null}
      <Pressable style={styles.gps} onPress={useGPS} disabled={busy}>
        <Ionicons name="locate" size={20} color={colors.primaryDark} />
        <Text style={styles.gpsT}>Use current location</Text>
        {busy ? <ActivityIndicator color={colors.primaryDark} /> : <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />}
      </Pressable>
      <View style={styles.pickWrap}>
        <LocationPicker placeholder="Search area — e.g. Madhapur, LB Nagar" value={area} onSelect={onSelect} />
      </View>
      <Button label="Skip (Madhapur)" variant="ghost" disabled={busy} onPress={() => { void pick(DEF); }} />
    </Screen>
  );
}
const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', marginTop: spacing.sm, marginLeft: -spacing.sm },
  head: { alignItems: 'center', marginTop: spacing.lg, marginBottom: spacing.lg },
  title: { marginTop: spacing.md, fontSize: fontSize.h2, fontWeight: fontWeight.bold, color: colors.textPrimary },
  sub: { marginTop: spacing.xs, fontSize: fontSize.small, color: colors.textSecondary, textAlign: 'center' },
  ask: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  askT: { fontSize: fontSize.caption, color: colors.textSecondary },
  warn: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.warning, padding: spacing.md, borderRadius: radius.card, marginBottom: spacing.lg },
  warnT: { fontSize: fontSize.caption, color: colors.warning, textAlign: 'center' },
  gps: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.card, backgroundColor: colors.primaryTint, marginBottom: spacing.lg },
  gpsT: { flex: 1, fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  pickWrap: { marginBottom: spacing.lg },
});
