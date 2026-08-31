'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { adminFetch, clearToken, getToken } from '@/lib/admin';
import { Logo } from '@/components/Logo';

const LINKS = [
  { href: '/admin', label: 'Tableau de bord' },
  { href: '/admin/revenus', label: 'Revenus' },
  { href: '/admin/audience', label: 'Audience' },
  { href: '/admin/commandes', label: 'Commandes' },
  { href: '/admin/produits', label: 'Produits' },
  { href: '/admin/packs', label: 'Packs' },
  { href: '/admin/marques', label: 'Marques & types' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const isLogin = pathname === '/admin/login';

  useEffect(() => {
    if (isLogin) return;
    if (!getToken()) {
      router.replace('/admin/login');
      return;
    }
    adminFetch<{ data: { name: string; role: string } }>('/api/auth/me')
      .then((payload) => setUser(payload.data))
      .catch(() => router.replace('/admin/login'));
  }, [isLogin, router, pathname]);

  if (isLogin) return <div className="min-h-screen bg-slate-100">{children}</div>;

  return (
    <div className="min-h-screen bg-slate-100" dir="ltr">
      <div className="flex items-center gap-4 bg-navy-800 px-4 py-3 text-white">
        <span className="rounded bg-white px-2 py-1"><Logo compact /></span>
        <span className="font-bold">Back-office</span>
        <nav className="ms-4 hidden gap-1 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                pathname === link.href ? 'bg-white/20' : 'hover:bg-white/10'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-3 text-sm">
          <Link href="/" className="text-white/70 hover:text-white">Voir la boutique</Link>
          {user && <span className="hidden sm:inline text-white/80">{user.name}</span>}
          <button
            type="button"
            onClick={() => { clearToken(); router.replace('/admin/login'); }}
            className="rounded-lg border border-white/30 px-3 py-1.5"
          >
            Déconnexion
          </button>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto bg-navy-700 px-4 py-2 text-white md:hidden">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="whitespace-nowrap rounded px-3 py-1.5 text-sm">
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="mx-auto max-w-7xl p-4">{children}</div>
    </div>
  );
}
