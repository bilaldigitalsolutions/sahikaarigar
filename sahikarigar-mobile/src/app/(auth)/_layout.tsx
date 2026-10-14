import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';

export default function AuthLayout() {
  const { user } = useAuth();

  // Already signed in? Don't show the login screens.
  if (user) return <Redirect href="/(tabs)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
