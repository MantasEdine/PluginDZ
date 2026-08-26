'use client';

import { useState } from 'react';
import { PUBLIC_API_URL } from '@/lib/api';
import { formatDa } from '@/lib/format';
import { useI18n } from '@/components/LocaleProvider';
import type { MessageKey } from '@/lib/i18n';

interface Tracked {
  reference: string; status: string; total: number; customerWilaya: string;
  items: { label: string; quantity: number; unitPrice: number }[];
}

export default function TrackingPage() {
  const { locale, t } = useI18n();
  const [order, setOrder] = useState<Tracked | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setOrder(null);

    const form = new FormData(event.currentTarget);
    const query = new URLSearchParams({
      reference: String(form.get('reference') ?? ''),
      phone: String(form.get('phone') ?? ''),
    });

    try {
      const response = await fetch(`${PUBLIC_API_URL}/api/orders/lookup?${query}`);
      const payload = await response.json();
      if (!response.ok) setError(payload.error ?? t('common.error'));
      else setOrder(payload.data as Tracked);
    } catch {
      setError(t('common.error'));
    }
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-3xl font-extrabold text-navy-900">{t('tracking.title')}</h1>
      <p className="mt-2 text-sm text-slate-500">{t('tracking.intro')}</p>

      <form onSubmit={submit} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <label className="label" htmlFor="reference">{t('confirm.reference')}</label>
          <input id="reference" name="reference" required placeholder="PLG-000001" className="field" dir="ltr" />
        </div>
        <div>
          <label className="label" htmlFor="phone">{t('checkout.phone')}</label>
          <input id="phone" name="phone" required inputMode="tel" className="field" dir="ltr" />
        </div>
        <button type="submit" disabled={loading} className="btn-accent w-full">
          {loading ? t('common.loading') : t('tracking.submit')}
        </button>
      </form>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {order && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-lg font-extrabold text-navy-700" dir="ltr">{order.reference}</span>
            <span className="badge bg-navy-50 text-navy-700">
              {t(`status.${order.status}` as MessageKey)}
            </span>
          </div>
          <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
            {order.items.map((item, index) => (
              <li key={index} className="flex justify-between gap-3">
                <span className="text-slate-600">{item.label} × {item.quantity}</span>
                <span className="font-semibold">{formatDa(item.unitPrice * item.quantity, locale)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex justify-between border-t border-slate-200 pt-3">
            <span className="font-semibold">{t('cart.total')}</span>
            <span className="font-extrabold text-navy-700">{formatDa(order.total, locale)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
