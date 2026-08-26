'use client';

import { useState } from 'react';
import { adminFetch } from '@/lib/admin';

/** Upload d'image vers l'API ; le champ reste éditable pour coller une URL externe. */
export function ImageUpload({
  value,
  onChange,
  label = 'Image',
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('file', file);
      const payload = await adminFetch<{ data: { url: string } }>('/api/admin/uploads', { method: 'POST', body });
      onChange(payload.data.url);
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  }

  return (
    <div>
      <span className="label">{label}</span>
      <div className="flex items-start gap-3">
        <div className="h-20 w-20 shrink-0 rounded-lg border border-slate-200 bg-slate-50">
          {value && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-contain p-1" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <input
            className="field"
            placeholder="https://... ou téléverser"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
          <input
            type="file"
            accept="image/*"
            disabled={busy}
            className="text-sm"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          {busy && <p className="text-xs text-slate-500">Envoi en cours...</p>}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
