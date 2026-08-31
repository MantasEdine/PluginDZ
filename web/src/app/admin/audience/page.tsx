'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin';
import { BarChart, HBarList } from '@/components/admin/Charts';
import { formatDa } from '@/lib/format';
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

interface CampaignRow {
  campaign: string; source: string; medium: string;
  visitors: number; views: number; orders: number; revenue: number; conversion: number;
}
interface CampaignData {
  rows: CampaignRow[];
  totals: { visitors: number; views: number; orders: number; revenue: number };
  periodDays: number;
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
  const [campaigns, setCampaigns] = useState<CampaignData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    adminFetch<{ data: VisitorData }>('/api/admin/analytics/visitors')
      .then((p) => setData(p.data))
      .catch(() => setError(true));
    adminFetch<{ data: CampaignData }>('/api/admin/analytics/campaigns')
      .then((p) => setCampaigns(p.data))
      .catch(() => setCampaigns({ rows: [], totals: { visitors: 0, views: 0, orders: 0, revenue: 0 }, periodDays: 30 }));
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
          Vue d&apos;ensemble par source. Pour comparer des annonces précises, nommez vos campagnes
          (voir ci-dessous).
        </p>
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-bold text-navy-900">Performance des campagnes</h2>
          <span className="text-xs text-slate-400">30 derniers jours</span>
        </div>

        {!campaigns ? (
          <p className="py-6 text-center text-sm text-slate-400">Chargement...</p>
        ) : campaigns.rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            Aucune campagne détectée. Ajoutez des paramètres UTM à vos liens publicitaires pour les voir ici.
          </p>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pe-3 font-semibold">Campagne</th>
                  <th className="py-2 pe-3 font-semibold">Source</th>
                  <th className="py-2 pe-3 font-semibold">Type</th>
                  <th className="py-2 pe-3 text-end font-semibold">Visiteurs</th>
                  <th className="py-2 pe-3 text-end font-semibold">Commandes</th>
                  <th className="py-2 pe-3 text-end font-semibold">Conversion</th>
                  <th className="py-2 text-end font-semibold">CA</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.rows.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2.5 pe-3 font-semibold text-navy-800">{r.campaign}</td>
                    <td className="py-2.5 pe-3 text-slate-600">{sourceLabel(r.source)}</td>
                    <td className="py-2.5 pe-3 text-slate-500">{r.medium === 'none' ? '—' : r.medium}</td>
                    <td className="py-2.5 pe-3 text-end tabular-nums">{nf(r.visitors)}</td>
                    <td className="py-2.5 pe-3 text-end tabular-nums">{nf(r.orders)}</td>
                    <td className="py-2.5 pe-3 text-end tabular-nums font-semibold text-navy-700">
                      {r.conversion.toLocaleString('fr-FR')} %
                    </td>
                    <td className="py-2.5 text-end tabular-nums">{formatDa(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="text-sm font-semibold text-navy-900">
                  <td className="py-2.5 pe-3" colSpan={3}>Total</td>
                  <td className="py-2.5 pe-3 text-end tabular-nums">{nf(campaigns.totals.visitors)}</td>
                  <td className="py-2.5 pe-3 text-end tabular-nums">{nf(campaigns.totals.orders)}</td>
                  <td className="py-2.5 pe-3 text-end tabular-nums">
                    {campaigns.totals.visitors > 0
                      ? `${(Math.round((campaigns.totals.orders / campaigns.totals.visitors) * 1000) / 10).toLocaleString('fr-FR')} %`
                      : '—'}
                  </td>
                  <td className="py-2.5 text-end tabular-nums">{formatDa(campaigns.totals.revenue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          <p className="font-semibold text-slate-600">Comment nommer vos liens publicitaires</p>
          <p className="mt-1">
            Ajoutez à l&apos;adresse de destination :
            {' '}<code className="rounded bg-white px-1 py-0.5">?utm_source=facebook&amp;utm_medium=cpc&amp;utm_campaign=promo-ete</code>
          </p>
          <ul className="mt-2 space-y-0.5">
            <li><b>utm_source</b> : qui envoie le visiteur — google, facebook, instagram</li>
            <li><b>utm_medium</b> : le type — cpc (pub payante), social, email</li>
            <li><b>utm_campaign</b> : le nom que vous choisissez, un par annonce — sans espaces ni accents (utilisez des tirets)</li>
          </ul>
          <p className="mt-2">
            Google Ads ajoute son propre marqueur automatiquement (ces visites remontent en google / cpc),
            mais mettez quand même un <b>utm_campaign</b> pour distinguer vos annonces. Vous pouvez pointer vers
            n&apos;importe quelle page, pas seulement l&apos;accueil.
          </p>
        </div>
      </section>
    </div>
  );
}
