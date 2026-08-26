import type { MetadataRoute } from "next";
import { API_URL } from "@/lib/api";

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

interface SlugRow {
  slug: string;
  createdAt?: string;
}

/** L'API peut être injoignable au build : on retombe sur une liste vide. */
async function fetchSlugs(path: string): Promise<SlugRow[]> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      next: { revalidate: 3600 },
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { data: SlugRow[] };
    return Array.isArray(body.data) ? body.data : [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, packs, brands] = await Promise.all([
    fetchSlugs("/api/products?perPage=60"),
    fetchSlugs("/api/packs"),
    fetchSlugs("/api/brands"),
  ]);

  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${siteUrl}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/produits`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/packs`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${siteUrl}/marques`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];

  return [
    ...staticPages,
    ...packs.map((pack) => ({
      url: `${siteUrl}/packs/${pack.slug}`,
      lastModified: pack.createdAt ? new Date(pack.createdAt) : now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...products.map((product) => ({
      url: `${siteUrl}/produits/${product.slug}`,
      lastModified: product.createdAt ? new Date(product.createdAt) : now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...brands.map((brand) => ({
      url: `${siteUrl}/marques/${brand.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
