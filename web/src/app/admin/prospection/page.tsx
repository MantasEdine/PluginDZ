'use client';

import { useCallback, useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin';
import { PROSPECTION_URL } from '@/lib/api';

/**
 * Prospection : les boutiques d'accessoires téléphone repérées sur Google, à
 * contacter une par une.
 *
 * Cette page parle au service de prospection (Go), pas à l'API boutique — mais
 * avec le même jeton : `adminFetch` accepte une URL absolue. Rien n'est envoyé
 * d'ici : le bouton WhatsApp ouvre la conversation avec le message déjà écrit,
 * le bouton Appel compose le numéro. Le gérant relit, puis envoie ou parle.
 */

type Status = 'nouveau' | 'contacte' | 'interesse' | 'client' | 'pas_interesse' | 'ne_pas_contacter';

const STATUSES: Status[] = ['nouveau', 'contacte', 'interesse', 'client', 'pas_interesse', 'ne_pas_contacter'];

const LABELS: Record<Status, string> = {
  nouveau: 'Nouveau',
  contacte: 'Contacté',
  interesse: 'Intéressé',
  client: 'Client',
  pas_interesse: 'Pas intéressé',
  ne_pas_contacter: 'Ne pas contacter',
};

const COLORS: Record<Status, string> = {
  nouveau: 'bg-plug-500 text-white',
  contacte: 'bg-sky-100 text-sky-800',
  interesse: 'bg-amber-100 text-amber-800',
  client: 'bg-emerald-600 text-white',
  pas_interesse: 'bg-slate-200 text-slate-600',
  ne_pas_contacter: 'bg-red-100 text-red-700',
};

interface Lead {
  id: number;
  name: string;
  phoneNational?: string;
  phoneE164?: string;
  isMobile: boolean;
  address?: string;
  wilaya?: string;
  mapsUrl?: string;
  website?: string;
  rating?: number;
  ratingCount?: number;
  status: Status;
  note?: string;
  firstSeenAt: string;
  contactedAt?: string;
}

interface Page {
  items: Lead[];
  total: number;
  page: number;
  perPage: number;
}

interface Stats {
  total: number;
  byStatus: Partial<Record<Status, number>>;
  byWilaya: Record<string, number>;
}

interface Contact {
  contactable: boolean;
  message: string;
  whatsappUrl?: string;
  telUrl?: string;
  packsCited: number;
}

const api = (path: string, init?: RequestInit) => adminFetch<{ data: unknown }>(`${PROSPECTION_URL}${path}`, init);

export default function ProspectionPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [wilayas, setWilayas] = useState<string[]>([]);
  const [page, setPage] = useState<Page | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [wilaya, setWilaya] = useState('');
  const [status, setStatus] = useState<'' | Status>('');
  const [query, setQuery] = useState('');
  const [pageNo, setPageNo] = useState(1);

  const load = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams({ page: String(pageNo), perPage: '50' });
    if (wilaya) params.set('wilaya', wilaya);
    if (status) params.set('status', status);
    if (query.trim()) params.set('q', query.trim());
    try {
      const [s, w, p] = await Promise.all([api('/stats'), api('/wilayas'), api(`/leads?${params}`)]);
      setStats(s.data as Stats);
      setWilayas(w.data as string[]);
      setPage(p.data as Page);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [wilaya, status, query, pageNo]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = page ? Math.max(1, Math.ceil(page.total / page.perPage)) : 1;
  const contacted = stats
    ? (stats.byStatus.contacte ?? 0) + (stats.byStatus.interesse ?? 0) + (stats.byStatus.client ?? 0) + (stats.byStatus.pas_interesse ?? 0)
    : 0;
  const conversion = contacted > 0 && stats ? Math.round(((stats.byStatus.client ?? 0) / contacted) * 100) : 0;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900">Prospection</h1>
          <p className="mt-1 text-sm text-slate-500">
            Boutiques d&apos;accessoires repérées sur Google. Un clic ouvre WhatsApp avec le message prêt — à vous d&apos;envoyer.
          </p>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error} — le service de prospection est-il démarré ({PROSPECTION_URL}) ?
        </p>
      )}

      {stats && (
        <div className="mb-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ['Prospects', stats.total],
            ['Nouveaux', stats.byStatus.nouveau ?? 0],
            ['Contactés', stats.byStatus.contacte ?? 0],
            ['Intéressés', stats.byStatus.interesse ?? 0],
            ['Clients', stats.byStatus.client ?? 0],
            ['Conversion', `${conversion} %`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-0.5 text-xl font-extrabold text-navy-700">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtres */}
      <div className="mb-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="f-wilaya">Wilaya</label>
          <select id="f-wilaya" className="field" value={wilaya} onChange={(e) => { setWilaya(e.target.value); setPageNo(1); }}>
            <option value="">Toutes</option>
            {wilayas.map((w) => <option key={w} value={w}>{w}{stats?.byWilaya[w] ? ` (${stats.byWilaya[w]})` : ''}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-status">Statut</label>
          <select id="f-status" className="field" value={status} onChange={(e) => { setStatus(e.target.value as '' | Status); setPageNo(1); }}>
            <option value="">Tous</option>
            {STATUSES.map((s) => <option key={s} value={s}>{LABELS[s]}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="f-q">Recherche</label>
          <input id="f-q" className="field" placeholder="Nom, adresse, téléphone…" value={query}
            onChange={(e) => { setQuery(e.target.value); setPageNo(1); }} />
        </div>
      </div>

      {!page ? (
        <p className="text-slate-500">Chargement…</p>
      ) : page.total === 0 ? (
        <EmptyState filtered={Boolean(wilaya || status || query)} />
      ) : (
        <>
          <div className="space-y-3">
            {page.items.map((lead) => (
              <LeadCard key={lead.id} lead={lead} onChanged={load} />
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between text-sm text-slate-600">
            <span>{page.total} prospect{page.total > 1 ? 's' : ''}</span>
            <div className="flex items-center gap-2">
              <button type="button" className="btn-outline" disabled={pageNo <= 1} onClick={() => setPageNo((n) => n - 1)}>← Précédent</button>
              <span>page {page.page} / {totalPages}</span>
              <button type="button" className="btn-outline" disabled={pageNo >= totalPages} onClick={() => setPageNo((n) => n + 1)}>Suivant →</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState({ filtered }: { filtered: boolean }) {
  if (filtered) {
    return <p className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500">Aucun prospect ne correspond à ces filtres.</p>;
  }
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-8 text-slate-600">
      <p className="font-semibold text-navy-900">Aucun prospect pour l&apos;instant.</p>
      <p className="mt-2 text-sm">
        Lancez le collecteur pour remplir cette liste depuis Google Places :
      </p>
      <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
{`cd prospection/collector
plugin-collect run --wilayas Alger Oran      # deux wilayas pour commencer
plugin-collect run                           # les 69`}
      </pre>
      <p className="mt-2 text-xs text-slate-500">Voir prospection/README.md pour la clé Google et les variables.</p>
    </div>
  );
}

/**
 * Une boutique : coordonnées, suivi, et les deux boutons.
 *
 * Le lien WhatsApp est un vrai lien (pas un `window.open` après requête) : le
 * navigateur ne le bloque jamais, et on peut le copier. Il est chargé à
 * l'affichage de la fiche, avec le message composé par le service.
 */
function LeadCard({ lead, onChanged }: { lead: Lead; onChanged: () => void }) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [showMessage, setShowMessage] = useState(false);
  const [note, setNote] = useState(lead.note ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    api(`/leads/${lead.id}/contact`)
      .then((r) => { if (alive) setContact(r.data as Contact); })
      .catch(() => { if (alive) setContact(null); });
    return () => { alive = false; };
  }, [lead.id, lead.status]);

  async function save(body: { status?: Status; note?: string }) {
    setSaving(true);
    try {
      await api(`/leads/${lead.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  const blocked = lead.status === 'ne_pas_contacter';

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-bold text-navy-900">{lead.name}</h2>
            <span className={`badge ${COLORS[lead.status]}`}>{LABELS[lead.status]}</span>
            {lead.rating !== undefined && (
              <span className="text-xs text-slate-500">★ {lead.rating.toFixed(1)}{lead.ratingCount ? ` (${lead.ratingCount})` : ''}</span>
            )}
          </div>
          <p className="mt-1 break-words text-sm text-slate-600">
            {lead.wilaya && <span className="font-medium text-navy-700">{lead.wilaya}</span>}
            {lead.wilaya && lead.address && ' · '}
            {lead.address}
          </p>
          <p className="mt-1 flex flex-wrap gap-x-3 text-sm">
            {lead.phoneNational ? (
              <span dir="ltr" className="font-mono text-navy-800">{lead.phoneNational}{!lead.isMobile && <span className="ms-1 text-xs text-slate-400">(fixe)</span>}</span>
            ) : (
              <span className="text-slate-400">Pas de numéro</span>
            )}
            {lead.mapsUrl && <a href={lead.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-plug-500 hover:underline">Google Maps</a>}
            {lead.website && <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-plug-500 hover:underline">Site</a>}
          </p>
        </div>

        {/* Boutons d'action */}
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          {blocked ? (
            <span className="text-sm text-red-700">Ne pas contacter</span>
          ) : (
            <>
              {contact?.whatsappUrl ? (
                <a href={contact.whatsappUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#25D366] px-4 text-sm font-semibold text-white hover:brightness-110">
                  WhatsApp
                </a>
              ) : lead.isMobile && lead.phoneE164 ? (
                <span className="inline-flex min-h-11 items-center rounded-lg bg-slate-100 px-4 text-sm text-slate-400">WhatsApp…</span>
              ) : null}
              {contact?.telUrl ? (
                <a href={contact.telUrl} className="btn-outline min-h-11">Appeler</a>
              ) : null}
            </>
          )}
          <select className="field min-h-11 w-auto" value={lead.status} disabled={saving}
            onChange={(e) => void save({ status: e.target.value as Status })} aria-label="Statut">
            {STATUSES.map((s) => <option key={s} value={s}>{LABELS[s]}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <button type="button" className="text-plug-500 hover:underline" onClick={() => setShowMessage((v) => !v)}>
          {showMessage ? 'Masquer le message' : 'Voir le message'}
        </button>
        <span className="text-slate-400">·</span>
        <label className="flex flex-1 items-center gap-2">
          <span className="text-slate-500">Note</span>
          <input className="field flex-1 py-1.5" value={note} placeholder="rappeler jeudi, demande le prix du pack 20…"
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => { if (note !== (lead.note ?? '')) void save({ note }); }} />
        </label>
      </div>

      {showMessage && contact && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs text-slate-500">
            Message tel qu&apos;il s&apos;ouvrira dans WhatsApp — {contact.packsCited} pack{contact.packsCited > 1 ? 's' : ''} cité{contact.packsCited > 1 ? 's' : ''}, prix lus en direct sur la boutique.
          </p>
          {/* [overflow-wrap:anywhere] : le message contient une URL d'un seul tenant.
              Sans césure autorisée, un mobile élargit la mise en page entière pour la
              faire tenir, au lieu de la couper. */}
          <pre dir="rtl" className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-navy-900 [overflow-wrap:anywhere]">{contact.message}</pre>
        </div>
      )}
    </article>
  );
}
