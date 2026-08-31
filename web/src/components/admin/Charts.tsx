'use client';

import { useState } from 'react';

/* Petits graphiques SVG sans dépendance, aux couleurs du thème. Volontairement
   simples : séries courtes (30 jours / 12 mois), lisibles sur mobile comme desktop. */

const W = 760;
const H = 260;
const PAD = { top: 16, right: 12, bottom: 28, left: 62 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(value)));
  const norm = value / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

export interface BarPoint {
  label: string;
  value: number;
}

/**
 * Histogramme d'une série, avec une seconde série optionnelle tracée en courbe
 * (ex. vues en barres + visiteurs uniques en ligne). Survol = infobulle.
 */
export function BarChart({
  data,
  line,
  formatValue = (v) => String(v),
  barColor = 'var(--color-plug-500)',
  lineColor = 'var(--color-teal-500)',
  labelEvery,
  emptyText = 'Aucune donnée sur la période.',
}: {
  data: BarPoint[];
  line?: number[];
  formatValue?: (v: number) => string;
  barColor?: string;
  lineColor?: string;
  labelEvery?: number;
  emptyText?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  const maxData = Math.max(0, ...data.map((d) => d.value), ...(line ?? []));
  const max = niceMax(maxData);
  const everyN = labelEvery ?? Math.ceil(data.length / 8);
  const n = data.length || 1;
  const slot = PLOT_W / n;
  const barW = Math.max(2, Math.min(slot * 0.62, 34));

  const x = (i: number) => PAD.left + slot * i + slot / 2;
  const y = (v: number) => PAD.top + PLOT_H - (v / max) * PLOT_H;

  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));

  if (maxData === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">{emptyText}</p>;
  }

  const linePath =
    line && line.length === data.length
      ? line.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
      : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" preserveAspectRatio="xMidYMid meet">
      {/* Grille + graduations Y */}
      {gridVals.map((v, i) => (
        <g key={i}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="#eef2f7" strokeWidth={1} />
          <text x={PAD.left - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="#94a3b8">
            {formatValue(v)}
          </text>
        </g>
      ))}

      {/* Barres */}
      {data.map((d, i) => {
        const bh = (d.value / max) * PLOT_H;
        const active = hover === i;
        return (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            {/* zone de survol large */}
            <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={PLOT_H} fill="transparent" />
            <rect
              x={x(i) - barW / 2}
              y={PAD.top + PLOT_H - bh}
              width={barW}
              height={bh}
              rx={2}
              fill={barColor}
              opacity={active ? 1 : 0.85}
            >
              <title>{`${d.label} : ${formatValue(d.value)}`}</title>
            </rect>
          </g>
        );
      })}

      {/* Courbe secondaire */}
      {linePath && (
        <>
          <path d={linePath} fill="none" stroke={lineColor} strokeWidth={2} />
          {line!.map((v, i) => (
            <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 3.5 : 2} fill={lineColor} />
          ))}
        </>
      )}

      {/* Étiquettes X (allégées) */}
      {data.map((d, i) =>
        i % everyN === 0 || i === data.length - 1 ? (
          <text key={i} x={x(i)} y={H - 10} textAnchor="middle" fontSize={10} fill="#94a3b8">
            {d.label}
          </text>
        ) : null,
      )}

      {/* Infobulle */}
      {hover !== null && data[hover] && (
        <g>
          <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + PLOT_H} stroke="#cbd5e1" strokeDasharray="3 3" />
          <text x={x(hover)} y={PAD.top - 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#12386e">
            {formatValue(data[hover].value)}
            {line && line[hover] !== undefined ? ` · ${formatValue(line[hover])}` : ''}
          </text>
        </g>
      )}
    </svg>
  );
}

/** Barres horizontales pour un classement (ex. sources de trafic). */
export function HBarList({
  data,
  formatValue = (v) => String(v),
  color = 'var(--color-plug-500)',
  emptyText = 'Aucune donnée.',
}: {
  data: { label: string; value: number; sub?: string }[];
  formatValue?: (v: number) => string;
  color?: string;
  emptyText?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) return <p className="py-6 text-center text-sm text-slate-400">{emptyText}</p>;
  return (
    <ul className="space-y-2.5">
      {data.map((d, i) => (
        <li key={i}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate font-medium text-navy-800">{d.label}</span>
            <span className="shrink-0 tabular-nums text-slate-500">
              {formatValue(d.value)}
              {d.sub ? <span className="text-slate-400"> · {d.sub}</span> : null}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
