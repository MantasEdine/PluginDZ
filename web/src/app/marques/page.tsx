import Link from 'next/link';
import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { getTranslations } from '@/lib/locale-server';
import { SectionTitle } from '@/components/Cards';

export const metadata: Metadata = { title: 'Marques' };
export const revalidate = 60;

export default async function BrandsPage() {
  const { t } = await getTranslations();
  const brands = await api.brands();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <SectionTitle title={t('nav.brands')} subtitle={t('home.brandsSub')} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {(brands?.data ?? []).map((brand) => (
          <Link key={brand.id} href={`/marques/${brand.slug}`} className="card p-6 text-center">
            <p className="text-lg font-bold text-navy-700">{brand.name}</p>
            <p className="mt-1 text-sm text-slate-500">
              {brand.productCount} {t('brand.products')}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
