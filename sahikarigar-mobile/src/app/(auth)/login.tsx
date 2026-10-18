import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandLogo, Button, Input, Screen } from '@/components';
import { useAuth } from '@/contexts/AuthContext';
import { colors, fontSize, fontWeight, spacing } from '@/theme';
import { isValidPhone, normalizeIndianPhone } from '@/utils';

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ skill?: string; area?: string; next?: string }>();
  const { signIn, busy } = useAuth();
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
    if (!isValidPhone(normalized)) {
      setError('Enter a valid 10-digit mobile number (starting with 6, 7, 8 or 9).');
      return;
    }
    setError(null);
    try {
      await signIn(normalized);
      router.push({ pathname: '/(auth)/verify', params: searchParams });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    }
  };

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
          />
          <Button label="Send OTP" onPress={onSubmit} loading={busy} size="lg" />
        </View>

        <Text style={styles.terms}>
          By continuing you agree to our Terms &amp; Privacy Policy.
        </Text>
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
  terms: {
    marginTop: 'auto',
    textAlign: 'center',
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    paddingBottom: spacing.lg,
  },
});
