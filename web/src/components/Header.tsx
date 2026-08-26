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
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
        <Link href="/" className="rounded bg-white px-2.5 py-1.5" aria-label="Plugin.dz">
          <Logo />
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

        <div className="ms-auto flex items-center gap-2 lg:ms-0">
          <LangSwitcher />
          <Link
            href="/panier"
            className="relative rounded-lg bg-plug-500 px-3.5 py-2 text-sm font-semibold hover:bg-plug-600"
          >
            {t('nav.cart')}
            {ready && count > 0 && (
              <span className="absolute -end-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-xs font-bold text-navy-700">
                {count}
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-lg border border-white/25 px-3 py-2 text-sm lg:hidden"
            aria-expanded={open}
          >
            {t('nav.menu')}
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
