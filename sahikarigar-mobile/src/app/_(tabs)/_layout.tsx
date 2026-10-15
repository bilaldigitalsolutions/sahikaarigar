import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';
import { colors } from '@/theme';

export default function TabsLayout() {
  const { user } = useAuth();
  const { role, ready, roleChosen } = useMode();

  if (!user) return <Redirect href="/(auth)/login" />;
  // Wait for the stored role before picking a tab set (avoids a flash).
  if (!ready) return null;
  // First launch after login — send the user to pick a role.
  // Check roleChosen BEFORE role to avoid a flash of wrong home screen.
  // This also handles the case where the tab layout re-renders with a stale `role`
  // right after the user picks a new role in RoleSelectionScreen.
  if (!roleChosen) return <Redirect href="/role-selection" />;
  // Worker role picked but registration not finished yet — complete it first.
  if (role === 'worker' && user.role !== 'worker') {
    return <Redirect href="/register-worker" />;
  }

  // Role-based tab bar (driven by the locally chosen role, persisted in
  // AsyncStorage `user_role` — see ModeContext):
  //   employer -> Home (Browse) · My Hires · Profile
  //   worker   -> Home (Dashboard) · Job Requests · My Jobs · Availability · Profile
  const isWorker = role === 'worker';
  const isEmployer = role === 'employer';

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
              tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
            }}
          />
          <Tabs.Screen
            name="hires"
            options={{
              title: 'My Hires',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="hand-right" color={color} size={size} />
              ),
            }}
          />
        </>
      ) : null}

      {isWorker ? (
        <>
          <Tabs.Screen
            name="index"
            options={{
              title: 'Home',
              tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
            }}
          />
          <Tabs.Screen
            name="jobs"
            options={{
              title: 'Job Requests',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="paper-plane" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="my-jobs"
            options={{
              title: 'My Jobs',
              tabBarIcon: ({ color, size }) => (
                <Ionicons name="briefcase" color={color} size={size} />
              ),
            }}
          />
          <Tabs.Screen
            name="availability"
            options={{
              title: 'Availability',
              tabBarIcon: ({ color, size }) => <Ionicons name="square" color={color} size={size} />,
            }}
          />
        </>
      ) : null}

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} />,
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