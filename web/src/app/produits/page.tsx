import Link from 'next/link';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { getTranslations } from '@/lib/locale-server';
import { ProductCard } from '@/components/Cards';
import { Filters } from '@/components/Filters';

export const metadata: Metadata = {
  title: 'Catalogue de chargeurs',
  description: 'Tous les chargeurs disponibles en gros et demi-gros : téléphone, montre, caméra, vélo électrique.',
};

type Search = Promise<Record<string, string | string[] | undefined>>;

function pick(params: Record<string, string | string[] | undefined>, key: string): string {
  const value = params[key];
  return typeof value === 'string' ? value : '';
}

export default async function ProductsPage({ searchParams }: { searchParams: Search }) {
  const params = await searchParams;
  const { t } = await getTranslations();

  const page = Number(pick(params, 'page')) || 1;
  const query = new URLSearchParams();
  for (const key of ['brand', 'type', 'subType', 'search', 'promo', 'sort']) {
    const value = pick(params, key);
    if (value) query.set(key, value);
  }
  query.set('page', String(page));
  query.set('perPage', '24');

  const [products, brands, types] = await Promise.all([
    api.products(`?${query.toString()}`),
    api.brands(),
    api.chargerTypes(),
  ]);

  // Les sous-types proposés dépendent du type sélectionné : rien n'est codé en dur.
  const typeSlug = pick(params, 'type');
  const typeDetail = typeSlug ? await api.chargerType(typeSlug) : null;
  const subTypes = typeDetail?.data?.subTypes ?? [];

  const meta = products?.meta;
  const pageCount = meta?.pageCount ?? 1;

  function pageHref(target: number) {
    const next = new URLSearchParams(query);
    next.set('page', String(target));
    next.delete('perPage');
    return `/produits?${next.toString()}`;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="mb-1 text-3xl font-extrabold text-navy-900">
        {pick(params, 'promo') === 'true' ? t('nav.promos') : t('nav.products')}
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        {meta?.total ?? 0} {t('list.results')}
      </p>

      <Suspense fallback={null}>
        <Filters brands={brands?.data ?? []} types={types?.data ?? []} subTypes={subTypes} />
      </Suspense>

      {products?.data && products.data.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {products.data.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
          {t('list.empty')}
        </div>
      )}

      {pageCount > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3">
          {page > 1 && <Link href={pageHref(page - 1)} className="btn-outline">{t('list.prev')}</Link>}
          <span className="text-sm text-slate-500">{t('list.page')} {page} / {pageCount}</span>
          {page < pageCount && <Link href={pageHref(page + 1)} className="btn-outline">{t('list.next')}</Link>}
        </div>
      )}
    </div>
  );
}
