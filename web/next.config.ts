import type { NextConfig } from 'next';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

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
};

export default config;
