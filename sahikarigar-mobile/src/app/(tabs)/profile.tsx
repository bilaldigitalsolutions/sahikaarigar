import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Avatar, Badge, Button, Card, Screen } from '@/components';
import { LEGAL_URLS, areaLabel } from '@/constants';
import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { getLocation } from '@/lib/storage';
import { colors, fontSize, fontWeight, spacing } from '@/theme';
import { formatPhone } from '@/utils';
import { deleteAccount } from '@/lib/api';
import { useEffect, useState } from 'react';

const ROLE_LABEL: Record<string, string> = {
  worker: 'Kaarigar',
  employer: 'Employer',
  admin: 'Admin',
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { mode, canSwitch, setMode, role } = useMode();
  const [savedArea, setSavedArea] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getLocation().then((loc) => {
      if (active) setSavedArea(loc);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!user) return null;

  const onToggleMode = (next: boolean) => {
    setMode(next ? 'worker' : 'customer');
    // Land on the Home tab — its content follows the new mode (kaarigar
    // dashboard vs employer browse).
    router.replace('/(tabs)');
  };

  const onSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  /** Two-step in-app delete (Play policy). Server wipes the rows; the local
   *  session is cleared no matter what the network said. */
  const onDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'Ye permanent hai: aapki profile, bookings, reviews aur worker profile hamesha ke liye delete ho jayenge.',
      [
        { text: 'Ruko', style: 'cancel' },
        {
          text: 'Delete karo',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount();
            } catch {
              // ignore — sign out locally anyway so a failed request
              // never leaves the user stranded inside a dead account
            }
            await signOut();
            router.replace('/(auth)/login');
          },
        },
      ],
    );
  };

  return (
    <Screen scroll>
      <Text style={styles.heading}>Profile</Text>

      <Card style={styles.card}>
        <View style={styles.row}>
          <Avatar uri={user.avatar} name={user.name} size={64} />
          <View style={styles.info}>
            <Text style={styles.name}>{user.name}</Text>
            <Text style={styles.phone}>{formatPhone(user.phone)}</Text>
            <Badge label={ROLE_LABEL[user.role] ?? user.role} tone="primary" style={styles.badge} />
          </View>
        </View>
      </Card>

      <Card style={styles.card}>
        <InfoRow
          icon="location-outline"
          label="Area"
          value={user.locationArea ? areaLabel(user.locationArea) : 'Not set'}
        />
        <InfoRow
          icon="shield-checkmark-outline"
          label="Verification"
          value={user.isVerified ? 'Verified' : 'Pending'}
        />
        <InfoRow icon="star-outline" label="Trust Score" value={String(user.trustScore ?? 0)} />
      </Card>

      {canSwitch ? (
        <Card style={styles.switchCard}>
          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchTitle}>
                {mode === 'worker' ? 'Switch to Customer Mode' : 'Switch to Worker Mode'}
              </Text>
              <Text style={styles.switchSubtitle}>
                {mode === 'worker'
                  ? 'Hire workers for your own jobs.'
                  : 'Receive and manage job requests.'}
              </Text>
            </View>
            <Switch
              value={mode === 'worker'}
              onValueChange={onToggleMode}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>
        </Card>
      ) : null}

      <Card style={styles.card}>
        <Pressable
          style={styles.changeRoleRow}
          onPress={() => router.push('/onboarding/role' as never)}
          accessibilityRole="button"
        >
          <View style={styles.changeRoleInfo}>
            <Text style={styles.ctaTitle}>
              Change Role — {role === 'worker' ? 'Kaarigar' : 'Employer'}
            </Text>
            <Text style={styles.ctaText}>
              Aap kaun hain? screen se dobara chuno.{savedArea ? ` Saved area: ${savedArea}.` : ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
        </Pressable>
      </Card>

      {user.role === 'employer' ? (
        <Card style={styles.card}>
          <Text style={styles.ctaTitle}>Are you a worker?</Text>
          <Text style={styles.ctaText}>
            Add your skills and area to start receiving jobs from customers. Registration is free.
          </Text>
          <Button
            label="Join as Kaarigar"
            onPress={() => router.push('/register-worker')}
            style={styles.ctaBtn}
          />
        </Card>
      ) : null}

      <Card style={styles.card}>
        <Text style={styles.ctaTitle}>Your details</Text>
        <Text style={styles.ctaText}>
          Name, area, city aur address yahan se update kar sakte hain.
        </Text>
        <Button
          label="Edit Profile"
          variant="secondary"
          onPress={() => router.push('/edit-profile')}
          style={styles.ctaBtn}
        />
      </Card>

      <Button
        label="Sign Out"
        variant="secondary"
        onPress={onSignOut}
        style={styles.signOut}
      />

      <Text style={styles.legalNote}>
        Terms &amp; Privacy hamari website par hain — tap karo:
      </Text>
      <View style={styles.legalRow}>
        <Text
          style={styles.legalLink}
          onPress={() => Linking.openURL(LEGAL_URLS.terms).catch(() => {})}
        >
          Terms
        </Text>
        <Text style={styles.legalDot}>•</Text>
        <Text
          style={styles.legalLink}
          onPress={() => Linking.openURL(LEGAL_URLS.privacy).catch(() => {})}
        >
          Privacy
        </Text>
      </View>

      <Button
        label="Delete Account"
        variant="danger"
        onPress={onDeleteAccount}
        style={styles.deleteBtn}
      />
    </Screen>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={20} color={colors.textSecondary} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: fontSize.h2,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  card: { marginBottom: spacing.lg },
  switchCard: { marginBottom: spacing.lg, padding: spacing.lg },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  switchInfo: { flex: 1 },
  switchTitle: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  switchSubtitle: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  info: { marginLeft: spacing.lg, flex: 1 },
  name: { fontSize: fontSize.title, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  phone: { fontSize: fontSize.small, color: colors.textSecondary, marginTop: 2 },
  badge: { marginTop: spacing.sm },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  infoLabel: { fontSize: fontSize.small, color: colors.textSecondary, flex: 1 },
  infoValue: { fontSize: fontSize.small, color: colors.textPrimary, fontWeight: fontWeight.medium },
  ctaTitle: { fontSize: fontSize.body, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  ctaText: { fontSize: fontSize.caption, color: colors.textSecondary, marginTop: spacing.xs },
  ctaBtn: { marginTop: spacing.md },
  changeRoleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  changeRoleInfo: { flex: 1 },
  signOut: { marginTop: spacing.sm },
  legalNote: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  legalLink: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.primaryDark,
    textDecorationLine: 'underline',
  },
  legalDot: { fontSize: fontSize.caption, color: colors.textSecondary },
  deleteBtn: { marginTop: spacing.lg },
});
