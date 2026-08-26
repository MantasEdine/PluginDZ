import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { getTranslations } from '@/lib/locale-server';
import { ProductCard, SectionTitle } from '@/components/Cards';
import { ProductPurchase } from '@/components/ProductPurchase';

export const revalidate = 60;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const result = await api.product(slug);
  if (!result?.data) return { title: 'Produit' };
  const product = result.data;
  return {
    title: product.name,
    description: product.description.slice(0, 160) || `${product.name} — chargeur ${product.brand.name}.`,
    openGraph: {
      title: product.name,
      description: product.description.slice(0, 160),
      images: product.imageUrl ? [product.imageUrl] : undefined,
    },
  };
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const { t } = await getTranslations();
  const result = await api.product(slug);
  if (!result?.data) notFound();

  const product = result.data;
  const related = (result.related as unknown as typeof product[] | undefined) ?? [];
  const image = product.imageUrl ?? product.variants.find((v) => v.imageUrl)?.imageUrl ?? null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <nav className="mb-6 flex flex-wrap gap-1.5 text-sm text-slate-500">
        <Link href="/" className="hover:text-navy-700">{t('nav.home')}</Link>
        <span>/</span>
        <Link href={`/marques/${product.brand.slug}`} className="hover:text-navy-700">{product.brand.name}</Link>
        <span>/</span>
        <Link href={`/produits?type=${product.chargerType.slug}`} className="hover:text-navy-700">
          {product.chargerType.name}
        </Link>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={product.name} className="mx-auto h-80 w-full object-contain" />
          ) : (
            <div className="flex h-80 items-center justify-center text-5xl font-black text-navy-100">
              PLUG<span className="text-plug-400">IN</span>
            </div>
          )}
        </div>

        <div>
          <Link href={`/marques/${product.brand.slug}`} className="text-sm font-bold uppercase tracking-wide text-plug-500">
            {product.brand.name}
          </Link>
          <h1 className="mt-1 text-3xl font-extrabold text-navy-900">{product.name}</h1>
          {product.subType && (
            <p className="mt-1 text-sm text-slate-500">
              {product.chargerType.name} · {product.subType}
            </p>
          )}
          <div className="mt-6">
            <ProductPurchase product={product} />
          </div>
        </div>
      </div>

      {product.description && (
        <section className="mt-12 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-3 text-xl font-bold text-navy-900">{t('product.details')}</h2>
          <p className="whitespace-pre-line leading-relaxed text-slate-700">{product.description}</p>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-12">
          <SectionTitle title={t('product.related')} />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {related.map((item) => <ProductCard key={item.id} product={item} />)}
          </div>
        </section>
      )}
    </div>
  );
}
