'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import type { BrandSummary, ChargerTypeSummary } from '@/lib/api';
import { useI18n } from './LocaleProvider';

/** Barre de filtres : chaque changement réécrit l'URL, donc l'état reste partageable. */
export function Filters({
  brands,
  types,
  subTypes,
}: {
  brands: BrandSummary[];
  types: ChargerTypeSummary[];
  subTypes: string[];
}) {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    // Un changement de filtre repart toujours de la première page.
    next.delete('page');
    router.push(`/produits?${next.toString()}`);
  }

  return (
    <div className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
      <input
        type="search"
        defaultValue={params.get('search') ?? ''}
        placeholder={t('list.search')}
        className="field lg:col-span-2"
        onKeyDown={(event) => {
          if (event.key === 'Enter') update('search', event.currentTarget.value.trim());
        }}
      />
      <select className="field" value={params.get('brand') ?? ''} onChange={(e) => update('brand', e.target.value)}>
        <option value="">{t('list.allBrands')}</option>
        {brands.map((brand) => (
          <option key={brand.id} value={brand.slug}>{brand.name}</option>
        ))}
      </select>
      <select className="field" value={params.get('type') ?? ''} onChange={(e) => update('type', e.target.value)}>
        <option value="">{t('list.allTypes')}</option>
        {types.map((type) => (
          <option key={type.id} value={type.slug}>{type.name}</option>
        ))}
      </select>
      <select className="field" value={params.get('sort') ?? 'recent'} onChange={(e) => update('sort', e.target.value)}>
        <option value="recent">{t('list.sortRecent')}</option>
        <option value="prix-asc">{t('list.sortPriceAsc')}</option>
        <option value="prix-desc">{t('list.sortPriceDesc')}</option>
        <option value="promo">{t('list.sortPromo')}</option>
      </select>

      {subTypes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 lg:col-span-5">
          <button type="button" onClick={() => update('subType', '')} className="badge bg-slate-100 text-slate-600">
            {t('list.allSubTypes')}
          </button>
          {subTypes.map((subType) => (
            <button
              key={subType}
              type="button"
              onClick={() => update('subType', subType)}
              className={`badge ${
                params.get('subType') === subType ? 'bg-navy-700 text-white' : 'bg-navy-50 text-navy-700'
              }`}
            >
              {subType}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
