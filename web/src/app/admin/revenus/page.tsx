'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin';
import { formatDa } from '@/lib/format';
import { BarChart } from '@/components/admin/Charts';
import { StatTile } from '@/components/admin/StatTile';

interface Bucket { revenue: number; orders: number }
interface RevenueData {
  daily: { day: string; revenue: number; orders: number }[];
  monthly: { month: string; label: string; revenue: number; orders: number }[];
  summary: {
    today: Bucket; yesterday: Bucket;
    last7Days: Bucket; previous7Days: Bucket;
    thisMonth: Bucket; lastMonth: Bucket;
  };
}

/** Axe Y compact : 12500 -> « 12,5k ». */
function compact(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.0', '')}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace('.0', '')}k`;
  return String(v);
}

/** « 2026-08-31 » -> « 31/08 » pour l'axe des jours. */
function dayLabel(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export default function RevenueDashboard() {
  const [data, setData] = useState<RevenueData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    adminFetch<{ data: RevenueData }>('/api/admin/analytics/revenue')
      .then((p) => setData(p.data))
      .catch(() => setError(true));
  }, []);

  if (error) return <p className="text-red-600">Impossible de charger les statistiques.</p>;
  if (!data) return <p className="text-slate-500">Chargement...</p>;

  const { summary } = data;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-navy-900">Revenus</h1>
        <p className="mt-1 text-sm text-slate-500">
          Chiffre d&apos;affaires confirmé (commandes confirmées et expédiées). Fuseau : Algérie.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          label="Aujourd'hui"
          value={formatDa(summary.today.revenue)}
          current={summary.today.revenue}
          previous={summary.yesterday.revenue}
          previousLabel="hier"
        />
        <StatTile
          label="7 derniers jours"
          value={formatDa(summary.last7Days.revenue)}
          current={summary.last7Days.revenue}
          previous={summary.previous7Days.revenue}
          previousLabel="7 j précédents"
        />
        <StatTile
          label="Ce mois-ci"
          value={formatDa(summary.thisMonth.revenue)}
          current={summary.thisMonth.revenue}
          previous={summary.lastMonth.revenue}
          previousLabel="mois dernier"
        />
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-bold text-navy-900">Revenus par jour</h2>
          <span className="text-xs text-slate-400">30 derniers jours</span>
        </div>
        <BarChart
          data={data.daily.map((d) => ({ label: dayLabel(d.day), value: d.revenue }))}
          formatValue={(v) => (v >= 1000 ? `${compact(v)} DA` : `${v} DA`)}
        />
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-bold text-navy-900">Revenus par mois</h2>
          <span className="text-xs text-slate-400">12 derniers mois</span>
        </div>
        <BarChart
          data={data.monthly.map((m) => ({ label: m.label, value: m.revenue }))}
          formatValue={(v) => (v >= 1000 ? `${compact(v)} DA` : `${v} DA`)}
          labelEvery={1}
        />
      </section>

      <p className="mt-4 text-xs text-slate-400">
        Astuce : survolez une barre pour voir le montant exact.
      </p>
    </div>
  );
}
