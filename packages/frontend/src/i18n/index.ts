import { createContext, useContext, useState, useCallback } from 'react';
import { de } from './de';
import { en } from './en';

export type Locale = 'de' | 'en';

const translations: Record<Locale, Record<string, string>> = { de, en };

function getStoredLocale(): Locale {
  const stored = localStorage.getItem('locale');
  if (stored === 'de' || stored === 'en') return stored;
  return 'de';
}

interface LocaleContextValue {
  locale: Locale;
  toggleLocale: () => void;
  t: (key: string) => string;
}

export const LocaleContext = createContext<LocaleContextValue | null>(null);

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}

export function useLocaleProvider() {
  const [locale, setLocale] = useState<Locale>(getStoredLocale);

  const toggleLocale = useCallback(() => {
    setLocale(prev => {
      const next = prev === 'de' ? 'en' : 'de';
      localStorage.setItem('locale', next);
      return next;
    });
  }, []);

  const t = useCallback((key: string): string => {
    return translations[locale][key] ?? key;
  }, [locale]);

  return { locale, toggleLocale, t };
}

// Standalone t() for use outside React (fallback)
let _fallbackLocale: Locale = getStoredLocale();
export function t(key: string): string {
  return translations[_fallbackLocale][key] ?? key;
}
export function setFallbackLocale(locale: Locale): void {
  _fallbackLocale = locale;
}
