import { SkeletonCardGrid, SkeletonLine } from '@/components/Skeleton';
import { getTranslations } from '@/lib/locale-server';

/**
 * Attente de la page d'accueil.
 *
 * Elle reproduit la bannière bleue puis une grille de cartes : le visiteur voit
 * immédiatement la silhouette du site, au lieu d'un écran vide pendant que les
 * produits, packs et marques arrivent du serveur.
 */
export default async function Loading() {
  const { t } = await getTranslations();
  return (
    <div role="status" aria-busy="true" aria-label={t('common.loading')}>
      {/* Bannière : mêmes couleurs que la vraie, pour éviter un flash blanc. */}
      <section className="bg-navy-700" aria-hidden="true">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-14 md:grid-cols-2">
          <div className="space-y-4">
            <div className="h-5 w-40 rounded-full bg-white/20" />
            <div className="h-10 w-11/12 rounded bg-white/15" />
            <div className="h-10 w-3/4 rounded bg-white/15" />
            <div className="h-4 w-full rounded bg-white/10" />
            <div className="flex gap-3 pt-3">
              <div className="h-11 w-40 rounded-lg bg-white/20" />
              <div className="h-11 w-36 rounded-lg bg-white/10" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-20 rounded-xl border border-white/15 bg-white/5" />
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10">
        <SkeletonLine className="mb-5 h-7 w-52" />
        <SkeletonCardGrid count={4} label={t('common.loading')} />
      </div>
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  );
}
