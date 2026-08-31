import { Router } from 'express';
import {
  addDays,
  addMonths,
  campaignPerformance,
  daySeries,
  monthStart,
  revenueBetween,
  revenueByDay,
  revenueByMonth,
  shopToday,
  visitsBetween,
  visitsByDay,
  visitsBySource,
} from '../lib/analytics';
import { asyncHandler } from '../middleware/error';

/**
 * Statistiques du back-office. Monté sous `/api/admin/analytics`, donc déjà protégé
 * par `requireAdmin` (voir app.ts). Deux tableaux de bord :
 *  - revenue  : chiffre d'affaires par jour (30 j) et par mois (12 mois), avec comparatifs ;
 *  - visitors : audience par jour, sources de trafic, comparatifs — pour mesurer les pubs.
 */
export const analyticsRouter = Router();

const MONTH_LABELS_FR = [
  'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
  'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc',
];

analyticsRouter.get(
  '/revenue',
  asyncHandler(async (_req, res) => {
    const today = shopToday();
    const dailyStart = addDays(today, -29); // 30 jours glissants
    const monthlyStart = addMonths(monthStart(today), -11); // 12 mois glissants

    const [byDay, byMonth] = await Promise.all([
      revenueByDay(dailyStart),
      revenueByMonth(monthlyStart),
    ]);

    const daily = daySeries(dailyStart, today).map((day) => ({
      day,
      revenue: byDay.get(day)?.revenue ?? 0,
      orders: byDay.get(day)?.orders ?? 0,
    }));

    const monthly = [];
    for (let m = monthlyStart; m <= monthStart(today); m = addMonths(m, 1)) {
      const key = m.slice(0, 7);
      monthly.push({
        month: key,
        label: MONTH_LABELS_FR[Number(key.slice(5, 7)) - 1],
        revenue: byMonth.get(key)?.revenue ?? 0,
        orders: byMonth.get(key)?.orders ?? 0,
      });
    }

    // Comparatifs : aujourd'hui vs hier, 7 j vs 7 j précédents, ce mois vs le précédent.
    const tomorrow = addDays(today, 1);
    const thisMonthStart = monthStart(today);
    const lastMonthStart = addMonths(thisMonthStart, -1);
    const [todayR, yesterdayR, last7, prev7, thisMonthR, lastMonthR] = await Promise.all([
      revenueBetween(today, tomorrow),
      revenueBetween(addDays(today, -1), today),
      revenueBetween(addDays(today, -6), tomorrow),
      revenueBetween(addDays(today, -13), addDays(today, -6)),
      revenueBetween(thisMonthStart, tomorrow),
      revenueBetween(lastMonthStart, thisMonthStart),
    ]);

    res.json({
      data: {
        daily,
        monthly,
        summary: {
          today: todayR,
          yesterday: yesterdayR,
          last7Days: last7,
          previous7Days: prev7,
          thisMonth: thisMonthR,
          lastMonth: lastMonthR,
        },
      },
    });
  }),
);

analyticsRouter.get(
  '/visitors',
  asyncHandler(async (_req, res) => {
    const today = shopToday();
    const dailyStart = addDays(today, -29);
    const tomorrow = addDays(today, 1);

    const [byDay, sources, todayV, yesterdayV, last7, prev7] = await Promise.all([
      visitsByDay(dailyStart),
      visitsBySource(dailyStart),
      visitsBetween(today, tomorrow),
      visitsBetween(addDays(today, -1), today),
      visitsBetween(addDays(today, -6), tomorrow),
      visitsBetween(addDays(today, -13), addDays(today, -6)),
    ]);

    const daily = daySeries(dailyStart, today).map((day) => ({
      day,
      views: byDay.get(day)?.views ?? 0,
      visitors: byDay.get(day)?.visitors ?? 0,
    }));

    res.json({
      data: {
        daily,
        sources,
        summary: {
          today: todayV,
          yesterday: yesterdayV,
          last7Days: last7,
          previous7Days: prev7,
        },
      },
    });
  }),
);

analyticsRouter.get(
  '/campaigns',
  asyncHandler(async (_req, res) => {
    const today = shopToday();
    const start = addDays(today, -29); // 30 jours glissants

    const rows = await campaignPerformance(start);
    const totals = rows.reduce(
      (acc, r) => {
        acc.visitors += r.visitors;
        acc.views += r.views;
        acc.orders += r.orders;
        acc.revenue += r.revenue;
        return acc;
      },
      { visitors: 0, views: 0, orders: 0, revenue: 0 },
    );

    res.json({ data: { rows, totals, periodDays: 30 } });
  }),
);
