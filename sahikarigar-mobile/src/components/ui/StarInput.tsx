import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

export interface StarInputProps {
  value: number;
  onChange: (value: number) => void;
  size?: number;
  count?: number;
}

/** Tappable star rating input (feedback form). */
export function StarInput({ value, onChange, size = 30, count = 5 }: StarInputProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }, (_, i) => i + 1).map((star) => {
        const active = star <= value;
        return (
          <Pressable
            key={star}
            onPress={() => onChange(star)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`${star} star`}
          >
            <Ionicons
              name={active ? 'star' : 'star-outline'}
              size={size}
              color={active ? colors.star : colors.muted}
              style={styles.star}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  star: { marginRight: spacing.xs },
});
