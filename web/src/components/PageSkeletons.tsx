import { SkeletonCardGrid, SkeletonDetail, SkeletonHeading, SkeletonLine } from './Skeleton';
import { getTranslations } from '@/lib/locale-server';

/**
 * Écrans d'attente complets, partagés par les fichiers `loading.tsx`.
 *
 * Next.js impose un `loading.tsx` par segment de route ; sans ce fichier commun,
 * les six segments du site répéteraient la même mise en page. Ils tiennent donc
 * ici, et chaque `loading.tsx` se contente de choisir le bon gabarit.
 *
 * Ce sont des composants serveur : ils lisent la langue du visiteur pour que même
 * le texte lu par les lecteurs d'écran soit traduit.
 */

/** Liste : titre, filtres optionnels, puis grille de cartes. */
export async function ListPageSkeleton({
  cards = 8,
  withFilters = false,
}: {
  cards?: number;
  withFilters?: boolean;
}) {
  const { t } = await getTranslations();
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <SkeletonHeading />
      {withFilters && (
        <div className="mb-5 flex flex-wrap gap-2" aria-hidden="true">
          <SkeletonLine className="h-10 w-36" />
          <SkeletonLine className="h-10 w-36" />
          <SkeletonLine className="h-10 w-28" />
        </div>
      )}
      <SkeletonCardGrid count={cards} label={t('common.loading')} />
    </div>
  );
}

/** Fiche : image à gauche, bloc d'achat à droite. */
export async function DetailPageSkeleton() {
  const { t } = await getTranslations();
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <SkeletonDetail label={t('common.loading')} />
    </div>
  );
}
