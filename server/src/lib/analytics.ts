import { prisma } from '../prisma';

/**
 * Fuseau de référence du commerce : l'Algérie est à UTC+1 toute l'année (pas d'heure
 * d'été). Regrouper « par jour » et « par mois » se fait dans ce fuseau pour coller au
 * ressenti du gérant, quel que soit le fuseau du serveur.
 */
export const SHOP_TZ = 'Africa/Algiers';

const dayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: SHOP_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}); // -> « YYYY-MM-DD »

/** Date du jour (YYYY-MM-DD) dans le fuseau boutique. */
export function shopToday(): string {
  return dayFmt.format(new Date());
}

/** Décale une date « YYYY-MM-DD » d'un nombre de jours (UTC-safe, sans heure d'été). */
export function addDays(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Premier jour du mois d'une date « YYYY-MM-DD ». */
export function monthStart(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

/** Ajoute `delta` mois au premier jour d'un mois « YYYY-MM-01 ». */
export function addMonths(monthFirst: string, delta: number): string {
  const [y, m] = monthFirst.split('-').map(Number) as [number, number];
  const idx = y * 12 + (m - 1) + delta;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}-01`;
}

/** Liste continue de jours [start, end] inclus, pour afficher les jours à zéro. */
export function daySeries(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

const STATUS_PAID = ['confirme', 'expedie'];

/** Chiffre d'affaires confirmé (commandes confirmées/expédiées) par jour boutique. */
export async function revenueByDay(startDay: string): Promise<Map<string, { revenue: number; orders: number }>> {
  const rows = await prisma.$queryRaw<{ day: string; revenue: bigint; orders: bigint }[]>`
    SELECT to_char((created_at AT TIME ZONE ${SHOP_TZ})::date, 'YYYY-MM-DD') AS day,
           COALESCE(SUM(total), 0) AS revenue,
           COUNT(*) AS orders
    FROM orders
    WHERE status::text IN ('confirme', 'expedie')
      AND (created_at AT TIME ZONE ${SHOP_TZ})::date >= ${startDay}::date
    GROUP BY 1`;
  return new Map(rows.map((r) => [r.day, { revenue: Number(r.revenue), orders: Number(r.orders) }]));
}

/** Chiffre d'affaires confirmé par mois (« YYYY-MM ») depuis un jour donné. */
export async function revenueByMonth(startDay: string): Promise<Map<string, { revenue: number; orders: number }>> {
  const rows = await prisma.$queryRaw<{ month: string; revenue: bigint; orders: bigint }[]>`
    SELECT to_char((created_at AT TIME ZONE ${SHOP_TZ}), 'YYYY-MM') AS month,
           COALESCE(SUM(total), 0) AS revenue,
           COUNT(*) AS orders
    FROM orders
    WHERE status::text IN ('confirme', 'expedie')
      AND (created_at AT TIME ZONE ${SHOP_TZ})::date >= ${startDay}::date
    GROUP BY 1`;
  return new Map(rows.map((r) => [r.month, { revenue: Number(r.revenue), orders: Number(r.orders) }]));
}

/** Total (CA + nb commandes) sur un intervalle [start, end[ de jours boutique. */
export async function revenueBetween(startDay: string, endDay: string): Promise<{ revenue: number; orders: number }> {
  const rows = await prisma.$queryRaw<{ revenue: bigint; orders: bigint }[]>`
    SELECT COALESCE(SUM(total), 0) AS revenue, COUNT(*) AS orders
    FROM orders
    WHERE status::text IN ('confirme', 'expedie')
      AND (created_at AT TIME ZONE ${SHOP_TZ})::date >= ${startDay}::date
      AND (created_at AT TIME ZONE ${SHOP_TZ})::date < ${endDay}::date`;
  const r = rows[0];
  return { revenue: Number(r?.revenue ?? 0), orders: Number(r?.orders ?? 0) };
}

/** Vues et visiteurs uniques par jour boutique. */
export async function visitsByDay(startDay: string): Promise<Map<string, { views: number; visitors: number }>> {
  const rows = await prisma.$queryRaw<{ day: string; views: bigint; visitors: bigint }[]>`
    SELECT to_char((created_at AT TIME ZONE ${SHOP_TZ})::date, 'YYYY-MM-DD') AS day,
           COUNT(*) AS views,
           COUNT(DISTINCT visitor_id) AS visitors
    FROM visits
    WHERE (created_at AT TIME ZONE ${SHOP_TZ})::date >= ${startDay}::date
    GROUP BY 1`;
  return new Map(rows.map((r) => [r.day, { views: Number(r.views), visitors: Number(r.visitors) }]));
}

/** Répartition du trafic par source (utm_source / référent), depuis un jour donné. */
export async function visitsBySource(startDay: string, limit = 12): Promise<{ source: string; views: number; visitors: number }[]> {
  const rows = await prisma.$queryRaw<{ source: string; views: bigint; visitors: bigint }[]>`
    SELECT source,
           COUNT(*) AS views,
           COUNT(DISTINCT visitor_id) AS visitors
    FROM visits
    WHERE (created_at AT TIME ZONE ${SHOP_TZ})::date >= ${startDay}::date
    GROUP BY source
    ORDER BY views DESC
    LIMIT ${limit}`;
  return rows.map((r) => ({ source: r.source, views: Number(r.views), visitors: Number(r.visitors) }));
}

/** Vues et visiteurs uniques sur un intervalle [start, end[ de jours boutique. */
export async function visitsBetween(startDay: string, endDay: string): Promise<{ views: number; visitors: number }> {
  const rows = await prisma.$queryRaw<{ views: bigint; visitors: bigint }[]>`
    SELECT COUNT(*) AS views, COUNT(DISTINCT visitor_id) AS visitors
    FROM visits
    WHERE (created_at AT TIME ZONE ${SHOP_TZ})::date >= ${startDay}::date
      AND (created_at AT TIME ZONE ${SHOP_TZ})::date < ${endDay}::date`;
  const r = rows[0];
  return { views: Number(r?.views ?? 0), visitors: Number(r?.visitors ?? 0) };
}


export interface CampaignRow {
  campaign: string;
  source: string;
  medium: string;
  visitors: number;
  views: number;
  orders: number;
  revenue: number;
  conversion: number; // commandes / visiteurs, en %
}

/**
 * Performance des campagnes depuis un jour donne : croise l'audience (visites portant
 * une campagne) et les commandes attribuees a cette meme campagne. La cle de
 * rapprochement est (campagne, source, medium) - les deux cotes sont normalises
 * identiquement, donc comparables.
 */
export async function campaignPerformance(startDay: string): Promise<CampaignRow[]> {
  const [visitRows, orderRows] = await Promise.all([
    prisma.$queryRaw<{ campaign: string; source: string; medium: string; visitors: bigint; views: bigint }[]>`
      SELECT campaign, source, medium,
             COUNT(DISTINCT visitor_id) AS visitors,
             COUNT(*) AS views
      FROM visits
      WHERE campaign IS NOT NULL
        AND (created_at AT TIME ZONE ${SHOP_TZ})::date >= ${startDay}::date
      GROUP BY campaign, source, medium`,
    prisma.$queryRaw<{ campaign: string; source: string; medium: string; orders: bigint; revenue: bigint }[]>`
      SELECT utm_campaign AS campaign,
             COALESCE(utm_source, 'direct') AS source,
             COALESCE(utm_medium, 'none') AS medium,
             COUNT(*) AS orders,
             COALESCE(SUM(total), 0) AS revenue
      FROM orders
      WHERE utm_campaign IS NOT NULL
        AND (created_at AT TIME ZONE ${SHOP_TZ})::date >= ${startDay}::date
      GROUP BY utm_campaign, utm_source, utm_medium`,
  ]);

  const key = (c: string, s: string, m: string) => `${c} ${s} ${m}`;
  const rows = new Map<string, CampaignRow>();

  for (const v of visitRows) {
    rows.set(key(v.campaign, v.source, v.medium), {
      campaign: v.campaign,
      source: v.source,
      medium: v.medium,
      visitors: Number(v.visitors),
      views: Number(v.views),
      orders: 0,
      revenue: 0,
      conversion: 0,
    });
  }

  for (const o of orderRows) {
    const k = key(o.campaign, o.source, o.medium);
    const existing = rows.get(k);
    if (existing) {
      existing.orders = Number(o.orders);
      existing.revenue = Number(o.revenue);
    } else {
      // Commandes attribuees sans visite correspondante (ex. visite anterieure au tracking).
      rows.set(k, {
        campaign: o.campaign,
        source: o.source,
        medium: o.medium,
        visitors: 0,
        views: 0,
        orders: Number(o.orders),
        revenue: Number(o.revenue),
        conversion: 0,
      });
    }
  }

  const out = [...rows.values()];
  for (const r of out) {
    r.conversion = r.visitors > 0 ? Math.round((r.orders / r.visitors) * 1000) / 10 : 0;
  }
  // Tri : d'abord par nombre de visiteurs, puis par commandes.
  out.sort((a, b) => b.visitors - a.visitors || b.orders - a.orders);
  return out;
}
