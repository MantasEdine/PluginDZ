import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { formatDa } from '@/lib/format';
import { getLocale, getTranslations } from '@/lib/locale-server';
import { PackPurchase } from '@/components/PackPurchase';

export const revalidate = 60;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const pack = await api.pack(slug);
  if (!pack?.data) return { title: 'Pack' };
  return {
    title: pack.data.name,
    description: pack.data.description.slice(0, 160),
  };
}

export default async function PackPage({ params }: Params) {
  const { slug } = await params;
  const [{ t }, locale, result] = await Promise.all([getTranslations(), getLocale(), api.pack(slug)]);
  if (!result?.data) notFound();
  const pack = result.data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <nav className="mb-6 text-sm text-slate-500">
        <Link href="/packs" className="hover:text-navy-700">{t('pack.title')}</Link>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          {pack.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pack.imageUrl} alt={pack.name} className="mx-auto h-80 w-full object-contain" />
          ) : (
            <div className="flex h-80 items-center justify-center text-5xl font-black text-navy-100">
              PLUG<span className="text-plug-400">IN</span>
            </div>
          )}
        </div>

        <div>
          <h1 className="text-3xl font-extrabold text-navy-900">{pack.name}</h1>
          <div className="mt-6">
            <PackPurchase pack={pack} />
          </div>
        </div>
      </div>

      {pack.description && (
        <section className="mt-12 rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="mb-3 text-xl font-bold text-navy-900">{t('product.details')}</h2>
          <p className="whitespace-pre-line leading-relaxed text-slate-700">{pack.description}</p>
        </section>
      )}

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-xl font-bold text-navy-900">{t('pack.contains')}</h2>
        <ul className="divide-y divide-slate-100">
          {pack.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-4 py-3">
              <Link href={`/produits/${item.productSlug}`} className="text-sm font-medium text-navy-800 hover:text-plug-500">
                {item.label}
              </Link>
              <span className="shrink-0 text-sm text-slate-500">
                × {item.quantity} · {formatDa(item.unitPrice, locale)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
