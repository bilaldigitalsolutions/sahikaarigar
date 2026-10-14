import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

const HEIGHTS: Record<Size, number> = { sm: 40, md: 48, lg: 56 };

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = true,
  icon,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.base,
        { height: HEIGHTS[size] },
        variantStyles[variant].container,
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles[variant].text.color} />
      ) : (
        <>
          {icon}
          <Text style={[styles.label, variantStyles[variant].text, icon ? styles.labelWithIcon : null]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.button,
    paddingHorizontal: spacing.lg,
  },
  fullWidth: { alignSelf: 'stretch' },
  label: { fontSize: fontSize.small, fontWeight: fontWeight.semibold },
  labelWithIcon: { marginLeft: spacing.sm },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});

const variantStyles: Record<Variant, { container: ViewStyle; text: { color: string } }> = {
  primary: {
    container: { backgroundColor: colors.primaryDark },
    text: { color: colors.white },
  },
  secondary: {
    container: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
    text: { color: colors.primaryDark },
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    text: { color: colors.primaryDark },
  },
  danger: {
    container: { backgroundColor: colors.danger },
    text: { color: colors.white },
  },
};
