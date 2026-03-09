import { useLocale } from '@/i18n';

export function LanguageToggle({ inline }: { inline?: boolean }) {
  const { locale, toggleLocale } = useLocale();

  const positionClass = inline
    ? ''
    : 'fixed top-3 right-3 z-40';

  return (
    <button
      onClick={toggleLocale}
      className={`${positionClass} px-2 py-1 text-xs font-medium rounded bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors`}
    >
      {locale === 'de' ? 'EN' : 'DE'}
    </button>
  );
}
