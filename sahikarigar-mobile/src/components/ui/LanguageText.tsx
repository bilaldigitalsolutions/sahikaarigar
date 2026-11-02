import { Text, TextProps, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

/**
 * LanguageText — renders text with Telugu font when language is Telugu,
 * and default system font otherwise.
 *
 * Usage:
 *   <LanguageText>{t('home.welcome')}</Text>
 */
export type LanguageTextProps = TextProps;

export function LanguageText(props: LanguageTextProps) {
  const { i18n } = useTranslation();
  const isTelugu = i18n.language === 'te';

  return (
    <Text style={[styles.base, isTelugu ? styles.teluguFont : undefined]} {...props} />
  );
}

const styles = StyleSheet.create({
  base: {},
  teluguFont: {
    fontFamily: 'NotoSansTelugu-Regular',
  },
});
