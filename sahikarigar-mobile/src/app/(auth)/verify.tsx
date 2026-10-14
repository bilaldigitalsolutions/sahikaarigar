import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Input, Screen } from '@/components';
import { useAuth } from '@/contexts/AuthContext';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';
import { formatPhone } from '@/utils';

export default function VerifyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ skill?: string; area?: string }>();
  const { confirmOtp, resend, busy, pendingPhone, devOtp } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onVerify = async () => {
    if (code.trim().length !== 6) {
      setError('Enter the 6-digit OTP.');
      return;
    }
    setError(null);
    try {
      await confirmOtp(code.trim());

      // Every login lands on the Role Selection screen ("Aap kaun hain?")
      // first — it forwards any search intent onward after the pick.
      const skill = params.skill ? String(params.skill) : undefined;
      const area = params.area ? String(params.area) : undefined;
      router.replace({
        pathname: '/role-selection',
        params: { ...(skill ? { skill } : {}), ...(area ? { area } : {}) },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'OTP verification failed. Please try again.');
    }
  };

  const onResend = async () => {
    setError(null);
    try {
      await resend();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not resend the OTP.');
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Enter OTP</Text>
          <Text style={styles.subtitle}>
            {pendingPhone
              ? `Code sent to ${formatPhone(pendingPhone)}`
              : 'Enter the code sent to your number'}
          </Text>
        </View>

        <Input
          label="6-digit OTP"
          placeholder="123456"
          keyboardType="number-pad"
          maxLength={6}
          value={code}
          onChangeText={setCode}
          error={error ?? undefined}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={onVerify}
        />

        {devOtp ? (
          <View style={styles.devBox}>
            <Text style={styles.devTitle}>Development OTP</Text>
            <Text style={styles.devCode}>{devOtp}</Text>
            <Pressable style={styles.autofill} onPress={() => setCode(devOtp)}>
              <Text style={styles.autofillText}>Tap to autofill</Text>
            </Pressable>
            <Text style={styles.devHint}>
              SMS is not configured on the server, so the code is shown here.
            </Text>
          </View>
        ) : (
          <Text style={styles.smsHint}>
            Didn&apos;t receive the code? Tap “Resend OTP”. While the server runs with the console
            SMS provider, the OTP is printed on the server console.
          </Text>
        )}

        <Button label="Verify" onPress={onVerify} loading={busy} size="lg" />
        <Button label="Resend OTP" onPress={onResend} variant="ghost" disabled={busy} />
        <Button label="Change number" onPress={() => router.back()} variant="ghost" disabled={busy} />
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
});
