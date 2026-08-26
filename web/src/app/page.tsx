import Link from 'next/link';
import { api } from '@/lib/api';
import { getTranslations } from '@/lib/locale-server';
import { PackCard, ProductCard, SectionTitle } from '@/components/Cards';

export const revalidate = 60;

export default async function HomePage() {
  const { t } = await getTranslations();
  const [packs, promos, brands, types] = await Promise.all([
    api.packs(true),
    api.promos(8),
    api.brands(),
    api.chargerTypes(),
  ]);

  return (
    <>
      <section className="bg-navy-700 text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-14 md:grid-cols-2">
          <div>
            <span className="badge bg-plug-500 text-white">{t('home.heroTag')}</span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl">
              {t('home.heroTitle')}
            </h1>
            <p className="mt-4 max-w-lg text-white/80">{t('home.heroText')}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/packs" className="btn-accent">{t('home.heroCta')}</Link>
              <Link href="/produits" className="btn border border-white/40 text-white hover:bg-white/10">
                {t('home.heroCta2')}
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {types?.data?.slice(0, 4).map((type) => (
              <Link
                key={type.id}
                href={`/produits?type=${type.slug}`}
                className="rounded-xl border border-white/15 bg-white/5 p-4 transition hover:bg-white/10"
              >
                <p className="font-semibold">{type.name}</p>
                <p className="mt-1 text-sm text-white/60">
                  {type.productCount} {t('brand.products')}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:grid-cols-3">
          {[
            [t('home.arg1Title'), t('home.arg1Text')],
            [t('home.arg2Title'), t('home.arg2Text')],
            [t('home.arg3Title'), t('home.arg3Text')],
          ].map(([title, text]) => (
            <div key={title}>
              <p className="font-bold text-navy-700">{title}</p>
              <p className="mt-1 text-sm text-slate-500">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-12">
        {packs?.data && packs.data.length > 0 && (
          <section className="mb-14">
            <SectionTitle
              title={t('home.packs')}
              subtitle={t('home.packsSub')}
              href="/packs"
              linkLabel={t('home.seeAll')}
            />
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {packs.data.slice(0, 4).map((pack) => <PackCard key={pack.id} pack={pack} />)}
            </div>
          </section>
        )}

        {promos?.data && promos.data.length > 0 && (
          <section className="mb-14">
            <SectionTitle
              title={t('home.promos')}
              subtitle={t('home.promosSub')}
              href="/produits?promo=true"
              linkLabel={t('home.seeAll')}
            />
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {promos.data.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          </section>
        )}

        {brands?.data && brands.data.length > 0 && (
          <section>
            <SectionTitle
              title={t('home.brands')}
              subtitle={t('home.brandsSub')}
              href="/marques"
              linkLabel={t('home.seeAll')}
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {brands.data.map((brand) => (
                <Link
                  key={brand.id}
                  href={`/marques/${brand.slug}`}
                  className="card flex flex-col items-center justify-center p-4 text-center"
                >
                  <span className="text-base font-bold text-navy-700">{brand.name}</span>
                  <span className="mt-1 text-xs text-slate-500">
                    {brand.productCount} {t('brand.products')}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
