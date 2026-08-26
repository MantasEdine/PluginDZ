import type { Metadata } from 'next';
import './globals.css';
import { getLocale } from '@/lib/locale-server';
import { dir } from '@/lib/i18n';
import { LocaleProvider } from '@/components/LocaleProvider';
import { CartProvider } from '@/components/CartProvider';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Plugin.dz — Chargeurs en gros et demi-gros en Algérie',
    template: '%s | Plugin.dz',
  },
  description:
    'Chargeurs téléphone, montre, caméra et vélo électrique en gros et demi-gros. Prix revendeur, livraison Yalidine dans les 58 wilayas.',
  keywords: ['chargeur', 'gros', 'demi-gros', 'Algérie', 'Hoco', 'Yalidine', 'plugin.dz'],
  openGraph: { type: 'website', siteName: 'Plugin.dz', locale: 'fr_DZ' },
  robots: { index: true, follow: true },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale} dir={dir(locale)}>
      <body className="flex min-h-screen flex-col antialiased">
        <LocaleProvider locale={locale}>
          <CartProvider>
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </CartProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
