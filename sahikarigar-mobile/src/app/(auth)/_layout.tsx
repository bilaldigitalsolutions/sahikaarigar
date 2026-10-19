import { Redirect, Stack, usePathname } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';

export default function AuthLayout() {
  const { user } = useAuth();
  const pathname = usePathname();

  // ⚠️ verify.tsx owns the routing after OTP verification (hire `next` intent,
  // register-worker for new kaarigars, role-selection for fresh users). The
  // blanket Redirect below used to fire the instant `confirmOtp` set the user
  // — racing `verify.tsx`'s router.replace and STEALING its destination
  // (a guest hire-intent landed on /(tabs) instead of /hire/<id>). So on the
  // verify screen we never blanket-redirect: the screen itself navigates.
  const onVerifyScreen = pathname.includes('/verify');

  // Already signed in and NOT mid-OTP? Don't show the login screens.
  if (user && !onVerifyScreen) return <Redirect href="/(tabs)" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
