import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './en.json';
import hi from './hi.json';
import as_ from './as.json';
import bn from './bn.json';

// ─── Types ───────────────────────────────────────────────────────────

export type LanguageCode = 'en' | 'hi' | 'as' | 'bn';

type DictionaryMap = Record<LanguageCode, Record<string, string>>;

interface I18nContextValue {
  currentLanguage: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

// ─── Dictionary Registry ────────────────────────────────────────────

const dictionaries: DictionaryMap = {
  en: en as Record<string, string>,
  hi: hi as Record<string, string>,
  as: as_ as Record<string, string>,
  bn: bn as Record<string, string>,
};

export const SUPPORTED_LANGUAGES: { code: LanguageCode; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'as', label: 'অসমীয়া' },
  { code: 'bn', label: 'বাংলা' },
];

const LANGUAGE_STORAGE_KEY = '@oa_ner_language';

// ─── Context ─────────────────────────────────────────────────────────

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────

interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>('en');

  // Load persisted language on mount
  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).then((stored) => {
      if (stored && stored in dictionaries) {
        setCurrentLanguage(stored as LanguageCode);
      }
    }).catch(() => {
      // AsyncStorage unavailable, use default language
    });
  }, []);

  const setLanguage = useCallback((lang: LanguageCode) => {
    setCurrentLanguage(lang);
    AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang).catch(() => {});
  }, []);

  /**
   * Translate a key, with optional variable interpolation.
   * Usage: t('login_lockout', { seconds: 45 }) → "Too many attempts. Try again in 45s"
   * Falls back to English if key missing in current language, then to the raw key.
   */
  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      let value =
        dictionaries[currentLanguage]?.[key] ??
        dictionaries['en']?.[key] ??
        key;

      if (vars) {
        Object.entries(vars).forEach(([varName, varValue]) => {
          value = value.replace(`{{${varName}}}`, String(varValue));
        });
      }

      return value;
    },
    [currentLanguage]
  );

  return (
    <I18nContext.Provider value={{ currentLanguage, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────

export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
}
