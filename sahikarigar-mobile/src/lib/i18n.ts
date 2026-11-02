import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import en from '../locales/en.json';
import te from '../locales/te.json';

const resources = {
  en: { translation: en },
  te: { translation: te },
} as const;

export const SUPPORTED_LANGUAGES = ['en', 'te'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

export function getDeviceLanguage(): SupportedLanguage {
  const deviceLang = Localization.locale;
  if (deviceLang && deviceLang.startsWith('te')) {
    return 'te';
  }
  return 'en';
}

i18n.use(initReactI18next).init({
  resources,
  lng: getDeviceLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
export { getDeviceLanguage, SUPPORTED_LANGUAGES };