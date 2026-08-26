'use client';

import { useRouter } from 'next/navigation';
import { LOCALE_COOKIE, LOCALES, type Locale } from '@/lib/i18n';
import { useI18n } from './LocaleProvider';

const LABELS: Record<Locale, string> = { fr: 'FR', ar: 'ع' };

/**
 * Le choix de langue est stocké dans un cookie : le rendu serveur produit donc
 * directement le bon `lang`/`dir`, ce qui préserve le SEO.
 */
export function LangSwitcher() {
  const router = useRouter();
  const { locale } = useI18n();

  function choose(next: Locale) {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <div className="flex items-center rounded-lg border border-white/25 p-0.5" role="group" aria-label="Langue">
      {LOCALES.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => choose(item)}
          aria-pressed={item === locale}
          className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
            item === locale ? 'bg-white text-navy-700' : 'text-white/80 hover:text-white'
          }`}
        >
          {LABELS[item]}
        </button>
      ))}
    </div>
  );
}
