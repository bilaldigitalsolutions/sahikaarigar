import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Input, Screen } from '@/components';
import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { setAnalyticsUserId, trackEvent } from '@/lib/observability';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';
import { formatPhone } from '@/utils';

export default function VerifyScreen() {
  const router = useRouter();
  const { role, roleChosen, ready } = useMode();
  const params = useLocalSearchParams<{ skill?: string; area?: string; next?: string }>();
  const { confirmOtp, resend, busy, pendingPhone, devOtp } = useAuth();
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** Explicit consent to data processing (DPDP requirement). */
  const [consentGiven, setConsentGiven] = useState(false);

  const onVerify = async () => {
    if (code.trim().length !== 6) {
      setError(t('auth.enterOtp'));
      return;
    }
    if (!consentGiven) {
      setError(t('auth.consentRequired'));
      return;
    }
    setError(null);
    try {
      // confirmOtp resolves the fresh backend user. Its `role` is 'worker' only
      // when the worker_profiles row exists (upsertWorkerProfile flips it), so
      // routing can trust it instead of guessing client-side.
      const me = await confirmOtp(code.trim());
      if (!me?.id) throw new Error(t('auth.userNotFound'));
      // Signup lifecycle event — through the SINGLE shared PostHog client, with
      // the freshly issued user id as the analytics distinct_id.
      setAnalyticsUserId(me.id);
      trackEvent('user_signup', { user_id: me.id });

      // A Hire-time login carries `next` (e.g. /hire/<workerId>) — resume the
      // exact booking the guest started instead of dropping them on Home.
      const next = params.next ? String(params.next) : undefined;
      if (next && next.startsWith('/')) {
        router.replace(next as never);
        return;
      }

      // Role never picked (new user / fresh install) — "Aap kaun hain?"
      // decides the next step (it smart-routes Kaarigars itself).
      if (!ready || !roleChosen) {
        const skill = params.skill ? String(params.skill) : undefined;
        const area = params.area ? String(params.area) : undefined;
        router.replace({
          pathname: '/role-selection',
          params: { ...(skill ? { skill } : {}), ...(area ? { area } : {}) },
        });
        return;
      }

      if (me.role === 'worker') {
        // Smart worker routing: profile exists → straight to the dashboard
        // (it renders "Verification Pending" until an admin approves, then the
        // live stats). No profile yet → the registration form first.
        router.replace(me.role === 'worker' ? '/(tabs)' : '/register-worker');
        return;
      }

      // Employer mode — the kaarigar home / search.
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.otpVerificationFailed'));
    }
  };

  const onResend = async () => {
    setError(null);
    try {
      await resend();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.couldNotResendOtp'));
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t('auth.otpScreen')}</Text>
          <Text style={styles.subtitle}>
            {pendingPhone
              ? t('auth.otpSent', { phone: formatPhone(pendingPhone) })
              : t('auth.otpSentDefault')}
          </Text>
        </View>

        <Input
          label={t('auth.otp6DigitLabel')}
          placeholder={t('auth.otpPlaceholder')}
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={setCode}
          error={error ?? undefined}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={onVerify}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          textContentType="none"
          importantForAutofill="no"
        />

        {devOtp ? (
          <View style={styles.devBox}>
            <Text style={styles.devTitle}>{t('auth.devOtp')}</Text>
            <Text style={styles.devCode}>{devOtp}</Text>
            <Pressable style={styles.autofill} onPress={() => setCode(devOtp)}>
              <Text style={styles.autofillText}>{t('auth.devOtpTap')}</Text>
            </Pressable>
            <Text style={styles.devHint}>{t('auth.devOtpHint')}</Text>
          </View>
        ) : (
          <Text style={styles.smsHint}>
            {t('auth.didntReceiveCode')} {t('auth.tapResend')}. {t('auth.smsNote')}
          </Text>
        )}

        {/* DPDP consent — explicit agreement required before OTP verification. */}
        <View style={styles.consentRow}>
          <Pressable
            style={[styles.consentBox, consentGiven && styles.consentBoxChecked]}
            onPress={() => setConsentGiven(!consentGiven)}
          />
          <Text style={styles.consentText} numberOfLines={3}>
            {t('auth.consentPrefix')}{' '}
            <Text style={styles.consentLink} onPress={() => Linking.openURL('https://sahi-kaarigar.web.app/privacy')}>
              {t('auth.privacyPolicy')}
            </Text>{' '}
            {t('auth.consentSuffix')}
          </Text>
        </View>

        <Button
          label={t('auth.loginButton')}
          onPress={onVerify}
          loading={busy}
          size="lg"
          disabled={!consentGiven}
        />
        <Button label={t('auth.resendOtp')} onPress={onResend} variant="ghost" disabled={busy} />
        <Button label={t('auth.changeNumber')} onPress={() => router.back()} variant="ghost" disabled={busy} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { marginTop: spacing.xxl, marginBottom: spacing.xl },
  title: { fontSize: fontSize.h1, fontWeight: fontWeight.bold, color: colors.textPrimary },
  subtitle: { marginTop: spacing.xs, fontSize: fontSize.small, color: colors.textSecondary },
  devBox: {
    alignItems: 'center',
    backgroundColor: colors.primaryBg,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  devTitle: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.primaryDark },
  devCode: {
    fontSize: 34,
    fontWeight: fontWeight.bold,
    color: colors.primaryDark,
    letterSpacing: 6,
    marginVertical: spacing.xs,
  },
  autofill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryDark,
  },
  autofillText: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.white },
  devHint: {
    marginTop: spacing.md,
    fontSize: fontSize.caption - 1,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  smsHint: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  consentBox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  consentBoxChecked: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  consentText: {
    flex: 1,
    fontSize: fontSize.caption - 1,
    color: colors.textSecondary,
    lineHeight: spacing.lg,
  },
  consentLink: {
    color: colors.primaryDark,
    fontWeight: fontWeight.semibold,
    textDecorationLine: 'underline',
  },
});
