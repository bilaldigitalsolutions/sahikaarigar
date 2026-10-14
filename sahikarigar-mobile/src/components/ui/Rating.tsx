import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fontSize } from '@/theme';

export interface RatingProps {
  value: number;
  count?: number;
  size?: number;
}

/** Five-star rating with an optional review count. */
export function Rating({ value, count, size = 16 }: RatingProps) {
  const rounded = Math.round(value);
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons
          key={star}
          name={star <= rounded ? 'star' : 'star-outline'}
          size={size}
          color={colors.warning}
        />
      ))}
      <Text style={styles.value}>{value > 0 ? value.toFixed(1) : 'Naya'}</Text>
      {count !== undefined && count > 0 ? (
        <Text style={styles.count}>({count})</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  value: {
    marginLeft: 6,
    fontSize: fontSize.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  count: { marginLeft: 4, fontSize: fontSize.caption, color: colors.textSecondary },
});
