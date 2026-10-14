import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fontWeight, spacing } from '@/theme';

export interface BrandLogoProps {
  /** Show the "SahiKaarigar" wordmark next to the mark. */
  showWordmark?: boolean;
  /** Side length of the square mark in px. */
  size?: number;
  /** Wordmark colour (defaults to the dark text colour). */
  textColor?: string;
}

/**
 * The SahiKaarigar brand logo — a green rounded square with crossed tools and
 * the "SahiKaarigar" wordmark (matches the design header).
 */
export function BrandLogo({
  showWordmark = true,
  size = 30,
  textColor = colors.textPrimary,
}: BrandLogoProps) {
  return (
    <View style={styles.row}>
      <View
        style={[
          styles.mark,
          {
            width: size,
            height: size,
            borderRadius: size * 0.28,
            backgroundColor: colors.primary,
          },
        ]}
      >
        <Ionicons name="construct" size={Math.round(size * 0.6)} color={colors.white} />
      </View>
      {showWordmark ? (
        <Text style={[styles.wordmark, { fontSize: size * 0.72, color: textColor }]}>
          Sahi Kaarigar
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mark: { alignItems: 'center', justifyContent: 'center' },
  wordmark: { fontWeight: fontWeight.bold },
});
