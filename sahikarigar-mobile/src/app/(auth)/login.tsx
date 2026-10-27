import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { BrandLogo, Button, Input, Screen } from '@/components';
import { useAuth } from '@/contexts/AuthContext';
import { colors, fontSize, fontWeight, spacing } from '@/theme';
import { isFakePhoneSequence, isValidPhone, normalizeIndianPhone } from '@/utils';

/** Official DPDP consent notice link for this app listing. */
const PRIVACY_POLICY_URL = 'https://appland.info/app/33336/privacy-policy';

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ skill?: string; area?: string; next?: string }>();
  const { signIn, busy } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

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
          ? 'Ye fake/test number allow nahi hai — apna asli mobile number daalo.'
          : 'Enter a valid 10-digit mobile number (starting with 6, 7, 8 or 9).',
      );
      return;
    }
    setError(null);
    try {
      await signIn(normalized, name.trim());
      router.push({ pathname: '/(auth)/verify', params: searchParams });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
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
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </Pressable>

        <View style={styles.hero}>
          <BrandLogo size={56} showWordmark={false} />
          <Text style={styles.title}>Sahi Kaarigar</Text>
          <Text style={styles.subtitle}>Talk directly with verified workers in Hyderabad</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Your name"
            placeholder="e.g. Bilal"
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
            label="Mobile Number"
            placeholder="9876543210"
            keyboardType="number-pad"
            maxLength={10}
            value={phone}
            onChangeText={setPhone}
            error={error ?? undefined}
            hint="A 6-digit OTP will be sent to your number"
            returnKeyType="done"
            onSubmitEditing={onSubmit}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            textContentType="none"
            importantForAutofill="no"
            containerStyle={styles.mt}
          />

          {/*
           * DPDP consent notice. There is deliberately NO pre-ticked checkbox:
           * tapping "Continue" is the affirmative action that records consent.
           */}
          <Text style={styles.consent}>
            By continuing, you agree to our{' '}
            <Text
              style={styles.consentLink}
              onPress={() => Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})}
              accessibilityRole="link"
            >
              Privacy Policy
            </Text>{' '}
            and consent to the collection of your phone number and location for the purpose of booking home services.
          </Text>

          <Button
            label="Continue"
            onPress={onSubmit}
            loading={busy}
            size="lg"
            disabled={!phoneReady}
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
  consent: {
    marginTop: spacing.lg,
    textAlign: 'center',
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  consentLink: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    color: colors.primaryDark,
    textDecorationLine: 'underline',
  },
});
