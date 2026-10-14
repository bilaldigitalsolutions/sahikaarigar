import { forwardRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

export interface RateInputProps extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  value: string;
  onChangeText: (text: string) => void;
  label?: string;
  error?: string;
  hint?: string;
  containerStyle?: ViewStyle;
}

/**
 * Numeric input for rate / price fields that aggressively blocks Android
 * autofill. The OS injects the signed-in user's phone number into any
 * TextInput that could hold one, so this component:
 *   - maxLength=10 so the full phone number can be injected and then rejected
 *   - onChangeText rejects anything > 5 digits (a rate is 1-5 digits)
 *   - onFocus clears the field if it holds 6+ digits (phone number fragment)
 *   - sets ALL autofill-blocking props (autoComplete, textContentType, etc.)
 */
export const RateInput = forwardRef<TextInput, RateInputProps>(function RateInput(
  { value, onChangeText, label, error, hint, containerStyle, style, onFocus, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);

  const handleChange = (text: string) => {
    // Keep only digits. A rate is 1-5 digits.
    const digits = text.replace(/\D/g, '');
    // Reject 10-digit phone numbers (autofill) — starts with 6-9
    if (digits.length >= 10 && /^[6-9]/.test(digits)) {
      onChangeText('');
      return;
    }
    // Cap at 5 digits for normal input (so typing a 6th digit just truncates)
    onChangeText(digits.slice(0, 5));
  };

  const handleFocus = (e: any) => {
    setFocused(true);
    // If a phone number leaked in (autofill bypassed onChangeText), wipe it.
    const digits = value.replace(/\D/g, '');
    if (digits.length > 5) {
      onChangeText('');
    }
    onFocus?.(e);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          focused && styles.focused,
          error ? styles.errorBorder : null,
          style,
        ]}
        keyboardType="number-pad"
        inputMode="numeric"
        // maxLength=10 lets the full phone number be injected so onChangeText
        // can reject it. If we cap at 5, autofill truncates to 86863 and we
        // can't tell it apart from a real rate.
        maxLength={10}
        autoComplete="off"
        textContentType="none"
        importantForAutofill="no"
        value={value}
        onChangeText={handleChange}
        onFocus={handleFocus}
        onBlur={() => setFocused(false)}
        {...rest}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { marginBottom: spacing.lg },
  label: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.body,
    color: colors.textPrimary,
    backgroundColor: colors.white,
  },
  focused: { borderColor: colors.primary },
  errorBorder: { borderColor: colors.danger },
  errorText: { color: colors.danger, fontSize: fontSize.caption, marginTop: spacing.xs },
  hint: { color: colors.textSecondary, fontSize: fontSize.caption, marginTop: spacing.xs },
});
