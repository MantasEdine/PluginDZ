'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PUBLIC_API_URL, type Wilaya } from '@/lib/api';
import { formatDa } from '@/lib/format';
import { useCart } from '@/components/CartProvider';
import { useI18n } from '@/components/LocaleProvider';

export default function CheckoutPage() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const { lines, total, ready, clear } = useCart();
  const [wilayas, setWilayas] = useState<Wilaya[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`${PUBLIC_API_URL}/api/wilayas`)
      .then((response) => response.json())
      .then((payload) => setWilayas(payload.data ?? []))
      .catch(() => setWilayas([]));
  }, []);

  useEffect(() => {
    if (ready && lines.length === 0) router.replace('/panier');
  }, [ready, lines.length, router]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${PUBLIC_API_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: form.get('customerName'),
          customerPhone: form.get('customerPhone'),
          customerWilaya: form.get('customerWilaya'),
          customerAddress: form.get('customerAddress'),
          customerNote: form.get('customerNote') || undefined,
          items: lines.map((line) =>
            line.isPack
              ? { packId: line.packId, quantity: line.quantity }
              : { variantId: line.variantId, quantity: line.quantity },
          ),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? t('common.error'));
        setSubmitting(false);
        return;
      }

      // La confirmation lit ce résumé : la commande est déjà enregistrée côté serveur.
      window.sessionStorage.setItem('plugin_last_order', JSON.stringify(payload.data));
      clear();
      router.push('/commande/confirmation');
    } catch {
      setError(t('common.error'));
      setSubmitting(false);
    }
  }

  if (!ready) return <div className="mx-auto max-w-4xl px-4 py-16 text-slate-500">{t('common.loading')}</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-extrabold text-navy-900">{t('checkout.title')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-500">{t('checkout.intro')}</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <div>
            <label className="label" htmlFor="customerName">{t('checkout.name')}</label>
            <input id="customerName" name="customerName" required minLength={3} className="field" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="customerPhone">{t('checkout.phone')}</label>
              <input
                id="customerPhone"
                name="customerPhone"
                required
                inputMode="tel"
                placeholder="0555 12 34 56"
                className="field"
                dir="ltr"
              />
            </div>
            <div>
              <label className="label" htmlFor="customerWilaya">{t('checkout.wilaya')}</label>
              <select id="customerWilaya" name="customerWilaya" required className="field" defaultValue="">
                <option value="" disabled>{t('checkout.selectWilaya')}</option>
                {wilayas.map((wilaya) => (
                  <option key={wilaya.code} value={wilaya.name}>
                    {String(wilaya.code).padStart(2, '0')} — {wilaya.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="customerAddress">{t('checkout.address')}</label>
            <textarea id="customerAddress" name="customerAddress" required minLength={5} rows={3} className="field" />
          </div>
          <div>
            <label className="label" htmlFor="customerNote">{t('checkout.note')}</label>
            <textarea id="customerNote" name="customerNote" rows={2} className="field" />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-accent w-full">
            {submitting ? t('checkout.sending') : t('checkout.submit')}
          </button>
        </form>

        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-bold text-navy-900">{t('checkout.summary')}</h2>
          <ul className="space-y-2 text-sm">
            {lines.map((line) => (
              <li key={line.key} className="flex justify-between gap-3">
                <span className="min-w-0 text-slate-600">
                  {line.name} <span className="text-slate-400">× {line.quantity}</span>
                </span>
                <span className="shrink-0 font-semibold">{formatDa(line.unitPrice * line.quantity, locale)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex justify-between border-t border-slate-200 pt-3 text-lg">
            <span className="font-semibold">{t('cart.total')}</span>
            <span className="font-extrabold text-navy-700">{formatDa(total, locale)}</span>
          </div>
          <Link href="/panier" className="mt-3 block text-center text-sm text-plug-500 hover:underline">
            {t('cart.title')}
          </Link>
        </aside>
      </div>
    </div>
  );
}
