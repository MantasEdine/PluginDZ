'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin';
import { BarChart, HBarList } from '@/components/admin/Charts';
import { StatTile } from '@/components/admin/StatTile';

interface VBucket { views: number; visitors: number }
interface VisitorData {
  daily: { day: string; views: number; visitors: number }[];
  sources: { source: string; views: number; visitors: number }[];
  summary: {
    today: VBucket; yesterday: VBucket;
    last7Days: VBucket; previous7Days: VBucket;
  };
}

function dayLabel(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

/** Nom lisible pour une source de trafic connue. */
function sourceLabel(source: string): string {
  const map: Record<string, string> = {
    direct: 'Accès direct',
    facebook: 'Facebook',
    instagram: 'Instagram',
    tiktok: 'TikTok',
    google: 'Google',
  };
  return map[source] ?? source;
}

export default function AudienceDashboard() {
  const [data, setData] = useState<VisitorData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    adminFetch<{ data: VisitorData }>('/api/admin/analytics/visitors')
      .then((p) => setData(p.data))
      .catch(() => setError(true));
  }, []);

  if (error) return <p className="text-red-600">Impossible de charger les statistiques.</p>;
  if (!data) return <p className="text-slate-500">Chargement...</p>;

  const { summary } = data;
  const nf = (v: number) => v.toLocaleString('fr-FR');

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold text-navy-900">Audience</h1>
        <p className="mt-1 text-sm text-slate-500">
          Visiteurs de la boutique. « Visiteurs uniques » compte chaque appareil une fois par jour ;
          « vues » compte chaque page ouverte. La répartition par source aide à mesurer vos publicités.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          label="Visiteurs aujourd'hui"
          value={nf(summary.today.visitors)}
          current={summary.today.visitors}
          previous={summary.yesterday.visitors}
          previousLabel="hier"
        />
        <StatTile
          label="Visiteurs (7 jours)"
          value={nf(summary.last7Days.visitors)}
          current={summary.last7Days.visitors}
          previous={summary.previous7Days.visitors}
          previousLabel="7 j précédents"
        />
        <StatTile
          label="Vues (7 jours)"
          value={nf(summary.last7Days.views)}
          current={summary.last7Days.views}
          previous={summary.previous7Days.views}
          previousLabel="7 j précédents"
        />
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-bold text-navy-900">Fréquentation par jour</h2>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--color-plug-500)' }} /> Vues
            </span>
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--color-teal-500)' }} /> Visiteurs uniques
            </span>
          </div>
        </div>
        <BarChart
          data={data.daily.map((d) => ({ label: dayLabel(d.day), value: d.views }))}
          line={data.daily.map((d) => d.visitors)}
          formatValue={(v) => nf(v)}
        />
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-bold text-navy-900">Sources de trafic</h2>
          <span className="text-xs text-slate-400">30 derniers jours</span>
        </div>
        <HBarList
          data={data.sources.map((s) => ({
            label: sourceLabel(s.source),
            value: s.views,
            sub: `${nf(s.visitors)} visiteur(s)`,
          }))}
          formatValue={(v) => `${nf(v)} vue(s)`}
        />
        <p className="mt-4 text-xs text-slate-400">
          Pour attribuer une campagne, ajoutez <code className="rounded bg-slate-100 px-1">?utm_source=facebook</code>
          {' '}à vos liens publicitaires : la source apparaîtra ici.
        </p>
      </section>
    </div>
  );
}
