'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin';
import { formatDa } from '@/lib/format';

const STATUSES = ['nouveau', 'confirme', 'expedie', 'annule'] as const;
type Status = (typeof STATUSES)[number];

const LABELS: Record<Status, string> = {
  nouveau: 'Nouvelle',
  confirme: 'Confirmée',
  expedie: 'Expédiée',
  annule: 'Annulée',
};
const COLORS: Record<Status, string> = {
  nouveau: 'bg-plug-500 text-white',
  confirme: 'bg-amber-100 text-amber-800',
  expedie: 'bg-emerald-100 text-emerald-800',
  annule: 'bg-slate-200 text-slate-600',
};

interface OrderItem { id: number; label: string; quantity: number; unitPrice: number }
interface Order {
  id: number; reference: string; customerName: string; customerPhone: string;
  customerWilaya: string; customerAddress: string; customerNote: string | null;
  status: Status; total: number; createdAt: string; items: OrderItem[];
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const query = new URLSearchParams();
    if (filter) query.set('status', filter);
    if (search) query.set('search', search);
    adminFetch<{ data: Order[] }>(`/api/admin/orders?${query}`)
      .then((payload) => setOrders(payload.data))
      .catch((err: Error) => setError(err.message));
  }, [filter, search]);

  useEffect(load, [load]);

  async function changeStatus(id: number, status: Status) {
    try {
      await adminFetch(`/api/admin/orders/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold text-navy-900">Commandes</h1>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter('')}
          className={`badge ${filter === '' ? 'bg-navy-700 text-white' : 'bg-white text-navy-700'}`}
        >
          Toutes
        </button>
        {STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            className={`badge ${filter === status ? 'bg-navy-700 text-white' : 'bg-white text-navy-700'}`}
          >
            {LABELS[status]}
          </button>
        ))}
        <input
          type="search"
          placeholder="Référence, nom, téléphone..."
          className="field ms-auto w-full sm:w-72"
          onKeyDown={(event) => {
            if (event.key === 'Enter') setSearch(event.currentTarget.value.trim());
          }}
        />
      </div>

      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="p-3">Réf.</th>
              <th className="p-3">Client</th>
              <th className="p-3">Wilaya</th>
              <th className="p-3">Total</th>
              <th className="p-3">Statut</th>
              <th className="p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-t border-slate-100 align-top">
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => setOpenId(openId === order.id ? null : order.id)}
                    className="font-bold text-navy-700 hover:underline"
                  >
                    {order.reference}
                  </button>
                  <p className="text-xs text-slate-400">
                    {new Date(order.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                  {openId === order.id && (
                    <div className="mt-2 w-64 rounded-lg bg-slate-50 p-3 text-xs">
                      <p className="mb-1 font-semibold">{order.customerAddress}</p>
                      {order.customerNote && <p className="mb-2 italic">{order.customerNote}</p>}
                      <ul className="space-y-1">
                        {order.items.map((item) => (
                          <li key={item.id} className="flex justify-between gap-2">
                            <span>{item.label} × {item.quantity}</span>
                            <span>{formatDa(item.unitPrice * item.quantity)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </td>
                <td className="p-3">
                  {order.customerName}
                  <p className="text-xs text-slate-500">{order.customerPhone}</p>
                </td>
                <td className="p-3">{order.customerWilaya}</td>
                <td className="p-3 font-bold text-navy-700">{formatDa(order.total)}</td>
                <td className="p-3">
                  <span className={`badge ${COLORS[order.status]}`}>{LABELS[order.status]}</span>
                </td>
                <td className="p-3">
                  <select
                    className="field py-1.5"
                    value={order.status}
                    onChange={(event) => changeStatus(order.id, event.target.value as Status)}
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>{LABELS[status]}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500">Aucune commande.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
