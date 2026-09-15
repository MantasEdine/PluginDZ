/** Marque Plugin : fiche + « Plugin » avec le « in » en bleu clair. */
export function Logo({ compact = false }: { compact?: boolean }) {
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
    </span>
  );
}
