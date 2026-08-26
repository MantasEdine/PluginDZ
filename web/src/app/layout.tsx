import type { Metadata } from 'next';
import './globals.css';
import { getLocale } from '@/lib/locale-server';
import { dir, type Locale } from '@/lib/i18n';
import { LocaleProvider } from '@/components/LocaleProvider';
import { CartProvider } from '@/components/CartProvider';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/** Métadonnées par langue : ce qu'affiche le site et ce qu'indexe Google doivent correspondre. */
const SITE_META: Record<Locale, {
    title: string; template: string; description: string; keywords: string[]; ogLocale: string;
}> = {
    fr: {
        title: 'Plugin.dz — Chargeurs en gros et demi-gros en Algérie',
        template: '%s | Plugin.dz',
        description:
            'Chargeurs téléphone, montre, caméra et vélo électrique en gros et demi-gros. Prix revendeur, livraison Yalidine dans les 58 wilayas.',
        keywords: ['chargeur', 'gros', 'demi-gros', 'Algérie', 'Hoco', 'Yalidine', 'plugin.dz'],
        ogLocale: 'fr_DZ',
    },
    ar: {
        title: 'Plugin.dz — شواحن بالجملة ونصف الجملة في الجزائر',
        template: '%s | Plugin.dz',
        description:
            'شواحن الهاتف والساعة والكاميرا والدراجة الكهربائية بالجملة ونصف الجملة. أسعار التجار والتوصيل إلى 58 ولاية عبر Yalidine.',
        keywords: ['شاحن', 'شواحن', 'بالجملة', 'الجزائر', 'Hoco', 'Yalidine', 'plugin.dz'],
        ogLocale: 'ar_DZ',
    },
};

export async function generateMetadata(): Promise<Metadata> {
    const locale = await getLocale();
    const meta = SITE_META[locale];

    return {
        metadataBase: new URL(siteUrl),
        title: { default: meta.title, template: meta.template },
        description: meta.description,
        keywords: meta.keywords,
        openGraph: {
            type: 'website',
            siteName: 'Plugin.dz',
            locale: meta.ogLocale,
            title: meta.title,
            description: meta.description,
        },
        robots: { index: true, follow: true },
    };
}

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
