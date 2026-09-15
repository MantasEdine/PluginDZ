'use client';

import { useMemo, useState } from 'react';

/**
 * Générateur de « lien pub » : une adresse qui dépose l'article directement dans
 * le panier du visiteur.
 *
 * Pourquoi : quand une publicité passe, le client qui clique doit arriver à une
 * étape du paiement, pas sur une fiche produit où il faut encore choisir et
 * cliquer. Chaque étape supprimée est une vente gagnée.
 *
 * Le lien porte aussi l'étiquette de campagne (utm_source / utm_campaign). Le site
 * la mémorise dès l'arrivée et la rattache à la commande : le tableau
 * « Performance des campagnes » sait alors quelle publicité a payé quelle vente.
 */

/** Réseaux proposés, avec le « medium » que la régie associe habituellement. */
const SOURCES = [
  { value: '', label: 'Aucune (lien simple)', medium: '' },
  { value: 'facebook', label: 'Facebook', medium: 'social' },
  { value: 'instagram', label: 'Instagram', medium: 'social' },
  { value: 'tiktok', label: 'TikTok', medium: 'social' },
  { value: 'whatsapp', label: 'WhatsApp', medium: 'message' },
  { value: 'google', label: 'Google Ads', medium: 'cpc' },
] as const;

/** Même nettoyage que côté site, pour que les campagnes se regroupent bien. */
function cleanTag(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .slice(0, 60);
}

export function AdLinkBuilder({
  kind,
  slug,
  variants,
}: {
  kind: 'produit' | 'pack';
  slug: string;
  /** Déclinaisons proposables (produits uniquement). */
  variants?: { id: number; label: string }[];
}) {
  const [variantId, setVariantId] = useState<number | ''>('');
  const [qty, setQty] = useState(1);
  const [source, setSource] = useState('');
  const [campaign, setCampaign] = useState('');
  const [copied, setCopied] = useState(false);

  const url = useMemo(() => {
    // En production NEXT_PUBLIC_SITE_URL est défini ; sinon on retombe sur le
    // domaine courant, qui est déjà le bon quand on est dans le back-office.
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
      (typeof window !== 'undefined' ? window.location.origin : '');

    const params = new URLSearchParams();
    params.set(kind, slug);
    if (kind === 'produit' && variantId !== '') params.set('variant', String(variantId));
    if (qty > 1) params.set('qty', String(qty));

    const tag = cleanTag(source);
    const campaignTag = cleanTag(campaign);
    if (tag) {
      params.set('utm_source', tag);
      const medium = SOURCES.find((s) => s.value === source)?.medium;
      if (medium) params.set('utm_medium', medium);
    }
    if (campaignTag) params.set('utm_campaign', campaignTag);

    return `${origin}/panier?${params.toString()}`;
  }, [kind, slug, variantId, qty, source, campaign]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // navigator.clipboard est indisponible hors HTTPS : repli universel.
      const field = document.createElement('textarea');
      field.value = url;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      try {
        document.execCommand('copy');
      } catch {
        /* le lien reste sélectionnable à la main */
      }
      document.body.removeChild(field);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="font-semibold text-navy-900">Lien pub — achat direct</p>
      <p className="mt-1 text-sm text-slate-500">
        À coller dans une publicité ou une story. Le client arrive avec l&apos;article
        déjà dans son panier, il n&apos;a plus qu&apos;à remplir ses coordonnées.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {kind === 'produit' && variants && variants.length > 0 && (
          <div>
            <label className="label" htmlFor="ad-variant">Déclinaison</label>
            <select
              id="ad-variant"
              className="field"
              value={variantId}
              onChange={(e) => setVariantId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <option value="">Laisser le site choisir</option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="label" htmlFor="ad-qty">Quantité</label>
          <input
            id="ad-qty"
            type="number"
            min={1}
            max={999}
            className="field"
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>

        <div>
          <label className="label" htmlFor="ad-source">Où sera publié ce lien ?</label>
          <select id="ad-source" className="field" value={source} onChange={(e) => setSource(e.target.value)}>
            {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="ad-campaign">Nom de la campagne (optionnel)</label>
          <input
            id="ad-campaign"
            className="field"
            placeholder="soldes-octobre"
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
          />
        </div>
      </div>

      {source && (
        <p className="mt-2 text-xs text-slate-500">
          Les ventes venant de ce lien apparaîtront dans{' '}
          <span className="font-semibold text-navy-700">Audience → Performance des campagnes</span>.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={url}
          dir="ltr"
          aria-label="Lien publicitaire généré"
          onFocus={(e) => e.currentTarget.select()}
          className="field min-w-0 flex-1 bg-white font-mono text-xs"
        />
        <button type="button" onClick={copy} className="btn-accent shrink-0">
          {copied ? '✓ Copié' : 'Copier le lien'}
        </button>
      </div>
    </div>
  );
}
