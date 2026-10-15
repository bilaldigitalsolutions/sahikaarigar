// Onboarding stack — Back button har screen par (except loading). Header
// expo-router ka native back deta hai; onboarding flow khud bhi back deta hai.
import { Stack } from 'expo-router';
import { colors } from '@/theme';
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.primaryDark,
        headerTitleStyle: { color: colors.textPrimary },
        contentStyle: { backgroundColor: colors.background },
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen name="location" options={{ title: 'Select Area' }} />
      <Stack.Screen name="role" options={{ title: 'Aap Kaun Hain?' }} />
    </Stack>
  );
}
