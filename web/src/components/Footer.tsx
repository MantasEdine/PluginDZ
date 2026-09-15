'use client';

import Link from 'next/link';
import { Logo } from './Logo';
import { useI18n } from './LocaleProvider';
import { IconFacebook, IconInstagram, IconTikTok, IconWhatsApp } from './SocialIcons';
import { SOCIAL_LINKS, WHATSAPP_DISPLAY, whatsappLink } from '@/lib/contact';

const SOCIAL_ICONS: Record<string, React.ReactNode> = {
  facebook: <IconFacebook />,
  instagram: <IconInstagram />,
  tiktok: <IconTikTok />,
};

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
          {/* Les réseaux sont la vitrine réelle de la boutique : c'est là que les
              clients vérifient qu'elle est vivante avant de commander. */}
          <p className="mt-5 mb-2 text-sm font-semibold">{t('social.follow')}</p>
          <div className="flex gap-2">
            {SOCIAL_LINKS.map((social) => (
              <a
                key={social.key}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                title={social.label}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-white/10
                           text-white/80 transition hover:bg-white/20 hover:text-white"
              >
                {SOCIAL_ICONS[social.key]}
              </a>
            ))}
          </div>
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
            <li>
              <a
                href={whatsappLink(t('whatsapp.prefill'))}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 hover:text-white sm:min-h-0"
              >
                <IconWhatsApp className="h-4 w-4 text-[#25D366]" />
                <span dir="ltr">{WHATSAPP_DISPLAY}</span>
              </a>
            </li>
            <li>contact@plugin.dz</li>
            <li>Yalidine — 69 wilayas</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-white/60">
        © {new Date().getFullYear()} Plugin.dz — {t('common.rights')}
      </div>
    </footer>
  );
}
