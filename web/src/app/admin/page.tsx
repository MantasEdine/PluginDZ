'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin';
import { formatDa } from '@/lib/format';

interface Stats {
  newOrders: number; totalOrders: number; products: number;
  packs: number; lowStock: number; confirmedRevenue: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    adminFetch<{ data: Stats }>('/api/admin/stats')
      .then((payload) => setStats(payload.data))
      .catch(() => setStats(null));
  }, []);

  const tiles = stats
    ? [
        { label: 'Nouvelles commandes', value: stats.newOrders, href: '/admin/commandes?status=nouveau', accent: true },
        { label: 'Commandes au total', value: stats.totalOrders, href: '/admin/commandes' },
        { label: 'Chiffre confirmé', value: formatDa(stats.confirmedRevenue), href: '/admin/revenus' },
        { label: 'Produits actifs', value: stats.products, href: '/admin/produits' },
        { label: 'Packs actifs', value: stats.packs, href: '/admin/packs' },
        { label: 'Déclinaisons à réappro. (≤5)', value: stats.lowStock, href: '/admin/produits' },
      ]
    : [];

  return (
    <div>
      <h1 className="mb-5 text-2xl font-extrabold text-navy-900">Tableau de bord</h1>
      {!stats ? (
        <p className="text-slate-500">Chargement...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((tile) => (
            <Link
              key={tile.label}
              href={tile.href}
              className={`rounded-xl border bg-white p-5 transition hover:shadow ${
                tile.accent && stats.newOrders > 0 ? 'border-plug-500' : 'border-slate-200'
              }`}
            >
              <p className="text-sm text-slate-500">{tile.label}</p>
              <p className="mt-1 text-2xl font-extrabold text-navy-700">{tile.value}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
