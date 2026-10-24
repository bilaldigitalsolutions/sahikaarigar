import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

type Tone =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'primary'
  | 'gold'
  | 'silver'
  | 'bronze';

export interface BadgeProps {
  label: string;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
}

const TONES: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: '#F3F4F6', fg: colors.textSecondary },
  success: { bg: '#DCFCE7', fg: '#166534' },
  warning: { bg: '#FEF9C3', fg: '#854D0E' },
  danger: { bg: '#FEE2E2', fg: '#991B1B' },
  primary: { bg: '#DCFCE7', fg: colors.primaryDark },
  gold: { bg: '#FEF3C7', fg: '#92400E' },
  silver: { bg: '#E5E7EB', fg: '#374151' },
  bronze: { bg: '#FCE7D6', fg: '#9A3412' },
};

export function Badge({ label, tone = 'neutral', style }: BadgeProps) {
  const palette = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }, style]}>
      <Text style={[styles.text, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  text: { fontSize: fontSize.caption - 1, fontWeight: fontWeight.semibold },
});
