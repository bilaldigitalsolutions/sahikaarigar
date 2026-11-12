import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { setAppLanguage, type SupportedLanguage } from '@/lib/i18n';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';

/** English / Telugu pill toggle. Shown on every screen a user can reach while
 *  logged OUT (welcome after sign-out, login, onboarding role) so the language
 *  can always be changed without signing in first. Same persisting switch as
 *  the Profile card — i18next re-renders every translated screen instantly. */
export function LanguageToggle() {
  const { t, i18n } = useTranslation();
  return (
    <View style={styles.row}>
      {(['en', 'te'] as const).map((lang) => {
        const selected = i18n.language.startsWith(lang);
        return (
          <Pressable
            key={lang}
            style={[styles.btn, selected && styles.btnActive]}
            onPress={() => void setAppLanguage(lang as SupportedLanguage)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.text, selected && styles.textActive]}>
              {t(`language.${lang}`)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: spacing.sm,
  },
  btn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.card,
  },
  btnActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  text: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  textActive: {
    color: colors.white,
    fontWeight: fontWeight.bold,
  },
});
