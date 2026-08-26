'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin';

interface Row { id: number; name: string; slug: string; productCount: number }

/** Deux listes très proches : marques et types partagent le même tableau éditable. */
function Manager({ title, endpoint }: { title: string; endpoint: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    adminFetch<{ data: Row[] }>(endpoint)
      .then((payload) => setRows(payload.data))
      .catch((err: Error) => setError(err.message));
  }, [endpoint]);

  useEffect(load, [load]);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-lg font-bold text-navy-900">{title}</h2>

      <div className="mb-4 flex gap-2">
        <input
          className="field"
          placeholder="Nom"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button
          type="button"
          className="btn-primary shrink-0"
          disabled={name.trim().length < 2}
          onClick={() =>
            run(async () => {
              await adminFetch(endpoint, { method: 'POST', body: JSON.stringify({ name: name.trim() }) });
              setName('');
            })
          }
        >
          Ajouter
        </button>
      </div>

      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <ul className="divide-y divide-slate-100">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
            <div>
              <p className="font-medium text-navy-800">{row.name}</p>
              <p className="text-xs text-slate-400">{row.slug} · {row.productCount} produit(s)</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="text-sm text-navy-600 hover:underline"
                onClick={() => {
                  const next = window.prompt('Nouveau nom', row.name);
                  if (next && next.trim().length >= 2) {
                    run(() =>
                      adminFetch(`${endpoint}/${row.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ name: next.trim() }),
                      }),
                    );
                  }
                }}
              >
                Renommer
              </button>
              <button
                type="button"
                className="text-sm text-red-600 hover:underline"
                onClick={() => {
                  if (window.confirm(`Supprimer « ${row.name} » ?`)) {
                    run(() => adminFetch(`${endpoint}/${row.id}`, { method: 'DELETE' }));
                  }
                }}
              >
                Supprimer
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function AdminBrandsPage() {
  return (
    <div>
      <h1 className="mb-5 text-2xl font-extrabold text-navy-900">Marques & types</h1>
      <div className="grid gap-5 lg:grid-cols-2">
        <Manager title="Marques" endpoint="/api/admin/brands" />
        <Manager title="Types de chargeurs" endpoint="/api/admin/charger-types" />
      </div>
    </div>
  );
}
