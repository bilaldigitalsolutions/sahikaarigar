import { Redirect } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import { useMode } from '@/contexts/ModeContext';

/**
 * Entry route — signed-out users see the welcome/login flow; signed-in users
 * go to the role picker until they have chosen a role, then straight to the
 * role-specific tabs.
 */
export default function Index() {
  const { user } = useAuth();
  const { ready, roleChosen } = useMode();

  if (!user) return <Redirect href="/welcome" />;
  // AsyncStorage read still in flight — wait a frame instead of flashing.
  if (!ready) return null;
  if (!roleChosen) return <Redirect href="/role-selection" />;
  return <Redirect href="/(tabs)" />;
}
