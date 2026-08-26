import type { Metadata } from 'next';
import { api } from '@/lib/api';
import { getTranslations } from '@/lib/locale-server';
import { PackCard, SectionTitle } from '@/components/Cards';

export const metadata: Metadata = {
  title: 'Packs de gros',
  description: 'Packs de chargeurs en gros pour revendeurs : 10, 12, 20 unités. Prix dégressifs et livraison Yalidine.',
};
export const revalidate = 60;

export default async function PacksPage() {
  const { t } = await getTranslations();
  const packs = await api.packs();
  const list = packs?.data ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <SectionTitle
        title={t('pack.title')}
        subtitle={`${list.length} ${t('pack.available')}`}
      />
      {list.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {list.map((pack) => <PackCard key={pack.id} pack={pack} />)}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-500">
          {t('pack.empty')}
        </div>
      )}
    </div>
  );
}
