'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDa } from '@/lib/format';
import type { Pack } from '@/lib/api';
import { useI18n } from './LocaleProvider';
import { useCart } from './CartProvider';

export function PackPurchase({ pack }: { pack: Pack }) {
  const { locale, t } = useI18n();
  const { add } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-end gap-3">
        {pack.oldPrice && pack.oldPrice > pack.price && (
          <span className="text-lg text-slate-400 line-through">{formatDa(pack.oldPrice, locale)}</span>
        )}
        <span className="text-3xl font-extrabold text-navy-700">{formatDa(pack.price, locale)}</span>
      </div>

      <dl className="grid grid-cols-2 gap-3 rounded-xl bg-navy-50 p-4 text-sm">
        <div>
          <dt className="text-slate-500">{t('pack.units')}</dt>
          <dd className="font-bold text-navy-800">{pack.totalUnits}</dd>
        </div>
        <div>
          <dt className="text-slate-500">{t('pack.unitValue')}</dt>
          <dd className="font-bold text-navy-800">{formatDa(pack.unitValue, locale)}</dd>
        </div>
        {pack.savings > 0 && (
          <div className="col-span-2">
            <dt className="text-slate-500">{t('pack.savings')}</dt>
            <dd className="text-lg font-extrabold text-emerald-600">{formatDa(pack.savings, locale)}</dd>
          </div>
        )}
      </dl>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-28">
          <label className="label" htmlFor="pack-quantity">{t('product.quantity')}</label>
          <input
            id="pack-quantity"
            type="number"
            min={1}
            max={Math.max(1, pack.stock)}
            value={quantity}
            onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
            className="field"
          />
        </div>
        <button
          type="button"
          disabled={pack.stock <= 0}
          onClick={() => {
            add({
              packId: pack.id,
              name: pack.name,
              unitPrice: pack.price,
              quantity: Math.min(quantity, pack.stock),
              stock: pack.stock,
              imageUrl: pack.imageUrl,
              slug: pack.slug,
              isPack: true,
            });
            setAdded(true);
          }}
          className="btn-accent h-11"
        >
          {t('product.addToCart')}
        </button>
        {added && (
          <Link href="/panier" className="text-sm font-semibold text-emerald-600 hover:underline">
            ✓ {t('product.added')} →
          </Link>
        )}
      </div>
    </div>
  );
}
