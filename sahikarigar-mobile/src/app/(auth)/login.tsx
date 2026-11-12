import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BrandLogo, Button, Input, LanguageToggle, Screen } from '@/components';
import { useAuth } from '@/contexts/AuthContext';
import { colors, fontSize, fontWeight, spacing } from '@/theme';
import { isFakePhoneSequence, isValidPhone, normalizeIndianPhone } from '@/utils';

/** Official DPDP consent notice link for this app listing. */
const PRIVACY_POLICY_URL = 'https://appland.info/app/33336/privacy-policy';

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ skill?: string; area?: string; next?: string }>();
  const { signIn, busy, user } = useAuth();
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** Explicit consent to data processing (DPDP requirement). */
  const [consentGiven, setConsentGiven] = useState(false);

  // A signed-in worker must never be shown the OTP form again. This is a
  // safety net in addition to (auth)/_layout and the worker-login entry point.
  useEffect(() => {
    if (user?.role === 'worker') {
      router.replace('/(tabs)');
    }
  }, [user, router]);

  /** Where to land after OTP — a deep link (e.g. a hire page) wins. */
  const next = params.next ? String(params.next) : undefined;

  /** Forward the search intent (if any) on to the OTP screen. */
  const searchParams: { skill?: string; area?: string; next?: string } = {};
  if (params.skill) searchParams.skill = String(params.skill);
  if (params.area) searchParams.area = String(params.area);
  if (next) searchParams.next = next;

  const onSubmit = async () => {
    const normalized = normalizeIndianPhone(phone);
    if (!phoneReady) {
      setError(
        isFakePhoneSequence(normalized)
          ? t('auth.fakePhoneNotAllowed')
          : t('auth.invalidPhone'),
      );
      return;
    }
    setError(null);
    try {
      await signIn(normalized, name.trim());
      router.push({ pathname: '/(auth)/verify', params: searchParams });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.somethingWentWrongTryAgain'));
    }
  };

  /** Strict phone gate — button stays dead until a REAL number is typed. */
  const normalizedPhone = normalizeIndianPhone(phone);
  const phoneReady = isValidPhone(normalizedPhone) && !isFakePhoneSequence(normalizedPhone);

  return (
    <Screen scroll>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable
          style={styles.back}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </Pressable>

        <View style={styles.hero}>
          <BrandLogo size={56} showWordmark={false} />
          <Text style={styles.title}>{t('common.appName')}</Text>
          <Text style={styles.subtitle}>{t('auth.loginSubtitle')}</Text>
        </View>

        {/* Language pills — reachable while logged out, so a user who picked
            the wrong language never has to sign in to fix it. */}
        <LanguageToggle />

        <View style={styles.form}>
          <Input
            label={t('auth.yourName')}
            placeholder={t('auth.namePlaceholder')}
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (error) setError(null);
            }}
            maxLength={50}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
          />
          <Input
            label={t('auth.mobileNumber')}
            placeholder={t('auth.mobilePlaceholder')}
            keyboardType="number-pad"
            maxLength={10}
            value={phone}
            onChangeText={setPhone}
            error={error ?? undefined}
            hint={t('auth.otpWillBeSent')}
            returnKeyType="done"
            onSubmitEditing={onSubmit}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            textContentType="none"
            importantForAutofill="no"
            containerStyle={styles.mt}
          />

          {/* DPDP consent — explicit agreement required before continuing. */}
          <View style={styles.consentRow}>
            <Pressable
              style={[styles.consentBox, consentGiven && styles.consentBoxChecked]}
              onPress={() => setConsentGiven(!consentGiven)}
            />
            <Text style={styles.consentText} numberOfLines={3}>
              {t('auth.consentAgreePrefix')}{' '}
              <Text
                style={styles.consentLink}
                onPress={() => Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})}
                accessibilityRole="link"
              >
                {t('auth.termsConditions')}
              </Text>{' '}
              {t('auth.consentAnd')}{' '}
              <Text
                style={styles.consentLink}
                onPress={() => Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})}
                accessibilityRole="link"
              >
                {t('auth.privacyPolicy')}
              </Text>
            </Text>
          </View>

          <Button
            label={t('common.continue')}
            onPress={onSubmit}
            loading={busy}
            size="lg"
            disabled={!phoneReady || !consentGiven}
            style={styles.mt}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  back: { alignSelf: 'flex-start', marginTop: spacing.sm, marginLeft: -spacing.sm },
  hero: { alignItems: 'center', marginTop: spacing.xxl, marginBottom: spacing.xxl },
  title: { fontSize: fontSize.h1, fontWeight: fontWeight.bold, color: colors.textPrimary, marginTop: spacing.md },
  subtitle: {
    marginTop: spacing.xs,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  form: { marginTop: spacing.lg },
  mt: { marginTop: spacing.md },
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
