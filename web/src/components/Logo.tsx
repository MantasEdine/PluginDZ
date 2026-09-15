/**
 * Pastille bleue à coche, dans le langage visuel des comptes officiels.
 *
 * Elle affirme une seule chose, vraie : c'est bien la boutique Plugin.dz, et non
 * une page de revente qui emprunte le nom. Elle n'imite aucune certification
 * délivrée par un tiers — le libellé lu par les lecteurs d'écran dit « boutique
 * officielle », pas « compte vérifié ».
 */
function OfficialBadge({ label, className = 'h-5 w-5' }: { label: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${className} shrink-0`}
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      {/* Contour en étoile arrondie, comme les pastilles de compte officiel. */}
      <path
        fill="#1D9BF0"
        d="M12 1.6l2.36 1.72 2.9-.28 1.06 2.72 2.56 1.4-.62 2.85 1.74 2.34-1.74 2.34.62 2.85-2.56 1.4-1.06 2.72-2.9-.28L12 22.4l-2.36-1.72-2.9.28-1.06-2.72-2.56-1.4.62-2.85L2 11.65l1.74-2.34-.62-2.85 2.56-1.4 1.06-2.72 2.9.28L12 1.6z"
      />
      <path
        fill="#fff"
        d="M10.9 15.35l-3-3 1.32-1.32 1.68 1.68 4.12-4.12 1.32 1.33-5.44 5.43z"
      />
    </svg>
  );
}

/** Marque Plugin : fiche + « Plugin » avec le « in » en bleu clair. */
export function Logo({
  compact = false,
  verified = false,
  verifiedLabel = 'Boutique officielle',
}: {
  compact?: boolean;
  /** Affiche la pastille « boutique officielle » à côté du nom. */
  verified?: boolean;
  verifiedLabel?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2" dir="ltr">
      <svg viewBox="0 0 48 40" className="h-8 w-9 shrink-0" aria-hidden="true">
        <path
          d="M18 6h8a13 13 0 0 1 0 26h-8z"
          fill="currentColor"
          className="text-navy-700"
        />
        <rect x="4" y="12" width="15" height="4.5" rx="2.25" fill="currentColor" className="text-navy-700" />
        <rect x="4" y="21.5" width="15" height="4.5" rx="2.25" fill="currentColor" className="text-navy-700" />
        <rect x="22" y="13" width="2.6" height="12" rx="1.3" fill="#fff" />
        <rect x="28" y="13" width="2.6" height="12" rx="1.3" fill="#fff" />
        <path
          d="M39 19c4 0 4-6 8-6"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          fill="none"
          className="text-navy-700"
        />
      </svg>
      {!compact && (
        <span className="text-2xl font-extrabold tracking-tight text-navy-700">
          Plug<span className="text-plug-500">in</span>
        </span>
      )}
      {/* En version compacte la pastille est réduite, pour rester lisible sans
          repousser le panier hors de l'écran sur un téléphone étroit. */}
      {verified && <OfficialBadge label={verifiedLabel} className={compact ? 'h-4 w-4' : 'h-5 w-5'} />}
    </span>
  );
}
