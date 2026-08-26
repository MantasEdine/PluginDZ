'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin';
import { formatDa } from '@/lib/format';
import { ImageUpload } from '@/components/admin/ImageUpload';

interface VariantOption {
  id: number; productName: string; brand: string; label: string; price: number; stock: number;
}
interface PackRow {
  id: number; name: string; price: number; oldPrice: number | null; description: string;
  imageUrl: string | null; stock: number; isFeatured: boolean; isActive: boolean;
  totalUnits: number; unitValue: number; savings: number;
  items: { id: number; variantId: number; quantity: number; label: string }[];
}

export default function AdminPacksPage() {
  const [packs, setPacks] = useState<PackRow[]>([]);
  const [variants, setVariants] = useState<VariantOption[]>([]);
  const [editing, setEditing] = useState<PackRow | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      adminFetch<{ data: PackRow[] }>('/api/admin/packs'),
      adminFetch<{ data: VariantOption[] }>('/api/admin/variants'),
    ])
      .then(([p, v]) => { setPacks(p.data); setVariants(v.data); })
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(load, [load]);

  async function remove(pack: PackRow) {
    if (!window.confirm(`Supprimer « ${pack.name} » ?`)) return;
    try {
      await adminFetch(`/api/admin/packs/${pack.id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-navy-900">Packs de gros</h1>
        <button type="button" className="btn-primary" onClick={() => setEditing('new')}>Nouveau pack</button>
      </div>

      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {editing && (
        <PackForm
          pack={editing === 'new' ? null : editing}
          variants={variants}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="p-3">Pack</th>
              <th className="p-3">Contenu</th>
              <th className="p-3">Prix</th>
              <th className="p-3">Valeur détail</th>
              <th className="p-3">Stock</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {packs.map((pack) => (
              <tr key={pack.id} className="border-t border-slate-100 align-top">
                <td className="p-3 font-medium text-navy-800">
                  {pack.name}
                  <div className="mt-1 flex gap-1">
                    {pack.isFeatured && <span className="badge bg-plug-500 text-white">Accueil</span>}
                    {!pack.isActive && <span className="badge bg-slate-200 text-slate-600">Inactif</span>}
                  </div>
                </td>
                <td className="p-3 text-xs text-slate-600">
                  {pack.items.map((item) => (
                    <p key={item.id}>{item.label} × {item.quantity}</p>
                  ))}
                </td>
                <td className="p-3 font-bold text-navy-700">{formatDa(pack.price)}</td>
                <td className="p-3">
                  {formatDa(pack.unitValue)}
                  {pack.savings > 0 && (
                    <p className="text-xs text-emerald-600">-{formatDa(pack.savings)}</p>
                  )}
                </td>
                <td className="p-3">{pack.stock}</td>
                <td className="p-3 text-end">
                  <button type="button" className="text-navy-600 hover:underline" onClick={() => setEditing(pack)}>
                    Modifier
                  </button>
                  <button type="button" className="ms-3 text-red-600 hover:underline" onClick={() => remove(pack)}>
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
            {packs.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500">Aucun pack.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PackForm({ pack, variants, onClose, onSaved }: {
  pack: PackRow | null;
  variants: VariantOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(pack?.name ?? '');
  const [price, setPrice] = useState(pack?.price ?? 0);
  const [oldPrice, setOldPrice] = useState(pack?.oldPrice ? String(pack.oldPrice) : '');
  const [stock, setStock] = useState(pack?.stock ?? 0);
  const [description, setDescription] = useState(pack?.description ?? '');
  const [imageUrl, setImageUrl] = useState(pack?.imageUrl ?? '');
  const [isFeatured, setIsFeatured] = useState(pack?.isFeatured ?? false);
  const [isActive, setIsActive] = useState(pack?.isActive ?? true);
  const [items, setItems] = useState<{ variantId: number; quantity: number }[]>(
    pack?.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })) ?? [
      { variantId: variants[0]?.id ?? 0, quantity: 10 },
    ],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Valeur au détail : sert à vérifier que le prix du pack est bien avantageux.
  const unitValue = items.reduce((sum, item) => {
    const variant = variants.find((v) => v.id === item.variantId);
    return sum + (variant ? variant.price * item.quantity : 0);
  }, 0);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await adminFetch(pack ? `/api/admin/packs/${pack.id}` : '/api/admin/packs', {
        method: pack ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name,
          price: Number(price) || 0,
          oldPrice: oldPrice ? Number(oldPrice) : null,
          stock: Number(stock) || 0,
          description,
          imageUrl: imageUrl || null,
          isFeatured,
          isActive,
          items: items.filter((item) => item.variantId > 0),
        }),
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-5 space-y-4 rounded-xl border border-plug-400 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-navy-900">{pack ? `Modifier « ${pack.name} »` : 'Nouveau pack'}</h2>
        <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:underline">Fermer</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="sm:col-span-4">
          <label className="label" htmlFor="k-name">Nom du pack</label>
          <input id="k-name" className="field" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="k-price">Prix du pack (DA)</label>
          <input id="k-price" type="number" min={0} className="field" required value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        </div>
        <div>
          <label className="label" htmlFor="k-old">Ancien prix</label>
          <input id="k-old" type="number" min={0} className="field" value={oldPrice} onChange={(e) => setOldPrice(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="k-stock">Stock</label>
          <input id="k-stock" type="number" min={0} className="field" value={stock} onChange={(e) => setStock(Number(e.target.value))} />
        </div>
        <div className="flex items-end gap-4 pb-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} /> Accueil
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Actif
          </label>
        </div>
        <div className="sm:col-span-2">
          <ImageUpload value={imageUrl} onChange={setImageUrl} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="k-desc">Description</label>
          <textarea id="k-desc" rows={3} className="field" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="label mb-0">Contenu du pack</span>
          <button
            type="button"
            className="text-sm font-semibold text-plug-500 hover:underline"
            onClick={() => setItems((current) => [...current, { variantId: variants[0]?.id ?? 0, quantity: 1 }])}
          >
            + Ajouter un article
          </button>
        </div>

        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={index} className="flex gap-2">
              <select
                className="field"
                value={item.variantId}
                onChange={(e) =>
                  setItems((current) =>
                    current.map((row, i) => (i === index ? { ...row, variantId: Number(e.target.value) } : row)),
                  )
                }
              >
                {variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.brand} — {variant.productName}
                    {variant.label ? ` (${variant.label})` : ''} · {formatDa(variant.price)} · stock {variant.stock}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                className="field w-28"
                value={item.quantity}
                onChange={(e) =>
                  setItems((current) =>
                    current.map((row, i) => (i === index ? { ...row, quantity: Number(e.target.value) || 1 } : row)),
                  )
                }
              />
              {items.length > 1 && (
                <button
                  type="button"
                  className="shrink-0 px-2 text-red-600"
                  onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
                  aria-label="Retirer"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="mt-2 text-sm text-slate-500">
          Valeur au détail : <strong>{formatDa(unitValue)}</strong>
          {unitValue > Number(price) && (
            <span className="ms-2 text-emerald-600">
              économie client : {formatDa(unitValue - Number(price))}
            </span>
          )}
        </p>
      </div>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
        <button type="button" onClick={onClose} className="btn-outline">Annuler</button>
      </div>
    </form>
  );
}
