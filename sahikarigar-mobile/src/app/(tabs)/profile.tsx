import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Linking, Pressable, StyleSheet, Text, View, Modal } from 'react-native';

import { Avatar, Badge, Button, Card, Screen } from '@/components';
import { LEGAL_URLS, areaLabel } from '@/constants';
import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { getLocation } from '@/lib/storage';
import { colors, fontSize, fontWeight, radius, shadows, spacing } from '@/theme';
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
  const { role, setRole } = useMode();
  const [savedArea, setSavedArea] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const onHelpSheetOpen = (): void => {
    setShowHelp(true);
  };

  const onHelpSheetClose = (): void => {
    setShowHelp(false);
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

  /** Worker → employer browse mode. No inline switch anywhere else — this
   *  explicit card (a separate screen away from the jobs dashboard) is the
   *  only place kaarigars can change the app's role. */
  const switchToEmployer = () => {
    setRole('employer');
    router.replace('/(tabs)');
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

      {role === 'worker' ? (
        <Card style={styles.card}>
          <Text style={styles.ctaTitle}>Kaam karwana hai?</Text>
          <Text style={styles.ctaText}>
            Customer mode me jao — verified kaarigar dhundo aur hire karo. Aapki kaarigar
            profile safe rahegi.
          </Text>
          <Button
            label="Customer Mode Kholo"
            variant="secondary"
            onPress={switchToEmployer}
            style={styles.ctaBtn}
          />
        </Card>
      ) : null}

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
        <View style={styles.helpBody}>
          <View style={styles.helpRow}>
            <Text style={styles.helpKey}>Name:</Text>
            <Text style={styles.helpValue}>Mohammad Bilal</Text>
          </View>
          <View style={styles.helpRow}>
            <Text style={styles.helpKey}>Email:</Text>
            <Text style={styles.helpValue}>grievance@sahikaarigar.com</Text>
          </View>
          <View style={styles.helpRow}>
            <Text style={styles.helpKey}>Phone:</Text>
            <Text style={styles.helpValue}>+91 9949363310</Text>
          </View>
          <View style={styles.helpRow}>
            <Text style={styles.helpKey}>Address:</Text>
            <Text style={styles.helpValue}>Hyderabad, Telangana</Text>
          </View>
          <View style={styles.helpRow}>
            <Text style={styles.helpKey}>Response Time:</Text>
            <Text style={styles.helpValue}>48 hours</Text>
          </View>
        </View>
      </Card>

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
        <Pressable style={styles.helpOption} onPress={() => router.push('/help/faq' as any)}>
          <Ionicons name="help-circle" size={20} color={colors.primaryDark} />
          <View style={styles.helpOptionText}>
            <Text style={styles.helpOptionLabel}>FAQs</Text>
            <Text style={styles.helpOptionDesc}>Frequently asked questions</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>
      </Card>

      <Modal visible={showHelp} transparent animationType="fade" onRequestClose={onHelpSheetClose}>
        <View style={styles.helpOverlay}>
          <Pressable style={styles.helpOverlayTouchable} onPress={onHelpSheetClose} accessibilityLabel="Close Help & Support">
            <Pressable style={styles.helpModal} onPress={() => {}}>
              <View style={styles.helpModalHeader}>
                <View style={styles.helpModalIconBox}>
                  <Ionicons name="help-circle" size={20} color={colors.primaryDark} />
                </View>
                <Text style={styles.helpModalTitle}>Help &amp; Support</Text>
                <Pressable
                  onPress={onHelpSheetClose}
                  hitSlop={12}
                  accessibilityLabel="Close"
                  style={styles.helpModalClose}
                >
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </Pressable>
              </View>
              <Text style={styles.helpModalMessage}>
                Hum aapki madad ke liye hazir hain. WhatsApp par message karo, seedha call karo ya
                email likh do — support team turant reply karegi.
              </Text>
              <View style={styles.helpModalButtons}>
                <Pressable
                  style={styles.helpModalButton}
                  onPress={() => Linking.openURL('https://wa.me/919949363310').catch(() => {})}
                >
                  <Ionicons name="logo-whatsapp" size={20} color={colors.primaryDark} />
                  <View style={styles.helpModalButtonLabel}>
                    <Text style={styles.helpModalButtonText}>WhatsApp</Text>
                    <Text style={styles.helpModalButtonDesc}>Reply in minutes</Text>
                  </View>
                </Pressable>
                <Pressable
                  style={styles.helpModalButton}
                  onPress={() => Linking.openURL('tel:+919949363310').catch(() => {})}
                >
                  <Ionicons name="call" size={20} color={colors.primaryDark} />
                  <View style={styles.helpModalButtonLabel}>
                    <Text style={styles.helpModalButtonText}>Call</Text>
                    <Text style={styles.helpModalButtonDesc}>+91 99493 63310</Text>
                  </View>
                </Pressable>
                <Pressable
                  style={styles.helpModalButton}
                  onPress={() =>
                    Linking.openURL('mailto:support@sahikaarigar.com').catch(() => {})
                  }
                >
                  <Ionicons name="mail" size={20} color={colors.primaryDark} />
                  <View style={styles.helpModalButtonLabel}>
                    <Text style={styles.helpModalButtonText}>Email</Text>
                    <Text style={styles.helpModalButtonDesc}>support@sahikaarigar.com</Text>
                  </View>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </View>
      </Modal>

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
  infoValue: {
    flexShrink: 1,
    fontSize: fontSize.small,
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
    textAlign: 'right',
  },
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
    flexDirection: 'column',
  },
  helpRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  helpKey: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    width: 110,
  },
  helpValue: {
    flex: 1,
    fontSize: fontSize.caption,
    color: colors.textPrimary,
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
  /** Full-overlay transparent layer — tapping anywhere outside the card closes. */
  helpOverlayTouchable: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' },
  helpModal: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.xl,
    width: '88%',
    ...shadows.cardHover,
  },
  helpModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  helpModalIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.primaryBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpModalTitle: {
    flex: 1,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginLeft: spacing.md,
  },
  helpModalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpModalMessage: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  helpModalButtons: {
    gap: spacing.md,
  },
  helpModalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primaryTint,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  helpModalButtonLabel: { flex: 1 },
  helpModalButtonText: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
    color: colors.primaryDark,
  },
  helpModalButtonDesc: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },
  deleteBtn: { marginTop: spacing.lg },
});
