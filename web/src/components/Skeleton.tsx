/**
 * Blocs d'attente réutilisables.
 *
 * Ils reprennent la forme exacte du contenu qu'ils remplacent — une grille de
 * cartes ressemble à une grille de cartes — pour que la page ne saute pas au
 * moment où les vraies données arrivent.
 *
 * `aria-hidden` : un lecteur d'écran n'a rien à annoncer sur une forme vide ;
 * le conteneur porte `aria-busy` et le texte d'attente.
 */

export function SkeletonLine({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

/** Une carte produit ou pack : vignette, titre, prix, pastille de stock. */
export function SkeletonCard() {
  return (
    <div className="card flex flex-col overflow-hidden" aria-hidden="true">
      <div className="skeleton h-44 w-full rounded-none" />
      <div className="flex flex-1 flex-col gap-2 border-t border-slate-100 p-3">
        <SkeletonLine className="h-3.5 w-11/12" />
        <SkeletonLine className="h-3.5 w-2/3" />
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <SkeletonLine className="h-5 w-24" />
          <SkeletonLine className="h-5 w-16" />
        </div>
      </div>
    </div>
  );
}

/** Grille de cartes, au même gabarit que les listes du catalogue. */
export function SkeletonCardGrid({ count = 8, label }: { count?: number; label: string }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: count }, (_, i) => <SkeletonCard key={i} />)}
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** En-tête de page : titre et sous-titre. */
export function SkeletonHeading() {
  return (
    <div className="mb-5 space-y-2" aria-hidden="true">
      <SkeletonLine className="h-7 w-56" />
      <SkeletonLine className="h-3.5 w-36" />
    </div>
  );
}

/** Fiche produit ou pack : image à gauche, achat à droite. */
export function SkeletonDetail({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={label}>
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="skeleton h-80 w-full" />
        </div>
        <div className="space-y-5">
          <SkeletonLine className="h-8 w-4/5" />
          <SkeletonLine className="h-10 w-40" />
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-navy-50 p-4">
            <SkeletonLine className="h-10 w-full" />
            <SkeletonLine className="h-10 w-full" />
          </div>
          <div className="flex gap-3">
            <SkeletonLine className="h-11 w-28" />
            <SkeletonLine className="h-11 w-44" />
          </div>
        </div>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Lignes d'un tableau ou d'une liste (panier, commandes, suivi). */
export function SkeletonRows({ rows = 3, label }: { rows?: number; label: string }) {
  return (
    <div className="space-y-3" role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-4" aria-hidden="true">
          <div className="skeleton h-20 w-20 shrink-0" />
          <div className="flex-1 space-y-2">
            <SkeletonLine className="h-4 w-3/5" />
            <SkeletonLine className="h-3 w-1/3" />
            <SkeletonLine className="h-8 w-28" />
          </div>
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

/** Tuiles chiffrées du back-office. */
export function SkeletonTiles({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-busy="true" aria-label="Chargement des chiffres">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-xl border border-slate-200 bg-white p-5" aria-hidden="true">
          <SkeletonLine className="h-3.5 w-32" />
          <SkeletonLine className="mt-2 h-7 w-24" />
        </div>
      ))}
      <span className="sr-only">Chargement des chiffres</span>
    </div>
  );
}
