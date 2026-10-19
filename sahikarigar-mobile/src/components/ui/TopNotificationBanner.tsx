// =============================================================================
// SahiKaarigar — in-app top notification banner (Rapido/Porter style)
// =============================================================================
// A slide-down pill under the status bar: "Nayi Kaam ki Request 🛠️" on the
// brand green, with a white "View" button. Mounted ONCE in the root layout;
// lib/notifications emits request pushes onto `onAppBanner`.
// =============================================================================

import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
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
      <View style={styles.iconBox}>
        <Ionicons name="hammer" size={20} color={colors.white} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title} numberOfLines={1}>
          {payload.title || 'Nayi Kaam ki Request 🛠️'}
        </Text>
        <Text style={styles.body} numberOfLines={2}>
          {payload.body || 'Tap View to open your job requests.'}
        </Text>
      </View>
      <Pressable style={styles.viewBtn} onPress={onPress} hitSlop={8} accessibilityLabel="View job requests">
        <Text style={styles.viewBtnText}>View</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.button,
    backgroundColor: colors.primaryDark,
    ...shadows.cardHover,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  title: { color: colors.white, fontSize: fontSize.caption, fontWeight: fontWeight.bold },
  body: { color: 'rgba(255, 255, 255, 0.85)', fontSize: fontSize.caption - 3, marginTop: 2, lineHeight: 16 },
  viewBtn: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  viewBtnText: { color: colors.primaryDark, fontSize: fontSize.caption - 3, fontWeight: fontWeight.bold },
});
