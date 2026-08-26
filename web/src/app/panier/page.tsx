'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatDa } from '@/lib/format';
import { PUBLIC_API_URL, type Pack, type Product } from '@/lib/api';
import { useCart } from '@/components/CartProvider';
import { useI18n } from '@/components/LocaleProvider';

export default function CartPage() {
    return (
        <Suspense fallback={<div className="mx-auto max-w-4xl px-4 py-16 text-slate-500" />}>
            <CartPageInner />
        </Suspense>
    );
}

/**
 * Liens publicitaires : /panier?produit=slug&variant=45&qty=2
 * ou /panier?pack=slug&qty=1. La ligne est ajoutée puis l'URL est nettoyée
 * pour qu'un rafraîchissement ne double pas la commande.
 */
function useAddFromUrl() {
    const { add, ready } = useCart();
    const router = useRouter();
    const params = useSearchParams();
    const done = useRef(false);
    const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

    const productSlug = params.get('produit');
    const packSlug = params.get('pack');
    const variantParam = params.get('variant');
    const qtyParam = params.get('qty');

    useEffect(() => {
        if (done.current) return;
        if (!productSlug && !packSlug) return;
        if (!ready) return;

        done.current = true;
        setStatus('loading');
        const wanted = Math.max(1, Number(qtyParam) || 1);

        async function run() {
            try {
                if (packSlug) {
                    const response = await fetch(`${PUBLIC_API_URL}/api/packs/${packSlug}`);
                    if (!response.ok) throw new Error('introuvable');
                    const { data: pack } = (await response.json()) as { data: Pack };
                    if (pack.stock <= 0) throw new Error('rupture');
                    add({
                        packId: pack.id,
                        name: pack.name,
                        unitPrice: pack.price,
                        quantity: Math.min(wanted, pack.stock),
                        stock: pack.stock,
                        imageUrl: pack.imageUrl,
                        slug: pack.slug,
                        isPack: true,
                    });
                } else {
                    const response = await fetch(`${PUBLIC_API_URL}/api/products/${productSlug}`);
                    if (!response.ok) throw new Error('introuvable');
                    const { data: product } = (await response.json()) as { data: Product };

                    const requested = Number(variantParam);
                    const variant =
                        product.variants.find((v) => v.id === requested) ??
                        product.variants.find((v) => v.isDefault && v.stock > 0) ??
                        product.variants.find((v) => v.stock > 0);

                    if (!variant) throw new Error('rupture');

                    add({
                        variantId: variant.id,
                        name: product.name,
                        detail: variant.label,
                        unitPrice: variant.price,
                        quantity: Math.min(wanted, variant.stock),
                        stock: variant.stock,
                        imageUrl: variant.imageUrl ?? product.imageUrl,
                        slug: product.slug,
                        isPack: false,
                    });
                }
                setStatus('idle');
            } catch {
                setStatus('error');
            } finally {
                router.replace('/panier');
            }
        }

        void run();
    }, [ready, productSlug, packSlug, variantParam, qtyParam, add, router]);

    return status;
}

function CartPageInner() {
    const { locale, t } = useI18n();
    const { lines, total, ready, setQuantity, remove } = useCart();
    const status = useAddFromUrl();

    if (!ready || status === 'loading') {
        return <div className="mx-auto max-w-4xl px-4 py-16 text-slate-500">{t('common.loading')}</div>;
    }

    if (lines.length === 0) {
        return (
            <div className="mx-auto max-w-4xl px-4 py-16 text-center">
                <h1 className="text-2xl font-extrabold text-navy-900">{t('cart.title')}</h1>
                {status === 'error' && (
                    <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                        Ce produit n&apos;est plus disponible.
                    </p>
                )}
                <p className="mt-3 text-slate-500">{t('cart.empty')}</p>
                <Link href="/produits" className="btn-primary mt-6">{t('cart.continue')}</Link>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-5xl px-4 py-10">
            <h1 className="mb-6 text-3xl font-extrabold text-navy-900">{t('cart.title')}</h1>

            {status === 'error' && (
                <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
                    Ce produit n&apos;est plus disponible.
                </p>
            )}

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="space-y-3 lg:col-span-2">
                    {lines.map((line) => (
                        <div key={line.key} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4">
                            <div className="h-20 w-20 shrink-0 rounded-lg bg-navy-50">
                                {line.imageUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={line.imageUrl} alt={line.name} className="h-full w-full object-contain p-1" />
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <Link
                                    href={line.isPack ? `/packs/${line.slug}` : `/produits/${line.slug}`}
                                    className="font-semibold text-navy-900 hover:text-plug-500"
                                >
                                    {line.name}
                                </Link>
                                {line.isPack && <span className="badge ms-2 bg-navy-700 text-white">{t('cart.pack')}</span>}
                                {line.detail && <p className="text-sm text-slate-500">{line.detail}</p>}
                                <p className="mt-1 text-sm text-slate-500">
                                    {t('cart.unitPrice')} : {formatDa(line.unitPrice, locale)}
                                </p>
                                <div className="mt-2 flex items-center gap-3">
                                    <input
                                        type="number"
                                        min={1}
                                        max={line.stock}
                                        value={line.quantity}
                                        onChange={(event) => setQuantity(line.key, Number(event.target.value) || 1)}
                                        className="field w-24 py-1.5"
                                        aria-label={t('product.quantity')}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => remove(line.key)}
                                        className="text-sm text-red-600 hover:underline"
                                    >
                                        {t('cart.remove')}
                                    </button>
                                </div>
                            </div>
                            <div className="shrink-0 text-end font-bold text-navy-700">
                                {formatDa(line.unitPrice * line.quantity, locale)}
                            </div>
                        </div>
                    ))}
                </div>
                <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5">
                    <div className="flex items-center justify-between text-lg">
                        <span className="font-semibold text-navy-900">{t('cart.total')}</span>
                        <span className="font-extrabold text-navy-700">{formatDa(total, locale)}</span>
                    </div>
                    <Link href="/commande" className="btn-accent mt-5 w-full">{t('cart.checkout')}</Link>
                    <Link href="/produits" className="btn-outline mt-2 w-full">{t('cart.continue')}</Link>
                </aside>
            </div>
        </div>
    );
}
