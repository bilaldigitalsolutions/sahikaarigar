// =============================================================================
// SahiKaarigar — in-app top notification banner (Rapido/Porter style)
// =============================================================================
// A slide-down condensed request card under the status bar — rate, location
// and a green "View" button, matching the redesigned Job Requests card.
// Mounted ONCE in the root layout; lib/notifications emits request pushes
// (optionally enriched with the hire's rate/location) onto `onAppBanner`.
// =============================================================================

import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { onAppBanner, type AppBannerPayload } from '@/lib/notifications';
import { colors, fontSize, fontWeight, radius, shadows, spacing } from '@/theme';

/** Fully off-screen start (banner is ~72px tall; extra is harmless). */
const HIDDEN_Y = -160;
/** Auto-dismiss after this many milliseconds without interaction. */
const AUTO_HIDE_MS = 5000;

export function TopNotificationBanner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [payload, setPayload] = useState<AppBannerPayload | null>(null);
  const [visible, setVisible] = useState(false);
  const translateY = useRef(new Animated.Value(HIDDEN_Y)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe to hire-request pushes emitted by lib/notifications.
  useEffect(
    () =>
      onAppBanner((next) => {
        setPayload(next);
        setVisible(true);
      }),
    [],
  );

  // Slide down when re-shown; auto-hide after a while.
  useEffect(() => {
    if (!visible || !payload) return undefined;
    Animated.timing(translateY, {
      toValue: 0,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    hideTimer.current = setTimeout(hide, AUTO_HIDE_MS);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, payload]);

  const hide = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    // Slide out first, then unmount so the exit animation is visible.
    Animated.timing(translateY, {
      toValue: HIDDEN_Y,
      duration: 240,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => setVisible(false));
  };

  const onPress = () => {
    hide();
    try {
      router.push('/(tabs)/jobs');
    } catch {
      // Router not ready — the Jobs tab refetches on focus anyway.
    }
  };

  if (!visible || !payload) return null;

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[
        styles.banner,
        { top: insets.top + 8, transform: [{ translateY }] },
      ]}
    >
      {/* Condensed Rapido-style card: rate on top, location underneath. */}
      <Pressable style={styles.info} onPress={onPress}>
        <Text style={styles.price} numberOfLines={1}>
          {payload.price || payload.title || 'Nayi Kaam ki Request 🛠️'}
        </Text>
        <Text style={styles.location} numberOfLines={1}>
          {payload.location || payload.body || 'Nayi kaam ki request aayi hai'}
        </Text>
      </Pressable>
      <Pressable style={styles.viewBtn} onPress={onPress} hitSlop={8} accessibilityLabel="View job requests">
        <Text style={styles.viewBtnText}>View</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Condensed request card — white with a thick brand-green border, matching
  // the redesigned Job Requests list card.
  banner: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.primaryDark,
    backgroundColor: colors.card,
    ...shadows.cardHover,
  },
  info: { flex: 1, gap: 1 },
  price: {
    fontSize: 18,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  location: {
    fontSize: fontSize.caption - 1,
    color: colors.textSecondary,
  },
  viewBtn: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  viewBtnText: {
    color: colors.white,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
  },
});
