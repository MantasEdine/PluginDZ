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
      <SectionTitle as="h1" title={t('nav.brands')} subtitle={t('home.brandsSub')} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {/* `p-4` sur petit écran et `break-words` : à 280 px, une marge de 24 px de
            chaque côté ne laissait plus la place d'écrire « Samsung ». */}
        {(brands?.data ?? []).map((brand) => (
          <Link key={brand.id} href={`/marques/${brand.slug}`} className="card p-4 text-center sm:p-6">
            <p className="break-words text-base font-bold text-navy-700 sm:text-lg">{brand.name}</p>
            <p className="mt-1 text-sm text-slate-500">
              {brand.productCount} {t('brand.products')}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
