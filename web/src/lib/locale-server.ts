import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, translator, type Locale } from './i18n';

/** Langue courante, lue depuis le cookie posé par le sélecteur. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getTranslations() {
  const locale = await getLocale();
  return { locale, t: translator(locale) };
}
