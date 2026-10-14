import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useMode, type AppMode } from '@/contexts/ModeContext';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

const OPTIONS: { value: AppMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'customer', label: 'Customer', icon: 'home-outline' },
  { value: 'worker', label: 'Kaarigar', icon: 'construct-outline' },
];

/**
 * Uber-style mode switch — "Customer" ⇄ "Kaarigar".
 *
 * Rendered at the top of both home screens, so whichever mode you are in the
 * other one is always a single tap away. Accounts without a worker profile get
 * nothing (they only ever see the customer experience).
 */
export function ModeSwitch({ style }: { style?: ViewStyle }) {
  const router = useRouter();
  const { mode, setMode, canSwitch } = useMode();

  if (!canSwitch) return null;

  const choose = (next: AppMode) => {
    if (next === mode) return;
    setMode(next);
    // Land on the home tab of the mode we just entered (Home is the first
    // tab for both roles — employer browse / kaarigar dashboard).
    router.replace('/(tabs)');
  };

  return (
    <View style={[styles.wrap, style]}>
      {OPTIONS.map((option) => {
        const active = option.value === mode;
        return (
          <Pressable
            key={option.value}
            onPress={() => choose(option.value)}
            style={[styles.item, active && styles.itemActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Ionicons
              name={option.icon}
              size={15}
              color={active ? colors.white : colors.textSecondary}
            />
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    gap: 3,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.button - 2,
  },
  itemActive: { backgroundColor: colors.primaryDark },
  label: { fontSize: fontSize.caption, fontWeight: fontWeight.semibold, color: colors.textSecondary },
  labelActive: { color: colors.white },
});
