// Onboarding stack — Back button har screen par (except loading). Header
// expo-router ka native back deta hai; onboarding flow khud bhi back deta hai.
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { colors } from '@/theme';
export default function OnboardingLayout() {
  const { t } = useTranslation();
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.primaryDark,
        headerTitleStyle: { color: colors.textPrimary },
        contentStyle: { backgroundColor: colors.background },
        headerBackTitle: t('common.back'),
      }}
    >
      <Stack.Screen name="location" options={{ title: t('auth.onboardingLocation') }} />
      <Stack.Screen name="role" options={{ title: t('auth.onboardingRole') }} />
    </Stack>
  );
}
