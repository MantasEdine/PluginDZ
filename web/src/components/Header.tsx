'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Logo } from './Logo';
import { LangSwitcher } from './LangSwitcher';
import { useI18n } from './LocaleProvider';
import { useCart } from './CartProvider';

export function Header() {
  const { t } = useI18n();
  const { count, ready } = useCart();
  const [open, setOpen] = useState(false);

  const links = [
    { href: '/packs', label: t('nav.packs'), accent: true },
    { href: '/produits', label: t('nav.products') },
    { href: '/marques', label: t('nav.brands') },
    { href: '/produits?promo=true', label: t('nav.promos') },
    { href: '/suivi', label: t('nav.tracking') },
  ];

  return (
    <header className="sticky top-0 z-40 bg-navy-700 text-white shadow-md">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-3 sm:gap-4 sm:px-4">
        {/* Sur téléphone, seule l'icône : le mot-symbole ferait déborder l'en-tête. */}
        <Link href="/" className="shrink-0 rounded bg-white px-2 py-1.5 sm:px-2.5" aria-label="Plugin.dz">
          <span className="flex sm:hidden"><Logo compact /></span>
          <span className="hidden sm:flex"><Logo /></span>
        </Link>

        <nav className="hidden flex-1 items-center gap-1 lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition hover:bg-white/10 ${
                link.accent ? 'text-plug-400' : 'text-white'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex shrink-0 items-center gap-1.5 sm:gap-2 lg:ms-0">
          <LangSwitcher />
          <Link
            href="/panier"
            aria-label={t('nav.cart')}
            className="relative shrink-0 rounded-lg bg-plug-500 px-3 py-2 text-sm font-semibold hover:bg-plug-600 sm:px-3.5"
          >
            <svg className="h-5 w-5 sm:hidden" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2.5 3h1.9l1.8 9.2a1.4 1.4 0 0 0 1.4 1.1h6.6a1.4 1.4 0 0 0 1.4-1.1L17 6H5.2" />
              <circle cx="8" cy="16.5" r="1.2" />
              <circle cx="14.5" cy="16.5" r="1.2" />
            </svg>
            <span className="hidden sm:inline">{t('nav.cart')}</span>
            {ready && count > 0 && (
              <span className="absolute -end-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs font-bold text-navy-700">
                {count}
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="shrink-0 rounded-lg border border-white/25 px-3 py-2 text-sm lg:hidden"
            aria-expanded={open}
            aria-label={t('nav.menu')}
          >
            <svg className="h-5 w-5 sm:hidden" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M3 5.5h14M3 10h14M3 14.5h14" />
            </svg>
            <span className="hidden sm:inline">{t('nav.menu')}</span>
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-white/15 lg:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block border-b border-white/10 px-5 py-3 text-sm font-semibold"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
