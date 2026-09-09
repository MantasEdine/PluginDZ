'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin';
import { formatDa } from '@/lib/format';

interface Stats {
  newOrders: number; totalOrders: number; products: number;
  packs: number; lowStock: number; confirmedRevenue: number;
}

interface MailDiagnostic {
  resendConfigured: boolean;
  from: string;
  to: string;
  status?: number;
  ok?: boolean;
  detail?: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [mail, setMail] = useState<MailDiagnostic | null>(null);
  const [mailLoading, setMailLoading] = useState(false);

  useEffect(() => {
    adminFetch<{ data: Stats }>('/api/admin/stats')
      .then((payload) => setStats(payload.data))
      .catch(() => setStats(null));
  }, []);

  async function testMail() {
    setMailLoading(true);
    setMail(null);
    try {
      const payload = await adminFetch<{ data: MailDiagnostic }>('/api/admin/mail-test');
      setMail(payload.data);
    } catch (err) {
      setMail({ resendConfigured: false, from: '', to: '', ok: false, detail: String(err) });
    }
    setMailLoading(false);
  }

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

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-navy-900">Notifications par email</h2>
            <p className="mt-1 text-sm text-slate-500">
              Envoie un email de test pour vérifier que vous recevez bien les commandes.
            </p>
          </div>
          <button type="button" onClick={testMail} disabled={mailLoading} className="btn-accent">
            {mailLoading ? 'Envoi...' : 'Tester l\'email'}
          </button>
        </div>

        {mail && (
          <div
            className={`mt-4 rounded-lg border p-4 text-sm ${
              mail.ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'
            }`}
          >
            <p className={`font-semibold ${mail.ok ? 'text-emerald-700' : 'text-red-700'}`}>
              {mail.ok
                ? 'Email de test envoyé — vérifiez votre boîte (et les spams).'
                : 'L\'envoi a échoué. Détails ci-dessous :'}
            </p>
            <ul className="mt-2 space-y-1 text-slate-600">
              <li><b>Clé Resend configurée :</b> {mail.resendConfigured ? 'oui' : 'NON'}</li>
              <li><b>Expéditeur (from) :</b> {mail.from || '—'}</li>
              <li><b>Destinataire (to) :</b> {mail.to || '—'}</li>
              {mail.status !== undefined && <li><b>Réponse Resend :</b> HTTP {mail.status}</li>}
              {mail.detail && (
                <li className="break-words"><b>Message :</b> <code className="text-xs">{mail.detail}</code></li>
              )}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
