import type { NextConfig } from 'next';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Domaine canonique du site. Toutes les autres adresses (www, *.vercel.app) sont
 * redirigées vers lui en 308 : un seul domaine indexé par Google, pas de contenu
 * dupliqué, et toute la « réputation » SEO concentrée au même endroit.
 */
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://plugin-dz.com').replace(/\/$/, '');
const canonicalHost = new URL(siteUrl).host;

/** Anciennes adresses à rediriger — jamais l'hôte canonique lui-même (sinon boucle). */
const legacyHosts = ['www.plugin-dz.com', 'plugin-dz.vercel.app'].filter(
  (host) => host !== canonicalHost,
);

const config: NextConfig = {
  reactStrictMode: true,
  images: {
    // Les images produits viennent de l'API (uploads) ou d'un CDN externe.
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: new URL(apiUrl).hostname },
      { protocol: 'https', hostname: '**' },
    ],
  },
  async redirects() {
    return legacyHosts.map((host) => ({
      source: '/:path*',
      has: [{ type: 'host' as const, value: host }],
      destination: `${siteUrl}/:path*`,
      permanent: true,
    }));
  },
};

export default config;
