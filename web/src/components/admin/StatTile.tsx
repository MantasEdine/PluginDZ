'use client';

/** Tuile de statistique avec comparaison à une période précédente (delta en %). */
export function StatTile({
  label,
  value,
  current,
  previous,
  previousLabel = 'période précédente',
}: {
  label: string;
  value: string;
  current?: number;
  previous?: number;
  previousLabel?: string;
}) {
  const hasDelta = current !== undefined && previous !== undefined;
  let pct: number | null = null;
  if (hasDelta) {
    if (previous === 0) pct = current === 0 ? 0 : null; // depuis zéro : % non défini
    else pct = Math.round(((current - previous) / previous) * 100);
  }
  const up = hasDelta && current! > previous!;
  const down = hasDelta && current! < previous!;
  const tone = up ? 'text-emerald-600' : down ? 'text-red-600' : 'text-slate-400';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-navy-700">{value}</p>
      {hasDelta && (
        <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${tone}`}>
          <span aria-hidden="true">{up ? '▲' : down ? '▼' : '■'}</span>
          <span>
            {pct === null ? '—' : `${pct > 0 ? '+' : ''}${pct} %`}
            <span className="text-slate-400"> vs {previousLabel}</span>
          </span>
        </p>
      )}
    </div>
  );
}
