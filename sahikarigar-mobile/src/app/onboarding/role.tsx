// Role Step — "Aap Kaun Hain?" Cards drive tabs via ModeContext, persisted to
// AsyncStorage `user_role` + flag `has_seen_onboarding`. Worker without a
// backend profile goes to registration first. Back button returns to location.
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BrandLogo, LanguageToggle, Screen } from '@/components';
import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { setHasSeenOnboarding } from '@/lib/storage';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';
export default function RoleStep() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { role, roleChosen, setRole } = useMode();
  const done = async (r: 'worker' | 'employer') => {
    setRole(r);
    await setHasSeenOnboarding(true);
    if (r === 'worker') {
      // Already signed in as a worker → dashboard. A signed-in account that
      // has not completed worker registration → the registration form.
      // A logged-out visitor enters the worker registration flow (the form
      // sends them through OTP first because registration needs a verified
      // mobile number).
      if (user?.role === 'worker') {
        router.replace('/(tabs)' as never);
      } else {
        router.replace('/register-worker' as never);
      }
    } else {
      // Employers browse as guests; login is asked only at Hire time.
      router.replace('/(tabs)' as never);
    }
  };
  return (
    <Screen scroll>
      <Pressable onPress={() => router.replace('/onboarding/location' as never)} hitSlop={10} style={styles.back}>
        <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
      </Pressable>
      <View style={styles.head}>
        <BrandLogo size={44} showWordmark={false} />
        <Text style={styles.title}>{t('auth.onboardingRole')}</Text>
        <Text style={styles.sub}>
          {t('onboarding.roleSub')}
        </Text>
      </View>
      {/* Language pills — this is the first screen guests see on app start,
          so language must be changeable here without signing in. */}
      <LanguageToggle />
      <RoleCard icon="construct-outline" title={t('onboarding.workerCardTitle')} desc={t('onboarding.workerCardDesc')} active={roleChosen && role === 'worker'} onPress={() => { void done('worker'); }} />
      <RoleCard icon="home-outline" title={t('onboarding.employerCardTitle')} desc={t('onboarding.employerCardDesc')} active={roleChosen && role === 'employer'} onPress={() => { void done('employer'); }} />
      <Text style={styles.note}>{t('onboarding.roleNote')}</Text>
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
