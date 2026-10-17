import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandLogo, Screen } from '@/components';
import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

/**
 * "Aap kaun hain?" — the first screen after login.
 *
 * The choice drives the whole UI (see `(tabs)/_layout.tsx`) and is remembered
 * across launches via ModeContext (`user_role` in AsyncStorage). Picking
 * Kaarigar without a completed worker profile continues to the registration
 * form; the backend then promotes `users.role` to 'worker' automatically.
 */
export default function RoleSelectionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ skill?: string; area?: string }>();
  const { user } = useAuth();
  const { role, roleChosen, hasWorkerProfile, setRole } = useMode();

  // A search intent from before login — forward it to the employer home.
  const skill = params.skill ? String(params.skill) : undefined;
  const area = params.area ? String(params.area) : undefined;

  const chooseEmployer = () => {
    setRole('employer');
    if (!user) {
      // Guest employer — browse without login.
      router.replace('/(tabs)');
      return;
    }
    if (skill || area) {
      router.replace({
        pathname: '/(tabs)/search',
        params: { ...(skill ? { skill } : {}), ...(area ? { area } : {}) },
      });
    } else {
      router.replace('/(tabs)');
    }
  };

  const chooseWorker = () => {
    setRole('worker');
    if (!user) {
      // Workers must log in first.
      router.replace('/(auth)/login');
      return;
    }
    if (hasWorkerProfile) {
      // Registration already done — straight to the kaarigar dashboard.
      router.replace('/(tabs)');
    } else {
      // No profile yet — documents / registration form comes first.
      router.replace('/register-worker');
    }
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <BrandLogo size={44} showWordmark={false} />
        <Text style={styles.title}>Aap kaun hain?</Text>
        <Text style={styles.subtitle}>
          Choose karke app aapke liye set ho jayega. Aap baad me Profile se switch kar sakte hain.
        </Text>
      </View>

      <RoleCard
        icon="construct-outline"
        title="Main Kaarigar Hoon"
        desc="Naye job requests receive karo, apni availability manage karo aur kaam badhao."
        active={roleChosen && role === 'worker'}
        onPress={chooseWorker}
      />

      <RoleCard
        icon="home-outline"
        title="Mujhe Kaam Karwana Hai"
        desc="Verified kaarigar dhundho, unhe hire karo aur apna kaam karwao."
        active={roleChosen && role === 'employer'}
        onPress={chooseEmployer}
      />

      <Text style={styles.note}>
        Note: Kaarigar banne ke liye ek chhota registration form bharna padega (skills, photos,
        rate). Registration free hai.
      </Text>
    </Screen>
  );
}

function RoleCard({
  icon,
  title,
  desc,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  desc: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.card, active && styles.cardActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
        <Ionicons name={icon} size={30} color={active ? colors.white : colors.primaryDark} />
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDesc}>{desc}</Text>
      </View>
      <Ionicons
        name={active ? 'checkmark-circle' : 'chevron-forward'}
        size={22}
        color={active ? colors.primaryDark : colors.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.xl },
  title: {
    marginTop: spacing.lg,
    fontSize: fontSize.h1,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: spacing.sm,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.card,
    backgroundColor: colors.card,
  },
  cardActive: { borderColor: colors.primaryDark, backgroundColor: colors.primaryBg },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: radius.button,
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: colors.primaryDark },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: fontSize.title, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  cardDesc: { marginTop: spacing.xs, fontSize: fontSize.caption, color: colors.textSecondary, lineHeight: 17 },
  note: {
    marginTop: spacing.sm,
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});