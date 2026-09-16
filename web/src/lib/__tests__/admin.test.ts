import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

// adminFetch tourne dans le navigateur : on lui fabrique le strict minimum
// (localStorage, location, fetch) pour vérifier ce qu'il fait d'un 401.
type Stub = { calls: string[]; status: number; body: unknown };

function install(stub: Stub) {
  const storage = new Map<string, string>([['plugin_admin_token', 'jeton-boutique']]);
  const win = {
    localStorage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => void storage.set(k, v),
      removeItem: (k: string) => void storage.delete(k),
    },
    location: { href: '/admin/prospection' },
  };
  (globalThis as { window?: unknown }).window = win;
  globalThis.fetch = (async (url: string) => {
    stub.calls.push(url);
    return {
      status: stub.status,
      ok: stub.status < 400,
      json: async () => stub.body,
    };
  }) as unknown as typeof fetch;
  return { storage, win };
}

describe('adminFetch', () => {
  const originalFetch = globalThis.fetch;
  let stub: Stub;
  let env: ReturnType<typeof install>;

  beforeEach(() => {
    stub = { calls: [], status: 200, body: { data: 1 } };
    env = install(stub);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete (globalThis as { window?: unknown }).window;
  });

  it('un 401 de l’API boutique termine la session : jeton purgé, retour à la connexion', async () => {
    const { adminFetch } = await import('../admin');
    stub.status = 401;
    stub.body = { error: 'Session expirée' };
    await assert.rejects(adminFetch('/api/auth/me'), /Session expirée/);
    assert.equal(env.storage.has('plugin_admin_token'), false);
    assert.equal(env.win.location.href, '/admin/login');
  });

  it('un 401 d’un autre service ne déconnecte pas : son message remonte à la page', async () => {
    const { adminFetch } = await import('../admin');
    stub.status = 401;
    stub.body = { error: 'Jeton refusé par le service de prospection : JWT_SECRET différent' };
    await assert.rejects(adminFetch('https://prospection.example/stats'), /JWT_SECRET différent/);
    // La session boutique est intacte : pas de boucle de déconnexion.
    assert.equal(env.storage.get('plugin_admin_token'), 'jeton-boutique');
    assert.equal(env.win.location.href, '/admin/prospection');
  });

  it('envoie le même jeton aux deux services', async () => {
    const { adminFetch } = await import('../admin');
    let seen: Record<string, string> | undefined;
    globalThis.fetch = (async (_url: string, init: { headers: Record<string, string> }) => {
      seen = init.headers;
      return { status: 200, ok: true, json: async () => ({ data: [] }) };
    }) as unknown as typeof fetch;
    await adminFetch('https://prospection.example/leads');
    assert.equal(seen?.Authorization, 'Bearer jeton-boutique');
  });
});
