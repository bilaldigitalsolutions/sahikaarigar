import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, Pressable, StyleSheet, Text, View, Modal } from 'react-native';

import { Avatar, Badge, Button, Card, Screen } from '@/components';
import { LEGAL_URLS, areaLabel } from '@/constants';
import { useAuth } from '@/contexts/AuthContext';
import { getLocation } from '@/lib/storage';
import { getWorkerProfile } from '@/lib/api';
import { setAppLanguage, type SupportedLanguage } from '@/lib/i18n';
import { colors, fontSize, fontWeight, radius, shadows, spacing } from '@/theme';
import { formatPhone, formatRatingSummary } from '@/utils';
import { deleteUserAccount } from '@/lib/api';
import { useCallback, useEffect, useRef, useState } from 'react';

const ROLE_LABEL: Record<string, string> = {
  worker: 'common.kaarigar',
  employer: 'common.employer',
  admin: 'common.admin',
};

export default function ProfileScreen() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const { user, signOut, refreshUser } = useAuth();
  const [savedArea, setSavedArea] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [workerProfile, setWorkerProfile] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

  // Fetch the worker's profile from the backend to get isApproved /
  // verificationStatus. The AuthContext `user` object only has `isVerified`
  // (from the users table); the admin approval flag lives on worker_profiles.
  const loadWorkerProfile = useCallback(async () => {
    if (!user) return;
    try {
      const profile = await getWorkerProfile();
      setWorkerProfile(profile);
    } catch (e) {
      console.error('[Profile] getWorkerProfile failed:', e);
      setWorkerProfile(null);
    }
  }, [user]);

  // The loader is called through a ref so the focus effect stays referentially
  // stable — otherwise re-creating the callback on every `user` change would
  // make useFocusEffect re-run and loop: refreshUser -> setUser -> refetch.
  const loadWorkerProfileRef = useRef(loadWorkerProfile);
  loadWorkerProfileRef.current = loadWorkerProfile;

  // Re-fetch on EVERY focus of the Profile tab. This is the fix for
  // "Verification: Pending" sticking after the admin approves: the approval
  // only changes server-side data, so the app must re-read it on focus
  // instead of relying on the `user` object cached at app start.
  useFocusEffect(
    useCallback(() => {
      void loadWorkerProfileRef.current();
      void refreshUser().catch(() => {});
    }, []),
  );

  const refreshProfile = async () => {
    setRefreshing(true);
    try {
      await refreshUser();
      await loadWorkerProfile();
    } catch {
      // ignore — profile may not exist for employers
    } finally {
      setRefreshing(false);
    }
  };

  // Guest employers can open Profile from the tab bar — show a login prompt
  // instead of crashing on `user.*` below.
  if (!user) {
    return (
      <Screen scroll>
        <Text style={styles.heading}>{t('common.profile')}</Text>
        <Card style={styles.card}>
          <Text style={styles.ctaTitle}>{t('profile.guestCtaTitle')}</Text>
          <Text style={styles.ctaText}>
            {t('profile.guestCtaText')}
            {savedArea ? ` ${t('profile.savedArea', { area: savedArea })}` : ''}
          </Text>
          <Button label={t('auth.loginOrSignUp')} onPress={() => router.push('/(auth)/login')} style={styles.ctaBtn} />
        </Card>
      </Screen>
    );
  }

  // `signOut()` performs the full stack reset and lands on /welcome, so no
  // extra navigation here — doing it in both places raced the reset.
  const onSignOut = async () => {
    await signOut();
  };

  // The backend creates a nameless account with the placeholder "User" on the
  // first sign-in (the app never asked for a name before). Detect that and
  // prompt the user to complete the profile instead of showing "User".
  const needsName = !user.name || user.name.trim().length < 2 || user.name === 'User';
  const displayName = needsName ? '' : user.name;

  /** DPDP / Play policy in-app deletion. The server removes the database
   *  rows and uploaded documents; only then do we clear the local session and
   *  send the user back to login. */
  const onDeleteAccount = () => {
    Alert.alert(
      t('profile.deleteAccount'),
      t('profile.deleteAccountMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteUserAccount();
            } catch (e) {
              Alert.alert(
                t('profile.deleteFailedTitle'),
                e instanceof Error ? e.message : t('profile.deleteFailedMessage'),
              );
              return;
            }
            // The account is gone; clear the local session even if the
            // server-side session revoke itself fails.
            await signOut('/(auth)/login').catch(() => {});
          },
        },
      ],
    );
  };

  return (
    <Screen scroll>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>{t('common.profile')}</Text>
        <Pressable
          onPress={refreshProfile}
          disabled={refreshing}
          hitSlop={10}
          accessibilityLabel={t('profile.refresh')}
        >
          <Ionicons
            name={refreshing ? 'sync-outline' : 'refresh-outline'}
            size={22}
            color={colors.primaryDark}
          />
        </Pressable>
      </View>

      {needsName ? (
        <Card style={styles.card}>
          <Text style={styles.ctaTitle}>{t('profile.completeTitle')}</Text>
          <Text style={styles.ctaText}>
            {t('profile.completeText')}
          </Text>
          <Button
            label={t('profile.addName')}
            onPress={() => router.push('/edit-profile')}
            style={styles.ctaBtn}
          />
        </Card>
      ) : null}

      <Card style={styles.card}>
        <View style={styles.row}>
          <Avatar uri={user.avatar} name={displayName} size={64} />
          <View style={styles.info}>
            {needsName ? (
              <Pressable
                style={styles.namePrompt}
                onPress={() => router.push('/edit-profile')}
                accessibilityRole="button"
              >
                <Text style={styles.namePromptText}>{t('profile.addName')}</Text>
                <Text style={styles.namePromptSub}>{t('profile.tapToComplete')} ›</Text>
              </Pressable>
            ) : (
              <Text style={styles.name}>{user.name}</Text>
            )}
            <Text style={styles.phone}>{formatPhone(user.phone)}</Text>
            <Badge label={t(ROLE_LABEL[user.role] ?? 'common.user')} tone="primary" style={styles.badge} />
          </View>
        </View>
        <View style={styles.infoGap} />
        <InfoRow
          icon="location-outline"
          label={t('common.area')}
          value={user.locationArea ? areaLabel(user.locationArea) : t('profile.notSet')}
        />
        <InfoRow
          icon="shield-checkmark"
          label={t('common.verification')}
          value={
            workerProfile?.isApproved
              ? t('common.approved')
              : workerProfile?.verificationStatus
                ? String(workerProfile.verificationStatus)
                : user.isVerified
                  ? t('common.verified')
                  : t('common.pending')
          }
        />
        {user.role === 'worker' ? (
          <>
            <InfoRow
              icon="star-half"
              label={t('rating.workerLabel')}
              value={formatRatingSummary(
                {
                  average: workerProfile?.ratingAverage ?? 0,
                  count: workerProfile?.ratingCount ?? 0,
                },
                t,
              )}
            />
            {/* Computed server-side from live profile data — the users.trust_score
                column is legacy and always 0, so never read it here. */}
            <InfoRow
              icon="star"
              label={t('profile.trustScore')}
              value={String(workerProfile?.trustScore ?? 0)}
            />
          </>
        ) : user.role === 'employer' ? (
          <InfoRow
            icon="star-half"
            label={t('rating.customerLabel')}
            value={formatRatingSummary(
              { average: user.customerRatingAverage, count: user.customerRatingCount },
              t,
            )}
          />
        ) : null}
      </Card>

      {user.role === 'employer' ? (
        <Card style={styles.card}>
          <Text style={styles.ctaTitle}>{t('profile.areYouWorker')}</Text>
          <Text style={styles.ctaText}>
            {t('profile.areYouWorkerText')}
          </Text>
          <Button
            label={t('profile.joiningAs')}
            onPress={() => router.push('/register-worker')}
            style={styles.ctaBtn}
          />
        </Card>
      ) : null}

      <Card style={styles.card}>
        <Text style={styles.ctaTitle}>{t('profile.yourDetails')}</Text>
        <Text style={styles.ctaText}>
          {t('profile.detailsSub')}
        </Text>
        <Button
          label={t('profile.editProfile')}
          variant="secondary"
          onPress={() => router.push('/edit-profile')}
          style={styles.ctaBtn}
        />
      </Card>

      {/* Language — English / Telugu toggle. The choice persists and re-renders
          every translated screen instantly (i18next changeLanguage). */}
      <Card style={styles.card}>
        <Text style={styles.ctaTitle}>{t('language.label')}</Text>
        <View style={styles.langRow}>
          {(['en', 'te'] as const).map((lang) => {
            const selected = i18n.language.startsWith(lang);
            return (
              <Pressable
                key={lang}
                style={[styles.langBtn, selected && styles.langBtnActive]}
                onPress={() => void setAppLanguage(lang as SupportedLanguage)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text
                  style={[styles.langBtnText, selected && styles.langBtnTextActive]}
                >
                  {t(`language.${lang}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Button
        label={t('common.signOut')}
        variant="secondary"
        onPress={onSignOut}
        style={styles.signOut}
      />

      <Button
        label={t('profile.deleteAccount')}
        variant="danger"
        onPress={onDeleteAccount}
        style={styles.deleteBtn}
      />

      <Text style={styles.legalNote}>
        {t('profile.legalNote')}
      </Text>
      <View style={styles.legalRow}>
        <Text
          style={styles.legalLink}
          onPress={() => Linking.openURL(LEGAL_URLS.terms).catch(() => {})}
        >
          {t('profile.termsLink')}
        </Text>
        <Text style={styles.legalDot}>•</Text>
        <Text
          style={styles.legalLink}
          onPress={() => Linking.openURL(LEGAL_URLS.privacy).catch(() => {})}
        >
          {t('profile.privacyLink')}
        </Text>
      </View>

      <Text style={styles.helpNote}>
        {t('profile.responsibilityNote')}
      </Text>
      <Card style={styles.helpCard}>
        <Text style={styles.helpTitle}>{t('profile.grievanceOfficer')}</Text>
        <View style={styles.helpBody}>
          <View style={styles.helpRow}>
            <Text style={styles.helpKey}>{t('common.name')}:</Text>
            <Text style={styles.helpValue}>Mohammad Bilal</Text>
          </View>
          <View style={styles.helpRow}>
            <Text style={styles.helpKey}>{t('common.email')}:</Text>
            <Text style={styles.helpValue}>grievance@sahikaarigar.com</Text>
          </View>
          <View style={styles.helpRow}>
            <Text style={styles.helpKey}>{t('common.phone')}:</Text>
            <Text style={styles.helpValue}>+91 9949363310</Text>
          </View>
          <View style={styles.helpRow}>
            <Text style={styles.helpKey}>{t('common.address')}:</Text>
            <Text style={styles.helpValue}>Hyderabad, Telangana</Text>
          </View>
          <View style={styles.helpRow}>
            <Text style={styles.helpKey}>{t('profile.responseTime')}:</Text>
            <Text style={styles.helpValue}>{t('profile.responseTimeValue')}</Text>
          </View>
        </View>
      </Card>

      <Card style={styles.helpCard}>
        <Text style={styles.helpTitle}>{t('profile.helpSupport')}</Text>
        <Pressable style={styles.helpOption} onPress={onHelpSheetOpen}>
          <Ionicons name="logo-whatsapp" size={20} color={colors.primaryDark} />
          <View style={styles.helpOptionText}>
            <Text style={styles.helpOptionLabel}>{t('profile.whatsappSupport')}</Text>
            <Text style={styles.helpOptionDesc}>{t('profile.supportAsap')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>
        <Pressable style={styles.helpOption} onPress={onHelpSheetOpen}>
          <Ionicons name="call" size={20} color={colors.primaryDark} />
          <View style={styles.helpOptionText}>
            <Text style={styles.helpOptionLabel}>{t('profile.callSupport')}</Text>
            <Text style={styles.helpOptionDesc}>+91 9949363310</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>
        <Pressable style={styles.helpOption} onPress={onHelpSheetOpen}>
          <Ionicons name="mail" size={20} color={colors.primaryDark} />
          <View style={styles.helpOptionText}>
            <Text style={styles.helpOptionLabel}>{t('profile.emailSupport')}</Text>
            <Text style={styles.helpOptionDesc}>support@sahikaarigar.com</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>
        <Pressable style={styles.helpOption} onPress={() => router.push('/help/faq' as any)}>
          <Ionicons name="help-circle" size={20} color={colors.primaryDark} />
          <View style={styles.helpOptionText}>
            <Text style={styles.helpOptionLabel}>{t('profile.faqs')}</Text>
            <Text style={styles.helpOptionDesc}>{t('profile.faqsSub')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>
      </Card>

      {/* Build identity — lets QA confirm which CI run is installed without
          guessing from an identical versionName/versionCode. */}
      <Text style={styles.buildStamp}>
        {`v${Application.nativeApplicationVersion ?? '1.0.28'} (${Application.nativeBuildVersion ?? '36'}) - build ${process.env.EXPO_PUBLIC_BUILD_ID ?? 'dev'}`}
      </Text>

      <Modal visible={showHelp} transparent animationType="fade" onRequestClose={onHelpSheetClose}>
        <View style={styles.helpOverlay}>
          <Pressable style={styles.helpOverlayTouchable} onPress={onHelpSheetClose} accessibilityLabel={t('profile.closeHelpSupport')}>
            <Pressable style={styles.helpModal} onPress={() => {}}>
              <View style={styles.helpModalHeader}>
                <View style={styles.helpModalIconBox}>
                  <Ionicons name="help-circle" size={20} color={colors.primaryDark} />
                </View>
                <Text style={styles.helpModalTitle}>{t('profile.helpSupport')}</Text>
                <Pressable
                  onPress={onHelpSheetClose}
                  hitSlop={12}
                  accessibilityLabel={t('common.close')}
                  style={styles.helpModalClose}
                >
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </Pressable>
              </View>
              <Text style={styles.helpModalMessage}>
                {t('profile.helpModalMessage')}
              </Text>
              <View style={styles.helpModalButtons}>
                <Pressable
                  style={styles.helpModalButton}
                  onPress={() => Linking.openURL('https://wa.me/919949363310').catch(() => {})}
                >
                  <Ionicons name="logo-whatsapp" size={20} color={colors.primaryDark} />
                  <View style={styles.helpModalButtonLabel}>
                    <Text style={styles.helpModalButtonText}>{t('profile.whatsapp')}</Text>
                    <Text style={styles.helpModalButtonDesc}>{t('profile.replyInMinutes')}</Text>
                  </View>
                </Pressable>
                <Pressable
                  style={styles.helpModalButton}
                  onPress={() => Linking.openURL('tel:+919949363310').catch(() => {})}
                >
                  <Ionicons name="call" size={20} color={colors.primaryDark} />
                  <View style={styles.helpModalButtonLabel}>
                    <Text style={styles.helpModalButtonText}>{t('common.call')}</Text>
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
                    <Text style={styles.helpModalButtonText}>{t('common.email')}</Text>
                    <Text style={styles.helpModalButtonDesc}>support@sahikaarigar.com</Text>
                  </View>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </View>
      </Modal>
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
      <View style={styles.infoIconWrap}>
        <Ionicons name={icon} size={22} color={colors.primaryDark} />
      </View>
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  card: { marginBottom: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center' },
  info: { marginLeft: spacing.lg, flex: 1 },
  name: { fontSize: fontSize.title, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  // "Apna naam add karo" — the tappable stand-in for a missing name.
  namePrompt: { alignSelf: 'flex-start' },
  namePromptText: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.semibold,
    color: colors.primaryDark,
  },
  namePromptSub: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  phone: { fontSize: fontSize.small, color: colors.textSecondary, marginTop: 2 },
  badge: { marginTop: spacing.sm },
  infoGap: { height: spacing.md },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  infoIconWrap: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
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
  langRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  langBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  langBtnActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  langBtnText: {
    fontSize: fontSize.small,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  langBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: fontWeight.semibold,
  },
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
  buildStamp: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.lg,
    opacity: 0.7,
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
  deleteBtn: { marginTop: spacing.sm },
});
