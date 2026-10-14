import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fontSize, fontWeight, spacing } from '@/theme';

export interface HeaderProps {
  /** Centered title (ignored when `center` is provided). */
  title?: string;
  /** Custom center node (e.g. the brand logo). */
  center?: ReactNode;
  /** Show the back chevron. Defaults to true. */
  showBack?: boolean;
  /** Override the back handler (defaults to router.back()). */
  onBack?: () => void;
  /** Right-aligned node (e.g. a help button). */
  right?: ReactNode;
  /** Draw a hairline under the header. Defaults to true. */
  bordered?: boolean;
}

/**
 * Full-bleed screen header with an optional back button and right slot.
 * It handles the top safe-area inset itself, so pair it with
 * `<Screen edges={['bottom']} header={<Header …/>}>`.
 */
export function Header({
  title,
  center,
  showBack = true,
  onBack,
  right,
  bordered = true,
}: HeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const goBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + spacing.sm },
        bordered && styles.bordered,
      ]}
    >
      <View style={styles.side}>
        {showBack ? (
          <Pressable
            onPress={goBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={styles.iconBtn}
          >
            <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.center}>
        {center ?? (title ? <Text style={styles.title}>{title}</Text> : null)}
      </View>

      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: colors.card,
  },
  bordered: { borderBottomWidth: 1, borderBottomColor: colors.border },
  side: { width: 48, alignItems: 'flex-start', justifyContent: 'center' },
  right: { alignItems: 'flex-end' },
  iconBtn: { padding: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: fontSize.title, fontWeight: fontWeight.bold, color: colors.textPrimary },
});
