// Role Step — "Aap Kaun Hain?" Cards drive tabs via ModeContext, persisted to
// AsyncStorage `user_role` + flag `has_seen_onboarding`. Worker without a
// backend profile goes to registration first. Back button returns to location.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandLogo, Screen } from '@/components';
import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { setHasSeenOnboarding } from '@/lib/storage';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';
export default function RoleStep() {
  const router = useRouter();
  const { user } = useAuth();
  const { role, roleChosen, hasWorkerProfile, setRole } = useMode();
  const done = async (r: 'worker' | 'employer') => {
    setRole(r);
    await setHasSeenOnboarding(true);
    if (r === 'worker') {
      router.replace(hasWorkerProfile ? '/(tabs)' : '/register-worker');
    } else {
      router.replace(user ? '/(tabs)' : '/(auth)/login');
    }
  };
  return (
    <Screen scroll>
      <Pressable onPress={() => router.replace('/onboarding/location' as never)} hitSlop={10} style={styles.back}>
        <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
      </Pressable>
      <View style={styles.head}>
        <BrandLogo size={44} showWordmark={false} />
        <Text style={styles.title}>Aap Kaun Hain?</Text>
        <Text style={styles.sub}>Choose karke app aapke liye set ho jayega. Profile se baad me switch kar sakte hain.</Text>
      </View>
      <RoleCard icon="construct-outline" title="Main Kaarigar Hoon" desc="Job requests receive karo, availability manage karo, kaam badhao." active={roleChosen && role === 'worker'} onPress={() => { void done('worker'); }} />
      <RoleCard icon="home-outline" title="Mujhe Kaarigar Hire Karna Hai" desc="Verified kaarigar dhundho, hire karo, kaam karwao." active={roleChosen && role === 'employer'} onPress={() => { void done('employer'); }} />
      <Text style={styles.note}>Note: Kaarigar banne ke liye chhota registration form bharna padega. Registration free hai.</Text>
    </Screen>
  );
}
function RoleCard({ icon, title, desc, active, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; desc: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.card, active && styles.cardActive]} onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }}>
      <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
        <Ionicons name={icon} size={30} color={active ? colors.white : colors.primaryDark} />
      </View>
      <View style={styles.info}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardDesc}>{desc}</Text></View>
      <Ionicons name={active ? 'checkmark-circle' : 'chevron-forward'} size={22} color={active ? colors.primaryDark : colors.textSecondary} />
    </Pressable>
  );
}
const styles = StyleSheet.create({
  back: { alignSelf: 'flex-start', marginTop: spacing.sm, marginLeft: -spacing.sm },
  head: { alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.xl },
  title: { marginTop: spacing.lg, fontSize: fontSize.h1, fontWeight: fontWeight.bold, color: colors.textPrimary },
  sub: { marginTop: spacing.sm, fontSize: fontSize.small, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 2, borderColor: colors.border, borderRadius: radius.card, backgroundColor: colors.card },
  cardActive: { borderColor: colors.primaryDark, backgroundColor: colors.primaryBg },
  iconWrap: { width: 58, height: 58, borderRadius: radius.button, backgroundColor: colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  iconWrapActive: { backgroundColor: colors.primaryDark },
  info: { flex: 1 },
  cardTitle: { fontSize: fontSize.title, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  cardDesc: { marginTop: spacing.xs, fontSize: fontSize.caption, color: colors.textSecondary, lineHeight: 17 },
  note: { marginTop: spacing.sm, fontSize: fontSize.caption, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 },
});
