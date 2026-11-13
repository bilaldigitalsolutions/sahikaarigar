import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from '../locales/en.json';
import te from '../locales/te.json';

const resources = {
  en: { translation: en },
  te: { translation: te },
} as const;

export const SUPPORTED_LANGUAGES = ['en', 'te'] as const;
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

/** AsyncStorage key that remembers the language the user picked in Profile. */
export const LANGUAGE_STORAGE_KEY = 'sk_language';

export function getDeviceLanguage(): SupportedLanguage {
  const deviceLang = Intl.DateTimeFormat().resolvedOptions().locale.split('-')[0];
  if (deviceLang && deviceLang.startsWith('te')) {
    return 'te';
  }
  return 'en';
}

i18n.use(initReactI18next).init({
  resources,
  lng: getDeviceLanguage(),
  fallbackLng: 'en',
  // Hermes (Expo's JS engine) does not provide Intl.PluralRules, so i18next
  // cannot resolve the JSON v4 plural suffixes (_one/_other) — it would fall
  // back to base-key lookups and render raw keys like "rating.summary".
  // Pin the classic v3 plural format: "key" (count === 1) + "key_plural"
  // (everything else). Static rules, no Intl dependency, deterministic.
  compatibilityJSON: 'v3',
  interpolation: {
    escapeValue: false,
  },
});

/**
 * Restore a previously chosen language (Profile toggle). Falls back to the
 * device language when nothing was saved or storage is unavailable.
 */
export async function initLanguage(): Promise<void> {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'en' || saved === 'te') {
      await i18n.changeLanguage(saved);
    }
  } catch {
    // Storage unavailable — the device-language default stays active.
  }
}

/** Switch the app language at runtime and remember the choice. */
export async function setAppLanguage(language: SupportedLanguage): Promise<void> {
  await i18n.changeLanguage(language);
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Choice not persisted — the next launch falls back to the device language.
  }
}

export default i18n;
export { i18n };
