'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin';
import { formatDa } from '@/lib/format';
import { ImageUpload } from '@/components/admin/ImageUpload';

interface Option { id: number; name: string }
interface VariantForm {
  id?: number; color: string; power: string; plugType: string;
  price: number; oldPrice: string; stock: number; sku: string;
}
interface ProductRow {
  id: number; name: string; slug: string; subType: string | null; description: string;
  imageUrl: string | null; isPromo: boolean; isActive: boolean; totalStock: number;
  minPrice: number | null;
  brand: { id: number; name: string };
  chargerType: { id: number; name: string };
  variants: { id: number; color: string | null; power: string | null; plugType: string | null;
    price: number; oldPrice: number | null; stock: number; sku: string | null }[];
}

const EMPTY_VARIANT: VariantForm = {
  color: '', power: '', plugType: '', price: 0, oldPrice: '', stock: 0, sku: '',
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [brands, setBrands] = useState<Option[]>([]);
  const [types, setTypes] = useState<Option[]>([]);
  const [editing, setEditing] = useState<ProductRow | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    Promise.all([
      adminFetch<{ data: ProductRow[] }>('/api/admin/products?perPage=100'),
      adminFetch<{ data: Option[] }>('/api/admin/brands'),
      adminFetch<{ data: Option[] }>('/api/admin/charger-types'),
    ])
      .then(([p, b, t]) => { setProducts(p.data); setBrands(b.data); setTypes(t.data); })
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(load, [load]);

  async function remove(product: ProductRow) {
    if (!window.confirm(`Supprimer « ${product.name} » ?`)) return;
    try {
      await adminFetch(`/api/admin/products/${product.id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-navy-900">Produits</h1>
        <button type="button" className="btn-primary" onClick={() => setEditing('new')}>Nouveau produit</button>
      </div>

      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {editing && (
        <ProductForm
          product={editing === 'new' ? null : editing}
          brands={brands}
          types={types}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="p-3">Produit</th>
              <th className="p-3">Marque</th>
              <th className="p-3">Type</th>
              <th className="p-3">Prix</th>
              <th className="p-3">Stock</th>
              <th className="p-3">État</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id} className="border-t border-slate-100">
                <td className="p-3 font-medium text-navy-800">
                  {product.name}
                  <p className="text-xs text-slate-400">{product.variants.length} déclinaison(s)</p>
                </td>
                <td className="p-3">{product.brand.name}</td>
                <td className="p-3">{product.chargerType.name}{product.subType ? ` · ${product.subType}` : ''}</td>
                <td className="p-3">{product.minPrice !== null ? formatDa(product.minPrice) : '—'}</td>
                <td className={`p-3 ${product.totalStock <= 5 ? 'font-bold text-amber-600' : ''}`}>
                  {product.totalStock}
                </td>
                <td className="p-3">
                  {product.isPromo && <span className="badge me-1 bg-red-100 text-red-700">Promo</span>}
                  {!product.isActive && <span className="badge bg-slate-200 text-slate-600">Inactif</span>}
                </td>
                <td className="p-3 text-end">
                  <button type="button" className="text-navy-600 hover:underline" onClick={() => setEditing(product)}>
                    Modifier
                  </button>
                  <button type="button" className="ms-3 text-red-600 hover:underline" onClick={() => remove(product)}>
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-slate-500">Aucun produit.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductForm({ product, brands, types, onClose, onSaved }: {
  product: ProductRow | null;
  brands: Option[];
  types: Option[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(product?.name ?? '');
  const [brandId, setBrandId] = useState(product?.brand.id ?? brands[0]?.id ?? 0);
  const [typeId, setTypeId] = useState(product?.chargerType.id ?? types[0]?.id ?? 0);
  const [subType, setSubType] = useState(product?.subType ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? '');
  const [isPromo, setIsPromo] = useState(product?.isPromo ?? false);
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [variants, setVariants] = useState<VariantForm[]>(
    product
      ? product.variants.map((v) => ({
          id: v.id,
          color: v.color ?? '', power: v.power ?? '', plugType: v.plugType ?? '',
          price: v.price, oldPrice: v.oldPrice ? String(v.oldPrice) : '',
          stock: v.stock, sku: v.sku ?? '',
        }))
      : [{ ...EMPTY_VARIANT }],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function patchVariant(index: number, patch: Partial<VariantForm>) {
    setVariants((current) => current.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const body = {
      name, brandId, chargerTypeId: typeId,
      subType: subType || null,
      description,
      imageUrl: imageUrl || null,
      isPromo, isActive,
      variants: variants.map((v) => ({
        ...(v.id ? { id: v.id } : {}),
        color: v.color || null, power: v.power || null, plugType: v.plugType || null,
        price: Number(v.price) || 0,
        oldPrice: v.oldPrice ? Number(v.oldPrice) : null,
        stock: Number(v.stock) || 0,
        sku: v.sku || null,
      })),
    };

    try {
      await adminFetch(product ? `/api/admin/products/${product.id}` : '/api/admin/products', {
        method: product ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
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
        <h2 className="text-lg font-bold text-navy-900">
          {product ? `Modifier « ${product.name} »` : 'Nouveau produit'}
        </h2>
        <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:underline">Fermer</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="p-name">Nom</label>
          <input id="p-name" className="field" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="p-brand">Marque</label>
          <select id="p-brand" className="field" value={brandId} onChange={(e) => setBrandId(Number(e.target.value))}>
            {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="p-type">Type de chargeur</label>
          <select id="p-type" className="field" value={typeId} onChange={(e) => setTypeId(Number(e.target.value))}>
            {types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="p-sub">Sous-type (optionnel)</label>
          <input id="p-sub" className="field" placeholder="iPhone, Type-C..." value={subType} onChange={(e) => setSubType(e.target.value)} />
        </div>
        <div className="flex items-end gap-5 pb-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPromo} onChange={(e) => setIsPromo(e.target.checked)} /> En promotion
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Actif
          </label>
        </div>
        <div className="sm:col-span-2">
          <ImageUpload value={imageUrl} onChange={setImageUrl} label="Image principale" />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="p-desc">Détails (description)</label>
          <textarea id="p-desc" rows={4} className="field" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="label mb-0">Déclinaisons (couleur / puissance / prise)</span>
          <button
            type="button"
            className="text-sm font-semibold text-plug-500 hover:underline"
            onClick={() => setVariants((current) => [...current, { ...EMPTY_VARIANT }])}
          >
            + Ajouter
          </button>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Un produit à prix unique n&apos;a besoin que d&apos;une seule ligne, sans couleur ni puissance.
        </p>

        <div className="space-y-2">
          {variants.map((variant, index) => (
            <div key={variant.id ?? `new-${index}`} className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-7">
              <input className="field" placeholder="Couleur" value={variant.color} onChange={(e) => patchVariant(index, { color: e.target.value })} />
              <input className="field" placeholder="Puissance" value={variant.power} onChange={(e) => patchVariant(index, { power: e.target.value })} />
              <input className="field" placeholder="Prise" value={variant.plugType} onChange={(e) => patchVariant(index, { plugType: e.target.value })} />
              <input className="field" type="number" min={0} placeholder="Prix" value={variant.price} onChange={(e) => patchVariant(index, { price: Number(e.target.value) })} required />
              <input className="field" type="number" min={0} placeholder="Ancien prix" value={variant.oldPrice} onChange={(e) => patchVariant(index, { oldPrice: e.target.value })} />
              <input className="field" type="number" min={0} placeholder="Stock" value={variant.stock} onChange={(e) => patchVariant(index, { stock: Number(e.target.value) })} />
              <div className="flex gap-2">
                <input className="field" placeholder="SKU" value={variant.sku} onChange={(e) => patchVariant(index, { sku: e.target.value })} />
                {variants.length > 1 && (
                  <button
                    type="button"
                    className="shrink-0 text-red-600"
                    onClick={() => setVariants((current) => current.filter((_, i) => i !== index))}
                    aria-label="Retirer"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
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
