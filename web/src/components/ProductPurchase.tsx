'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDa } from '@/lib/format';
import type { Product, Variant } from '@/lib/api';
import { useI18n } from './LocaleProvider';
import { useCart } from './CartProvider';
import { StockBadge } from './Cards';

function options(variants: Variant[], key: 'color' | 'power' | 'plugType'): string[] {
  return [...new Set(variants.map((v) => v[key]).filter(Boolean) as string[])];
}

/** Sélecteurs de déclinaison + ajout au panier. Aucun sélecteur si le produit n'en a qu'une. */
export function ProductPurchase({ product }: { product: Product }) {
  const { locale, t } = useI18n();
  const { add } = useCart();
  const [selectedId, setSelectedId] = useState<number>(product.variants[0]?.id ?? 0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const colors = useMemo(() => options(product.variants, 'color'), [product.variants]);
  const powers = useMemo(() => options(product.variants, 'power'), [product.variants]);
  const plugs = useMemo(() => options(product.variants, 'plugType'), [product.variants]);

  const variant = product.variants.find((v) => v.id === selectedId) ?? product.variants[0];
  if (!variant) {
    return <p className="text-slate-500">{t('product.outOfStock')}</p>;
  }

  /** Bascule vers la première déclinaison correspondant au critère choisi. */
  function choose(key: 'color' | 'power' | 'plugType', value: string) {
    const match = product.variants.find((v) => v[key] === value);
    if (match) {
      setSelectedId(match.id);
      setQuantity(1);
    }
  }

  function renderGroup(label: string, key: 'color' | 'power' | 'plugType', values: string[]) {
    if (values.length < 2) return null;
    return (
      <div>
        <span className="label">{label}</span>
        <div className="flex flex-wrap gap-2">
          {values.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => choose(key, value)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                variant![key] === value
                  ? 'border-navy-700 bg-navy-700 text-white'
                  : 'border-slate-300 bg-white text-navy-800 hover:border-plug-500'
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end gap-3">
        {variant.oldPrice && variant.oldPrice > variant.price && (
          <span className="text-lg text-slate-400 line-through">{formatDa(variant.oldPrice, locale)}</span>
        )}
        <span className="text-3xl font-extrabold text-navy-700">{formatDa(variant.price, locale)}</span>
        <StockBadge stock={variant.stock} />
      </div>

      {renderGroup(t('product.color'), 'color', colors)}
      {renderGroup(t('product.power'), 'power', powers)}
      {renderGroup(t('product.plug'), 'plugType', plugs)}

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-28">
          <label className="label" htmlFor="quantity">{t('product.quantity')}</label>
          <input
            id="quantity"
            type="number"
            min={1}
            max={Math.max(1, variant.stock)}
            value={quantity}
            onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
            className="field"
          />
        </div>
        <button
          type="button"
          disabled={variant.stock <= 0}
          onClick={() => {
            add({
              variantId: variant.id,
              name: product.name,
              detail: variant.label,
              unitPrice: variant.price,
              quantity: Math.min(quantity, variant.stock),
              stock: variant.stock,
              imageUrl: variant.imageUrl ?? product.imageUrl,
              slug: product.slug,
              isPack: false,
            });
            setAdded(true);
          }}
          className="btn-accent h-11"
        >
          {t('product.addToCart')}
        </button>
        {added && (
          <Link href="/panier" className="text-sm font-semibold text-emerald-600 hover:underline">
            ✓ {t('product.added')} — {t('nav.cart')} →
          </Link>
        )}
      </div>
      {variant.sku && (
        <p className="text-xs text-slate-400">{t('product.reference')} : {variant.sku}</p>
      )}
    </div>
  );
}
