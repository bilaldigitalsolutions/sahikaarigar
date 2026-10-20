import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { listHires } from '@/lib/api';
import { colors } from '@/theme';

export default function TabsLayout() {
  const { user } = useAuth();
  const { role, ready } = useMode();
  // Badge count on the "My Hires" tab — how many bookings need the employer's
  // attention right now (the kaarigar has arrived and the OTP is waiting).
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
  if (!ready) return null;

  // Guest mode: employers browse Home + Search + Worker profiles without a
  // session. Login is enforced only at Hire time and on account screens.
  const isWorker = role === 'worker';
  const isEmployer = role === 'employer';

  // Workers must be signed in — dashboard, jobs and availability need a session.
  if (isWorker && !user) return <Redirect href="/(auth)/login" />;
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
          height: 62,
          paddingTop: 6,
          paddingBottom: 8,
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
              tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
            }}
          />
          <Tabs.Screen
            name="hires"
            options={{
              title: 'My Hires',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="briefcase-outline" color={color} size={size} />
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
              tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
            }}
          />
          <Tabs.Screen
            name="jobs"
            options={{
              title: 'Requests',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="briefcase-outline" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="my-jobs"
            options={{
              title: 'My Jobs',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="list-outline" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="availability"
            options={{
              title: 'Availability',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="toggle-outline" color={color} size={size} />
              ),
            }}
          />
        </>
      ) : null}

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />,
        }}
      />

      {/* Routes that exist but are never tab buttons (opened via router.push). */}
      <Tabs.Screen name="search" options={{ href: null }} />
      {isEmployer ? <Tabs.Screen name="jobs" options={{ href: null }} /> : null}
      {isEmployer ? <Tabs.Screen name="my-jobs" options={{ href: null }} /> : null}
      {isEmployer ? <Tabs.Screen name="availability" options={{ href: null }} /> : null}
      {isWorker ? <Tabs.Screen name="hires" options={{ href: null }} /> : null}
    </Tabs>
  );
}
