import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import * as Font from 'expo-font';
import { useCallback, useEffect, useState } from 'react';
import { Image, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { listHires } from '@/lib/api';
import { colors } from '@/theme';

/** The four glyph names the tab bar uses. */
const TAB_ICON_NAMES = ['home', 'briefcase', 'calendar', 'person'] as const;
type TabIconName = (typeof TAB_ICON_NAMES)[number];

/** System-font emoji fallback — can never render as an empty square. */
const EMOJI_FALLBACK: Record<TabIconName, string> = {
  home: '🏠',
  briefcase: '💼',
  calendar: '📅',
  person: '👤',
};

/**
 * Tab bar icon rendered as a RUNTIME PNG.
 *
 * Why: on some Android builds (new architecture enabled), the Ionicons font
 * loads on the JS side but the native text pipeline silently falls back to
 * the system font, so font-based icons render as empty squares `[ ]` with no
 * error anywhere. A PNG <Image> bypasses the font text pipeline entirely; if
 * even the rasterization fails, the emoji fallback guarantees something is
 * always visible.
 */
function TabBarIcon({
  name,
  source,
  color,
  size,
}: {
  name: TabIconName;
  source?: { uri: string } | null;
  color: string;
  size?: number;
}) {
  const side = size ?? 24;
  if (source) {
    return <Image source={source} style={{ width: side, height: side, tintColor: color }} />;
  }
  return (
    <Text allowFontScaling={false} style={{ fontSize: side - 5, includeFontPadding: false }}>
      {EMOJI_FALLBACK[name]}
    </Text>
  );
}

export default function TabsLayout() {
  const { user } = useAuth();
  const { role, ready } = useMode();
  const insets = useSafeAreaInsets();
  const [actionCount, setActionCount] = useState(0);
  /** PNG data-URIs for each tab glyph, rasterized once at mount. */
  const [iconSources, setIconSources] = useState<Partial<Record<TabIconName, { uri: string }>>>({});

  // Diagnostic: still load the Ionicons font (in-app icons use it), but log
  // success/failure AND the JS-side isLoaded flag so the next logcat pinpoints
  // the font pipeline state. The TAB BAR itself no longer depends on it.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await Font.loadAsync(Ionicons.font);
        if (active) {
          console.log('[Font] Ionicons loadAsync resolved. isLoaded =', Font.isLoaded('ionicons'));
        }
      } catch (e) {
        console.error('[Font] Failed to load Ionicons:', e);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Rasterize each tab glyph into a PNG data-URI once, via the library's own
  // getImageSource() (Font.renderToImageAsync). If the font pipeline is broken
  // this rejects per icon — the emoji fallback in <TabBarIcon> takes over.
  useEffect(() => {
    let active = true;
    (async () => {
      const entries = await Promise.all(
        TAB_ICON_NAMES.map(async (name) => {
          try {
            const source = await Ionicons.getImageSource(name, 48, colors.primaryDark);
            return [name, { uri: (source as { uri: string }).uri }] as const;
          } catch (e) {
            console.error(`[TabIcons] Could not rasterize "${name}" — using emoji fallback.`, e);
            return [name, null] as const;
          }
        }),
      );
      if (active) setIconSources(Object.fromEntries(entries));
    })();
    return () => {
      active = false;
    };
  }, []);

  const loadActionCount = useCallback(async () => {
    if (!user || role !== 'employer') {
      setActionCount(0);
      return;
    }
    try {
      const data = await listHires();
      const count = (data.asEmployer ?? []).filter((h) => h.status === 'arrived').length;
      setActionCount(count);
    } catch {
      // Never break the tab bar over a failed count.
    }
  }, [user, role]);

  // Poll while the tabs are mounted so the badge appears shortly after the
  // worker marks "Arrived" (even if the employer never leaves this screen).
  useEffect(() => {
    if (!user || role !== 'employer') return undefined;
    void loadActionCount();
    const timer = setInterval(() => {
      void loadActionCount();
    }, 15000);
    return () => clearInterval(timer);
  }, [user, role, loadActionCount]);

  // Wait for the stored role before picking a tab set (avoids a flash).
  // (The old `if (!fontsLoaded) return null` gate is gone — the tab bar no
  // longer renders font text, so it can never show empty squares.)
  if (!ready) return null;

  // Guest mode: employers browse Home + Search + Worker profiles without a
  // session. Login is enforced only at Hire time and on account screens.
  const isWorker = role === 'worker';
  const isEmployer = role === 'employer';

  // Workers must be signed in — dashboard, jobs and availability need a session.
  // Send them to the public landing screen (not the login form) so a sign-out
  // can never bounce back into the signed-in tab tree.
  if (isWorker && !user) return <Redirect href="/welcome" />;
  // Worker role picked but registration not finished yet — complete it first.
  // (First-time role picking happens in /onboarding/role before login; the
  // legacy /role-selection route is kept for deep links from older builds.)
  if (isWorker && user && user.role !== 'worker') {
    return <Redirect href="/register-worker" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          // The bar grows by the bottom inset so the labels sit ABOVE the
          // system navigation bar instead of behind it.
          height: 62 + insets.bottom,
          paddingTop: 6,
          paddingBottom: 8 + insets.bottom,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      {isEmployer ? (
        <>
          <Tabs.Screen
            name="index"
            options={{
              title: 'Home',
              tabBarIcon: ({ color, size }) => (
                <TabBarIcon name="home" source={iconSources.home} color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="hires"
            options={{
              title: 'My Hires',
              tabBarIcon: ({ color, size }) => (
                <TabBarIcon name="briefcase" source={iconSources.briefcase} color={color} size={size} />
              ),
              // Red badge when a kaarigar has arrived and the OTP is waiting.
              tabBarBadge: actionCount > 0 ? actionCount : undefined,
              tabBarBadgeStyle: { backgroundColor: colors.danger, fontSize: 10 },
            }}
          />
        </>
      ) : null}

      {isWorker ? (
        <>
          <Tabs.Screen
            name="index"
            options={{
              title: 'Dashboard',
              tabBarIcon: ({ color, size }) => (
                <TabBarIcon name="home" source={iconSources.home} color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="jobs"
            options={{
              title: 'My Work',
              tabBarIcon: ({ color, size }) => (
                <TabBarIcon name="briefcase" source={iconSources.briefcase} color={color} size={size} />
              ),
            }}
          />
          {/* Merged "My Jobs" + "Availability" into a single tab. */}
          <Tabs.Screen
            name="availability"
            options={{
              title: 'Availability',
              tabBarIcon: ({ color, size }) => (
                <TabBarIcon name="calendar" source={iconSources.calendar} color={color} size={size} />
              ),
            }}
          />
        </>
      ) : null}

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="person" source={iconSources.person} color={color} size={size} />
          ),
        }}
      />

      {/* Routes that exist but are never tab buttons (opened via router.push). */}
      <Tabs.Screen name="search" options={{ href: null }} />
      {isEmployer ? <Tabs.Screen name="jobs" options={{ href: null }} /> : null}
      {isEmployer ? <Tabs.Screen name="my-jobs" options={{ href: null }} /> : null}
      {isEmployer ? <Tabs.Screen name="availability" options={{ href: null }} /> : null}
      {isWorker ? <Tabs.Screen name="hires" options={{ href: null }} /> : null}
      {isWorker ? <Tabs.Screen name="my-jobs" options={{ href: null }} /> : null}
    </Tabs>
  );
}
