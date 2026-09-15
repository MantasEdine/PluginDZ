import type { Metadata } from 'next';
import './globals.css';
import { getLocale } from '@/lib/locale-server';
import { dir, type Locale } from '@/lib/i18n';
import { LocaleProvider } from '@/components/LocaleProvider';
import { CartProvider } from '@/components/CartProvider';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { VisitTracker } from '@/components/VisitTracker';
import { TrustBar } from '@/components/TrustBar';
import { WhatsAppButton } from '@/components/WhatsAppButton';
import { JsonLd } from '@/components/JsonLd';
import { organizationJsonLd, websiteJsonLd } from '@/lib/seo';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const googleVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;

/** Métadonnées par langue : ce qu'affiche le site et ce qu'indexe Google doivent correspondre. */
const SITE_META: Record<Locale, {
    title: string; template: string; description: string; keywords: string[]; ogLocale: string;
}> = {
    fr: {
        title: 'Plugin.dz — Chargeurs en gros et demi-gros en Algérie',
        template: '%s | Plugin.dz',
        description:
            'Chargeurs téléphone, montre, caméra et vélo électrique en gros et demi-gros. Prix revendeur, livraison Yalidine dans les 69 wilayas.',
        keywords: ['chargeur', 'gros', 'demi-gros', 'Algérie', 'Hoco', 'Yalidine', 'plugin.dz'],
        ogLocale: 'fr_DZ',
    },
    ar: {
        title: 'Plugin.dz — شواحن بالجملة ونصف الجملة في الجزائر',
        template: '%s | Plugin.dz',
        description:
            'شواحن الهاتف والساعة والكاميرا والدراجة الكهربائية بالجملة ونصف الجملة. أسعار التجار والتوصيل إلى 69 ولاية عبر Yalidine.',
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
        // Vérification de propriété Google Search Console. La valeur vient des
        // variables d'environnement (Vercel) : rien à committer, et la balise
        // disparaît simplement si la variable n'est pas définie.
        verification: googleVerification ? { google: googleVerification } : undefined,
    };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const locale = await getLocale();

    // `data-scroll-behavior` : globals.css active le défilement fluide sur <html>.
    // Next.js le neutralise pendant les changements de page — sans cet attribut il
    // émet un avertissement en console et ce comportement disparaîtra à terme.
    return (
        <html lang={locale} dir={dir(locale)} data-scroll-behavior="smooth">
            <body className="flex min-h-screen flex-col antialiased">
                <LocaleProvider locale={locale}>
                    <CartProvider>
                        <JsonLd data={organizationJsonLd()} />
                        <JsonLd data={websiteJsonLd()} />
                        <VisitTracker />
                        <TrustBar />
                        <Header />
                        <main className="flex-1">{children}</main>
                        <Footer />
                        <WhatsAppButton />
                    </CartProvider>
                </LocaleProvider>
            </body>
        </html>
    );
}
