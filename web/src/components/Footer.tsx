'use client';

import Link from 'next/link';
import { Logo } from './Logo';
import { useI18n } from './LocaleProvider';

export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="mt-16 bg-navy-800 text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <span className="inline-block rounded bg-white px-2.5 py-1.5">
            <Logo />
          </span>
          <p className="mt-3 text-sm text-white/70">{t('common.tagline')}</p>
        </div>
        <div className="text-sm">
          <p className="mb-2 font-semibold">{t('nav.products')}</p>
          <ul className="space-y-1.5 text-white/70">
            <li><Link href="/packs" className="hover:text-white">{t('nav.packs')}</Link></li>
            <li><Link href="/produits" className="hover:text-white">{t('nav.products')}</Link></li>
            <li><Link href="/marques" className="hover:text-white">{t('nav.brands')}</Link></li>
            <li><Link href="/suivi" className="hover:text-white">{t('nav.tracking')}</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <p className="mb-2 font-semibold">{t('common.contact')}</p>
          <ul className="space-y-1.5 text-white/70">
            <li>contact@plugin.dz</li>
            <li>Yalidine — 58 wilayas</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/60">
        © {new Date().getFullYear()} Plugin.dz — {t('common.rights')}
      </div>
    </footer>
  );
}
