import { ListPageSkeleton } from '@/components/PageSkeletons';

/** Le catalogue a une barre de filtres : on lui réserve sa place. */
export default function Loading() {
  return <ListPageSkeleton cards={8} withFilters />;
}
