import { Redirect, Tabs } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Text, type ColorValue, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { listHires } from '@/lib/api';
import { colors } from '@/theme';

// Tab icons are STATIC BUNDLED PNGs (assets/icons/*.png). Bitmaps bypass the
// device's text/font stack entirely, so they render even when icon fonts or
// emoji glyphs are missing from the system (which shows up as empty squares).

type TabIconName = 'home' | 'briefcase' | 'calendar' | 'person';

const FALLBACK_LABEL: Record<TabIconName, string> = {
  home: 'H',
  briefcase: 'B',
  calendar: 'C',
  person: 'P',
};

/**
 * Bundled PNG tab icon. If the bitmap fails to load/decode, render a single
 * letter instead of leaving an empty slot in the tab bar.
 */
function TabIcon({
  name,
  source,
  color,
}: {
  name: TabIconName;
  source: ImageSourcePropType;
  color: ColorValue;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    console.log(`[TabIcon] ${name}.png require() resolved to:`, source);
  }, [name, source]);

  if (failed) {
    return (
      <Text
        allowFontScaling={false}
        style={{
          width: 24,
          height: 24,
          lineHeight: 24,
          textAlign: 'center',
          fontSize: 13,
          fontWeight: '700',
          color,
        }}
      >
        {FALLBACK_LABEL[name]}
      </Text>
    );
  }

  return (
    <Image
      source={source}
      onError={(event) => {
        const detail = event.nativeEvent as { error?: string; uri?: string };
        console.warn(
          `[TabIcon] ${name}.png failed to load — using text fallback. ` +
            `source=${String(source)} error=${detail.error ?? 'unknown'} uri=${detail.uri ?? 'unknown'}`
        );
        setFailed(true);
      }}
      style={{ width: 24, height: 24, tintColor: color }}
    />
  );
}

export default function TabsLayout() {
  const { user } = useAuth();
  const { role, ready } = useMode();
  const insets = useSafeAreaInsets();
  const [actionCount, setActionCount] = useState(0);

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
      {/* IMPORTANT: Expo Router only reads `Tabs.Screen` as a DIRECT child.
          Fragments (<>...</>) are ignored by useFilterScreenChildren, which
          silently drops their title/tabBarIcon/badge options. Keep these
          conditionals inline — do not wrap the screens in a fragment. */}
      {isEmployer ? (
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color }) => (
              <TabIcon
                name="home"
                source={require('../../../assets/icons/home.png')}
                color={color}
              />
            ),
          }}
        />
      ) : null}
      {isEmployer ? (
        <Tabs.Screen
          name="hires"
          options={{
            title: 'My Hires',
            tabBarIcon: ({ color }) => (
              <TabIcon
                name="briefcase"
                source={require('../../../assets/icons/briefcase.png')}
                color={color}
              />
            ),
            // Red badge when a kaarigar has arrived and the OTP is waiting.
            tabBarBadge: actionCount > 0 ? actionCount : undefined,
            tabBarBadgeStyle: { backgroundColor: colors.danger, fontSize: 10 },
          }}
        />
      ) : null}

      {isWorker ? (
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color }) => (
              <TabIcon
                name="home"
                source={require('../../../assets/icons/home.png')}
                color={color}
              />
            ),
          }}
        />
      ) : null}
      {isWorker ? (
        <Tabs.Screen
          name="jobs"
          options={{
            title: 'My Work',
            tabBarIcon: ({ color }) => (
              <TabIcon
                name="briefcase"
                source={require('../../../assets/icons/briefcase.png')}
                color={color}
              />
            ),
          }}
        />
      ) : null}
      {/* Merged "My Jobs" + "Availability" into a single tab. */}
      {isWorker ? (
        <Tabs.Screen
          name="availability"
          options={{
            title: 'Availability',
            tabBarIcon: ({ color }) => (
              <TabIcon
                name="calendar"
                source={require('../../../assets/icons/calendar.png')}
                color={color}
              />
            ),
          }}
        />
      ) : null}

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <TabIcon
              name="person"
              source={require('../../../assets/icons/person.png')}
              color={color}
            />
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
