'use client';

import Link from 'next/link';
import { formatDa } from '@/lib/format';
import type { Pack, Product } from '@/lib/api';
import { useI18n } from './LocaleProvider';

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  if (!src) {
    return (
      <div className="flex h-44 items-center justify-center bg-navy-50 text-3xl font-black text-navy-100">
        PLUG<span className="text-plug-400">IN</span>
      </div>
    );
  }
  // <img> plutôt que next/image : les URLs viennent de l'API ou d'un CDN externe
  // et n'ont pas besoin d'optimisation côté Vercel.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="h-44 w-full bg-white object-contain p-3" loading="lazy" />;
}

export function StockBadge({ stock }: { stock: number }) {
  const { t } = useI18n();
  if (stock <= 0) return <span className="badge bg-slate-100 text-slate-500">{t('product.outOfStock')}</span>;
  if (stock <= 10) return <span className="badge bg-amber-100 text-amber-700">{t('product.lowStock')}</span>;
  return <span className="badge bg-emerald-100 text-emerald-700">{t('product.inStock')}</span>;
}

export function ProductCard({ product }: { product: Product }) {
  const { locale, t } = useI18n();
  const best = product.variants[0];
  const oldPrice = product.variants.find((v) => v.oldPrice && v.oldPrice > v.price)?.oldPrice ?? null;

  return (
    <Link href={`/produits/${product.slug}`} className="card group flex flex-col overflow-hidden">
      <div className="relative">
        <Thumb src={product.imageUrl ?? best?.imageUrl ?? null} alt={product.name} />
        {product.discountPercent > 0 && (
          <span className="badge absolute start-2 top-2 bg-red-600 text-white">
            -{product.discountPercent}%
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 border-t border-slate-100 p-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-plug-500">
          {product.brand.name}
        </span>
        <h3 className="line-clamp-2 text-sm font-semibold text-navy-900 group-hover:text-navy-700">
          {product.name}
        </h3>
        <div className="mt-auto flex items-end justify-between pt-2">
          <div>
            {oldPrice && (
              <span className="me-2 text-xs text-slate-400 line-through">{formatDa(oldPrice, locale)}</span>
            )}
            <span className="text-lg font-extrabold text-navy-700">
              {product.minPrice !== null ? formatDa(product.minPrice, locale) : '—'}
            </span>
            {product.maxPrice !== null && product.maxPrice !== product.minPrice && (
              <span className="ms-1 text-xs text-slate-500">+</span>
            )}
          </div>
          <StockBadge stock={product.totalStock} />
        </div>
        {product.subType && <span className="text-xs text-slate-500">{t('product.type')} : {product.subType}</span>}
      </div>
    </Link>
  );
}

export function PackCard({ pack }: { pack: Pack }) {
  const { locale, t } = useI18n();
  return (
    <Link href={`/packs/${pack.slug}`} className="card group flex flex-col overflow-hidden">
      <div className="relative">
        <Thumb src={pack.imageUrl ?? pack.items[0]?.imageUrl ?? null} alt={pack.name} />
        <span className="badge absolute start-2 top-2 bg-navy-700 text-white">
          {pack.totalUnits} {t('pack.units')}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 border-t border-slate-100 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-navy-900 group-hover:text-navy-700">
          {pack.name}
        </h3>
        <div className="mt-auto pt-2">
          {pack.oldPrice && pack.oldPrice > pack.price && (
            <span className="me-2 text-xs text-slate-400 line-through">{formatDa(pack.oldPrice, locale)}</span>
          )}
          <span className="text-lg font-extrabold text-navy-700">{formatDa(pack.price, locale)}</span>
          {pack.savings > 0 && (
            <p className="text-xs font-semibold text-emerald-600">
              {t('pack.savings')} {formatDa(pack.savings, locale)}
            </p>
          )}
        </div>
        <StockBadge stock={pack.stock} />
      </div>
    </Link>
  );
}

export function SectionTitle({ title, subtitle, href, linkLabel }: {
  title: string; subtitle?: string; href?: string; linkLabel?: string;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl font-extrabold text-navy-900">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {href && (
        <Link href={href} className="shrink-0 text-sm font-semibold text-plug-500 hover:underline">
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}
