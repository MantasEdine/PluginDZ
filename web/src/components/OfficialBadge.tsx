/**
 * Pastille « boutique officielle », dans le langage visuel des comptes officiels.
 *
 * Elle affirme une seule chose, vraie : c'est bien la boutique Plugin.dz, et non
 * une page de revente qui emprunte le nom. Elle n'imite aucune certification
 * délivrée par un tiers — le libellé lu par les lecteurs d'écran dit « boutique
 * officielle », pas « compte vérifié ».
 *
 * Rendu « verre » : un dégradé du bleu ciel au bleu profond, un reflet clair sur
 * la moitié haute, un liseré blanc translucide pour le relief, et un halo bleu
 * doux. Sur le bandeau bleu nuit de l'en-tête, c'est ce halo qui la détache.
 *
 * Elle vit à côté du logo, jamais dedans : le logo est la marque, la pastille
 * est un signe posé à côté — comme sur les réseaux.
 */
export function OfficialBadge({ label, className = 'h-6 w-6' }: { label: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${className} shrink-0 drop-shadow-[0_2px_6px_rgba(29,155,240,0.55)]`}
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      <defs>
        {/* Identifiants fixes : la pastille peut être rendue plusieurs fois dans la
            page (version compacte, version large, pied de page) avec exactement les
            mêmes définitions — un doublon d'identifiant renvoie donc au même dégradé. */}
        <linearGradient id="badge-glass-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6CCBFF" />
          <stop offset="0.55" stopColor="#1D9BF0" />
          <stop offset="1" stopColor="#0B6FD6" />
        </linearGradient>
        <linearGradient id="badge-glass-shine" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id="badge-glass-clip">
          <path d="M12 1.6l2.36 1.72 2.9-.28 1.06 2.72 2.56 1.4-.62 2.85 1.74 2.34-1.74 2.34.62 2.85-2.56 1.4-1.06 2.72-2.9-.28L12 22.4l-2.36-1.72-2.9.28-1.06-2.72-2.56-1.4.62-2.85L2 11.65l1.74-2.34-.62-2.85 2.56-1.4 1.06-2.72 2.9.28L12 1.6z" />
        </clipPath>
      </defs>

      {/* Corps : contour en étoile arrondie, rempli du dégradé. */}
      <path
        fill="url(#badge-glass-fill)"
        d="M12 1.6l2.36 1.72 2.9-.28 1.06 2.72 2.56 1.4-.62 2.85 1.74 2.34-1.74 2.34.62 2.85-2.56 1.4-1.06 2.72-2.9-.28L12 22.4l-2.36-1.72-2.9.28-1.06-2.72-2.56-1.4.62-2.85L2 11.65l1.74-2.34-.62-2.85 2.56-1.4 1.06-2.72 2.9.28L12 1.6z"
      />
      {/* Reflet : une lentille claire sur la moitié haute, découpée à la forme. */}
      <ellipse cx="10.5" cy="7.5" rx="8" ry="5.5" fill="url(#badge-glass-shine)" clipPath="url(#badge-glass-clip)" />
      {/* Liseré translucide : donne l'épaisseur du verre sur le bord. */}
      <path
        fill="none"
        stroke="#fff"
        strokeOpacity="0.45"
        strokeWidth="0.9"
        d="M12 2.4l2.1 1.53 2.58-.25.94 2.42 2.28 1.25-.55 2.53 1.55 2.08-1.55 2.08.55 2.53-2.28 1.25-.94 2.42-2.58-.25L12 21.6l-2.1-1.53-2.58.25-.94-2.42-2.28-1.25.55-2.53L3.1 11.65l1.55-2.08-.55-2.53 2.28-1.25.94-2.42 2.58.25L12 2.4z"
      />
      {/* Coche, avec une ombre à peine visible pour la décoller du fond. */}
      <path fill="#0B4E9C" fillOpacity="0.35" d="M10.9 15.9l-3-3 1.32-1.32 1.68 1.68 4.12-4.12 1.32 1.33-5.44 5.43z" />
      <path fill="#fff" d="M10.9 15.35l-3-3 1.32-1.32 1.68 1.68 4.12-4.12 1.32 1.33-5.44 5.43z" />
    </svg>
  );
}
