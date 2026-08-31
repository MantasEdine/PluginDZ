'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { formatDa } from '@/lib/format';
import { useI18n } from '@/components/LocaleProvider';

const CONTACT_EMAIL = 'contact@plugin.dz';

interface Summary {
  reference: string;
  total: number;
  items: { label: string; quantity: number; unitPrice: number }[];
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-2xl px-4 py-16 text-center text-slate-500" />}>
      <ConfirmationPageInner />
    </Suspense>
  );
}

function ConfirmationPageInner() {
  const { locale, t } = useI18n();
  const params = useSearchParams();
  const [order, setOrder] = useState<Summary | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  async function copyReference(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Navigateur sans accès presse-papiers : repli sur une sélection manuelle.
      const area = document.createElement('textarea');
      area.value = value;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try { document.execCommand('copy'); } catch { /* rien de plus à tenter */ }
      document.body.removeChild(area);
    }
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  }

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem('plugin_last_order');
      if (raw) setOrder(JSON.parse(raw) as Summary);
    } catch {
      setOrder(null);
    }
    setLoaded(true);
  }, []);

  // L'URL fait foi : le résumé de session peut manquer (onglet neuf, stockage bloqué).
  const reference = params.get('ref') ?? order?.reference ?? null;
  const items = order?.items ?? [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-600">
        ✓
      </div>
      <h1 className="mt-5 text-3xl font-extrabold text-navy-900">{t('confirm.title')}</h1>
      <p className="mt-3 text-slate-600">{t('confirm.text')}</p>

      {reference && (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 text-start">
          <p className="text-sm text-slate-500">{t('confirm.reference')}</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <p className="text-2xl font-extrabold tracking-wide text-navy-700" dir="ltr">{reference}</p>
            <button
              type="button"
              onClick={() => copyReference(reference)}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-plug-500 px-3 py-1.5 text-sm font-semibold text-plug-500 transition hover:bg-plug-50"
              aria-live="polite"
            >
              {copied ? (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.3 3.3 6.8-6.8a1 1 0 0 1 1.4 0Z" clipRule="evenodd" />
                  </svg>
                  {t('confirm.copied')}
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                    <rect x="7" y="7" width="9" height="9" rx="2" />
                    <path d="M4 13V5a2 2 0 0 1 2-2h6" />
                  </svg>
                  {t('confirm.copy')}
                </>
              )}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">{t('confirm.copyHint')}</p>

          {items.length > 0 && (
            <>
              <ul className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-sm">
                {items.map((item, index) => (
                  <li key={index} className="flex justify-between gap-3">
                    <span className="text-slate-600">{item.label} × {item.quantity}</span>
                    <span className="font-semibold">{formatDa(item.unitPrice * item.quantity, locale)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex justify-between border-t border-slate-200 pt-3 text-lg">
                <span className="font-semibold">{t('cart.total')}</span>
                <span className="font-extrabold text-navy-700">{formatDa(order?.total ?? 0, locale)}</span>
              </div>
            </>
          )}
        </div>
      )}

      {loaded && !reference && (
        <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-6 text-start">
          <p className="text-sm text-amber-900">{t('confirm.noReference')}</p>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="mt-2 block font-semibold text-navy-700 hover:underline"
            dir="ltr"
          >
            {CONTACT_EMAIL}
          </a>
        </div>
      )}

      <Link href="/" className="btn-primary mt-8">{t('confirm.back')}</Link>
    </div>
  );
}
