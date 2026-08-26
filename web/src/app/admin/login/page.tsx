'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PUBLIC_API_URL } from '@/lib/api';
import { setToken } from '@/lib/admin';
import { Logo } from '@/components/Logo';

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch(`${PUBLIC_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error ?? 'Connexion impossible');
        setLoading(false);
        return;
      }
      setToken(payload.data.token);
      router.replace('/admin');
    } catch {
      setError('API injoignable');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4" dir="ltr">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-6 text-center"><Logo /></div>
        <h1 className="mb-5 text-center text-lg font-bold text-navy-900">Connexion au back-office</h1>
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required className="field" autoComplete="username" />
          </div>
          <div>
            <label className="label" htmlFor="password">Mot de passe</label>
            <input id="password" name="password" type="password" required className="field" autoComplete="current-password" />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </div>
      </form>
    </div>
  );
}
