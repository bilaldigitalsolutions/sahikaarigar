import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from './Button';
import { Input } from './Input';
import { useAuth } from '@/contexts/AuthContext';
import { DEMO_MODE } from '@/lib/config';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';
import { isValidPhone, normalizeIndianPhone } from '@/utils';

export interface OtpVerifierProps {
  /** Heading shown above the form. */
  title: string;
  /** Optional helper line under the heading. */
  subtitle?: string;
  /** Prefills the mobile-number field (e.g. the signed-in user's number). */
  defaultPhone?: string;
  /** Label for the final action button. Defaults to "Verify & continue". */
  actionLabel?: string;
  /** Called once the OTP has been verified and a session exists. */
  onVerified: () => void;
}

/**
 * Self-contained phone-OTP step. Sends a 6-digit code via the auth server and
 * verifies it using the shared {@link useAuth} flow, then calls `onVerified`.
 */
export function OtpVerifier({
  title,
  subtitle,
  defaultPhone = '',
  actionLabel = 'Verify & continue',
  onVerified,
}: OtpVerifierProps) {
  const { signIn, confirmOtp, resend, busy, pendingPhone, devOtp } = useAuth();

  const [phone, setPhone] = useState(defaultPhone);
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const normalized = normalizeIndianPhone(phone);
    if (!isValidPhone(normalized)) {
      setError('Enter a valid 10-digit mobile number (starting with 6, 7, 8 or 9).');
      return;
    }
    setError(null);
    try {
      await signIn(normalized);
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the OTP. Please try again.');
    }
  };

  const verify = async () => {
    if (code.trim().length !== 6) {
      setError('Enter the 6-digit OTP.');
      return;
    }
    setError(null);
    try {
      await confirmOtp(code.trim());
      onVerified();
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
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name="shield-checkmark" size={26} color={colors.primaryDark} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      {!sent ? (
        <View style={styles.form}>
          <Input
            label="Mobile Number"
            placeholder="98765 43210"
            keyboardType="phone-pad"
            maxLength={13}
            value={phone}
            onChangeText={setPhone}
            error={error ?? undefined}
            hint="A 6-digit OTP will be sent to this number"
            returnKeyType="done"
            onSubmitEditing={send}
            // Block Android autofill — the OS injects the signed-in user's
            // phone number here, overriding the defaultPhone from AuthContext.
            autoComplete="off"
            textContentType="none"
            importantForAutofill="no"
          />
          <Button label="Send OTP" onPress={send} loading={busy} size="lg" />
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.sentTo}>
            Code sent to{' '}
            <Text style={styles.sentToValue}>{pendingPhone ? `+91 ${pendingPhone}` : phone}</Text>
          </Text>

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
            onSubmitEditing={verify}
          />

          {devOtp && DEMO_MODE ? (
            <View style={styles.devBox}>
              <Text style={styles.devLabel}>Development OTP</Text>
              <Text style={styles.devCode}>{devOtp}</Text>
              <Text style={styles.devAutofill} onPress={() => setCode(devOtp)}>
                Tap to autofill
              </Text>
            </View>
          ) : null}

          <Button label={actionLabel} onPress={verify} loading={busy} size="lg" />
          <Button label="Resend OTP" variant="ghost" onPress={onResend} disabled={busy} />
          <Button
            label="Change number"
            variant="ghost"
            disabled={busy}
            onPress={() => {
              setSent(false);
              setCode('');
              setError(null);
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: radius.card,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  subtitle: {
    fontSize: fontSize.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  form: { marginTop: spacing.md },
  sentTo: { fontSize: fontSize.caption, color: colors.textSecondary, marginBottom: spacing.md },
  sentToValue: { fontWeight: fontWeight.semibold, color: colors.textPrimary },
  devBox: {
    alignItems: 'center',
    backgroundColor: colors.primaryBg,
    borderRadius: radius.button,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  devLabel: { fontSize: fontSize.caption - 1, fontWeight: fontWeight.semibold, color: colors.primaryDark },
  devCode: {
    fontSize: 30,
    fontWeight: fontWeight.bold,
    color: colors.primaryDark,
    letterSpacing: 6,
    marginVertical: 2,
  },
  devAutofill: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.primaryDark },
});

