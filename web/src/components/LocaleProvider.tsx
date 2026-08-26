'use client';

import { createContext, useContext } from 'react';
import { translator, type Locale, type MessageKey } from '@/lib/i18n';

const LocaleContext = createContext<Locale>('fr');

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/** Équivalent client de `getTranslations()`. */
export function useI18n(): { locale: Locale; t: (key: MessageKey) => string } {
  const locale = useContext(LocaleContext);
  return { locale, t: translator(locale) };
}
