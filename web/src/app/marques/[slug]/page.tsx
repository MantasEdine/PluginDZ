import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { getTranslations } from '@/lib/locale-server';
import { ProductCard, SectionTitle } from '@/components/Cards';

export const revalidate = 60;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const brand = await api.brand(slug);
  if (!brand?.data) return { title: 'Marque' };
  return {
    title: `Chargeurs ${brand.data.name}`,
    description: `Chargeurs ${brand.data.name} en gros et demi-gros — prix revendeur, livraison Yalidine.`,
  };
}

export default async function BrandPage({ params }: Params) {
  const { slug } = await params;
  const { t } = await getTranslations();
  const [brand, products] = await Promise.all([
    api.brand(slug),
    api.products(`?brand=${slug}&perPage=24`),
  ]);

  if (!brand?.data) notFound();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-3xl font-extrabold text-navy-900">{brand.data.name}</h1>

      {/* Types affichés = uniquement ceux réellement en stock pour cette marque. */}
      {brand.data.chargerTypes.length > 0 ? (
        <>
          <p className="mt-1 text-sm text-slate-500">{t('brand.types')}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {brand.data.chargerTypes.map((type) => (
              <div key={type.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <Link
                  href={`/produits?brand=${slug}&type=${type.slug}`}
                  className="font-semibold text-navy-700 hover:text-plug-500"
                >
                  {type.name} <span className="text-xs text-slate-400">({type.productCount})</span>
                </Link>
                {type.subTypes && type.subTypes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {type.subTypes.map((subType) => (
                      <Link
                        key={subType}
                        href={`/produits?brand=${slug}&type=${type.slug}&subType=${encodeURIComponent(subType)}`}
                        className="badge bg-navy-50 text-navy-700 hover:bg-navy-100"
                      >
                        {subType}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-4 text-slate-500">{t('brand.empty')}</p>
      )}

      <div className="mt-10">
        <SectionTitle title={t('nav.products')} />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {(products?.data ?? []).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </div>
  );
}
