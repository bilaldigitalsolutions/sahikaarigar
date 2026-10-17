import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Linking, Pressable, StyleSheet, Text, View, Modal } from 'react-native';

import { Avatar, Badge, Button, Card, Screen } from '@/components';
import { LEGAL_URLS, areaLabel } from '@/constants';
import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { getLocation } from '@/lib/storage';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';
import { formatPhone } from '@/utils';
import { deleteAccount } from '@/lib/api';
import { useEffect, useRef, useState } from 'react';

const ROLE_LABEL: Record<string, string> = {
  worker: 'Kaarigar',
  employer: 'Employer',
  admin: 'Admin',
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { role } = useMode();
  const [savedArea, setSavedArea] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const onHelpSheetOpen = (): void => {
    setShowHelp(true);
  };

  useEffect(() => {
    let active = true;
    getLocation().then((loc) => {
      if (active) setSavedArea(loc);
    });
    return () => {
      active = false;
    };
  }, []);

  // Guest employers can open Profile from the tab bar — show a login prompt
  // instead of crashing on `user.*` below.
  if (!user) {
    return (
      <Screen scroll>
        <Text style={styles.heading}>Profile</Text>
        <Card style={styles.card}>
          <Text style={styles.ctaTitle}>Login karke profile dekho</Text>
          <Text style={styles.ctaText}>
            Guest mode me browse kar sakte ho — profile, bookings aur hire ke liye login zaroori hai.
            {savedArea ? ` Saved area: ${savedArea}.` : ''}
          </Text>
          <Button label="Login / Sign up" onPress={() => router.push('/(auth)/login')} style={styles.ctaBtn} />
        </Card>
      </Screen>
    );
  }

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

      <Text style={styles.helpNote}>
        Meri Zimmedari: Aapka complaint resolve ho, par agar koi problem aaye toh daye zaroor bataye.
      </Text>
      <Card style={styles.helpCard}>
        <Text style={styles.helpTitle}>Grievance Officer</Text>
        <Text style={styles.helpBody}>
          <Text style={styles.helpRow}><Text style={styles.helpKey}>Name:</Text> Mohammad Bilal</Text>
          <Text style={styles.helpRow}><Text style={styles.helpKey}>Email:</Text> grievance@sahikaarigar.com</Text>
          <Text style={styles.helpRow}><Text style={styles.helpKey}>Phone:</Text> +91 9949363310</Text>
          <Text style={styles.helpRow}><Text style={styles.helpKey}>Address:</Text> Hyderabad, Telangana</Text>
          <Text style={styles.helpRow}><Text style={styles.helpKey}>Response Time:</Text> 48 hours</Text>
        </Text>

      <Card style={styles.helpCard}>
        <Text style={styles.helpTitle}>Help &amp; Support</Text>
        <Pressable style={styles.helpOption} onPress={onHelpSheetOpen}>
          <Ionicons name="logo-whatsapp" size={20} color={colors.primaryDark} />
          <View style={styles.helpOptionText}>
            <Text style={styles.helpOptionLabel}>WhatsApp Support</Text>
            <Text style={styles.helpOptionDesc}>Support ASAP</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>
        <Pressable style={styles.helpOption} onPress={onHelpSheetOpen}>
          <Ionicons name="call" size={20} color={colors.primaryDark} />
          <View style={styles.helpOptionText}>
            <Text style={styles.helpOptionLabel}>Call Support</Text>
            <Text style={styles.helpOptionDesc}>+91 9949363310</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>
        <Pressable style={styles.helpOption} onPress={onHelpSheetOpen}>
          <Ionicons name="mail" size={20} color={colors.primaryDark} />
          <View style={styles.helpOptionText}>
            <Text style={styles.helpOptionLabel}>Email Support</Text>
            <Text style={styles.helpOptionDesc}>support@sahikaarigar.com</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>
      </Card>

      <Modal
        visible={showHelp}
        transparent
        animationType="fade"
      >
        <View style={styles.helpOverlay}>
          <View style={styles.helpModal}>
            <Text style={styles.helpModalTitle}>Help &amp; Support</Text>
            <Text style={styles.helpModalMessage}>
              Kaun ka kaunsi chahiye? WhatsApp par tap karo — camp ki sahayata. Call karo — direct support. Email karo — abhi reply aayegi.
            </Text>
            <View style={styles.helpModalButtons}>
              <Pressable style={styles.helpModalButton} onPress={() => Linking.openURL('https://wa.me/919949363310').catch(() => {})}>
                <Ionicons name="logo-whatsapp" size={18} color={colors.primaryDark} />
                <Text style={styles.helpModalButtonText}>WhatsApp</Text>
              </Pressable>
              <Pressable style={styles.helpModalButton} onPress={() => Linking.openURL('tel:+919949363310').catch(() => {})}>
                <Ionicons name="call" size={18} color={colors.primaryDark} />
                <Text style={styles.helpModalButtonText}>Call</Text>
              </Pressable>
              <Pressable style={styles.helpModalButton} onPress={() => Linking.openURL('mailto:support@sahikaarigar.com').catch(() => {})}>
                <Ionicons name="mail" size={18} color={colors.primaryDark} />
                <Text style={styles.helpModalButtonText}>Email</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      </Card>

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
  helpNote: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 20,
  },
  helpCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  helpTitle: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  helpBody: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  helpRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  helpKey: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    width: 72,
  },
  helpOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  helpOptionText: {
    flex: 1,
  },
  helpOptionLabel: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  helpOptionDesc: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },
  helpSheet: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
  },
  helpOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpModal: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
    width: '85%',
  },
  helpModalTitle: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  helpModalMessage: {
    fontSize: fontSize.small,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  helpModalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  helpModalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryTint,
    borderRadius: radius.button,
    paddingVertical: spacing.md,
  },
  helpModalButtonText: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.semibold,
    color: colors.primaryDark,
  },
  deleteBtn: { marginTop: spacing.lg },
});
