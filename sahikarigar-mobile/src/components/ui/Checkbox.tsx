import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

export interface CheckboxProps {
  label: string;
  checked: boolean;
  onToggle: () => void;
}

/** A green checkbox row (used by the feedback "What did you like?" list). */
export function Checkbox({ label, checked, onToggle }: CheckboxProps) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked ? <Ionicons name="checkmark" size={16} color={colors.white} /> : null}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pressed: { opacity: 0.7 },
  box: {
    width: 24,
    height: 24,
    borderRadius: radius.sm - 2,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  boxChecked: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  label: { fontSize: fontSize.small, color: colors.textPrimary, fontWeight: fontWeight.medium },
});
