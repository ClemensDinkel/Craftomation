import { de } from './de';
import { en } from './en';

export type TranslationKey = keyof typeof de;
export type Locale = 'de' | 'en';

const translations: Record<Locale, Record<string, string>> = { de, en };

let currentLocale: Locale = 'de';

export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: TranslationKey): string {
  return translations[currentLocale][key] ?? key;
}

export function tItemName(itemId: string): string {
  const key = `item.${itemId}` as TranslationKey;
  return translations[currentLocale][key] ?? itemId;
}

export function tItemDesc(itemId: string): string {
  const key = `desc.${itemId}` as TranslationKey;
  return translations[currentLocale][key] ?? '';
}
