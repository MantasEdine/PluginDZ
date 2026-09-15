import { SOCIAL_LINKS, WHATSAPP_NUMBER } from './contact';
import type { Pack, Product } from './api';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://plugin-dz.com').replace(/\/$/, '');
const CURRENCY = 'DZD';

/** Coupe proprement une description pour les métadonnées (160 caractères max). */
export function metaDescription(text: string, fallback: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return fallback;
  return clean.length <= 160 ? clean : `${clean.slice(0, 157)}...`;
}

/** Disponibilité au sens schema.org. */
function availability(stock: number): string {
  return stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';
}

/** Fiche produit : prix, stock et marque lisibles par les moteurs de recherche. */
export function productJsonLd(product: Product): Record<string, unknown> {
  const url = `${SITE_URL}/produits/${product.slug}`;
  const image = product.imageUrl ?? product.variants.find((v) => v.imageUrl)?.imageUrl ?? undefined;
  const min = product.minPrice ?? 0;
  const max = product.maxPrice ?? min;

  // Un seul prix -> Offer ; une fourchette -> AggregateOffer.
  const offers =
    max !== min
      ? {
          '@type': 'AggregateOffer',
          priceCurrency: CURRENCY,
          lowPrice: min,
          highPrice: max,
          offerCount: product.variants.length,
          availability: availability(product.totalStock),
          url,
        }
      : {
          '@type': 'Offer',
          priceCurrency: CURRENCY,
          price: min,
          availability: availability(product.totalStock),
          url,
          itemCondition: 'https://schema.org/NewCondition',
        };

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: metaDescription(product.description, `${product.name} — ${product.brand.name}.`),
    sku: product.variants.find((v) => v.sku)?.sku ?? undefined,
    category: product.chargerType?.name ?? undefined,
    brand: { '@type': 'Brand', name: product.brand.name },
    image: image ? [image] : undefined,
    url,
    offers,
  };
}

/** Pack de gros : un prix unique pour un lot. */
export function packJsonLd(pack: Pack): Record<string, unknown> {
  const url = `${SITE_URL}/packs/${pack.slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: pack.name,
    description: metaDescription(pack.description, `${pack.name} — pack de gros.`),
    image: pack.imageUrl ? [pack.imageUrl] : undefined,
    url,
    offers: {
      '@type': 'Offer',
      priceCurrency: CURRENCY,
      price: pack.price,
      availability: availability(pack.stock),
      url,
      itemCondition: 'https://schema.org/NewCondition',
    },
  };
}

/** Fil d'Ariane : Google l'affiche à la place de l'URL brute. */
export function breadcrumbJsonLd(items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

/** Identité du site : nom, logo, contact — sert au « Knowledge Panel » et au branding. */
export function organizationJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    name: 'Plugin.dz',
    url: SITE_URL,
    logo: `${SITE_URL}/icon.png`,
    image: `${SITE_URL}/opengraph-image.jpg`,
    email: 'contact@plugin.dz',
    telephone: `+${WHATSAPP_NUMBER}`,
    // `sameAs` rattache le site à ses comptes : c'est ainsi que Google relie la
    // boutique à ses pages Facebook, Instagram et TikTok plutôt que de les traiter
    // comme trois entités sans rapport.
    sameAs: SOCIAL_LINKS.map((social) => social.href),
    areaServed: { '@type': 'Country', name: 'Algérie' },
    currenciesAccepted: CURRENCY,
    paymentAccepted: 'Paiement à la livraison',
  };
}

/** Déclare le moteur de recherche interne du site pour la SearchBox Google. */
export function websiteJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Plugin.dz',
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/produits?search={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}
