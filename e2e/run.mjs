/**
 * Parcours acheteur de bout en bout + contrôles d'intégrité de l'API.
 *
 * À lancer contre une pile LOCALE (il crée de vraies commandes et modifie le stock) :
 *   1. démarrer Postgres, puis `npm run seed` dans server/
 *   2. `npm run dev` dans server/ et dans web/
 *   3. `node e2e/run.mjs`
 *
 * Nécessite Playwright : `npm i -D playwright && npx playwright install chromium`.
 * Variables : WEB_URL (def. http://localhost:3000), API_URL (def. http://localhost:4000),
 * CHROME_PATH pour un binaire Chromium déjà présent.
 */
import { chromium } from 'playwright';

const WEB = process.env.WEB_URL ?? 'http://localhost:3000';
const API = process.env.API_URL ?? 'http://localhost:4000';
const launchOpts = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {};

const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? '  PASS' : '  FAIL'}  ${name}${detail && !pass ? '  -> ' + detail : ''}`);
};
const section = (t) => console.log(`\n=== ${t} ===`);

const browser = await chromium.launch(launchOpts);

/** Contexte navigateur avec la langue choisie et collecte des erreurs JS. */
async function openPage(lang = 'fr', viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addCookies([{ name: 'plugin_lang', value: lang, domain: 'localhost', path: '/' }]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return { ctx, page, errors };
}

section('Catalogue');
{
  const { ctx, page, errors } = await openPage();
  await page.goto(WEB, { waitUntil: 'networkidle' });
  ok('La page d\'accueil affiche des produits', (await page.locator('a.card').count()) > 0);
  ok('Aucune erreur JS sur l\'accueil', errors.length === 0, errors.slice(0, 2).join(' | '));
  await page.goto(`${WEB}/produits`, { waitUntil: 'networkidle' });
  ok('Le catalogue affiche des produits', (await page.locator('a.card').count()) > 0);
  await ctx.close();
}

section('Fiche produit et panier');
let productSlug = null;
{
  const { ctx, page, errors } = await openPage();
  await page.goto(`${WEB}/produits`, { waitUntil: 'networkidle' });
  const first = page.locator('a.card').first();
  productSlug = (await first.getAttribute('href')).split('/').pop();
  await first.click();
  await page.waitForLoadState('networkidle');
  ok('La fiche produit s\'ouvre', (await page.locator('h1').first().innerText()).length > 0);
  ok('Le prix est affiché', (await page.locator('body').innerText()).includes('DA'));

  // Attendre l'hydratation : le bouton vient d'un composant client.
  const add = page.getByRole('button', { name: /Ajouter au panier/i }).first();
  await add.waitFor({ state: 'visible', timeout: 15000 });
  ok('Le bouton « Ajouter au panier » est présent', true);
  await add.click();
  await page.waitForTimeout(800);

  await page.goto(`${WEB}/panier`, { waitUntil: 'networkidle' });
  ok('L\'article arrive dans le panier', !/panier est vide/i.test(await page.locator('body').innerText()));
  ok('Aucune erreur JS sur le parcours produit', errors.length === 0, errors.slice(0, 2).join(' | '));
  await ctx.close();
}

section('Opérations panier');
{
  const { ctx, page } = await openPage();
  await page.goto(`${WEB}/panier?produit=${productSlug}&qty=2`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const qty = page.locator('input[type="number"]').first();
  ok('Le lien publicitaire fixe la quantité', (await qty.inputValue()) === '2');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  ok('Le panier survit au rafraîchissement', (await page.locator('input[type="number"]').count()) > 0);
  await page.getByRole('button', { name: /Retirer/i }).first().click();
  await page.waitForTimeout(600);
  ok('« Retirer » vide le panier', /panier est vide/i.test(await page.locator('body').innerText()));
  await ctx.close();
}

section('Commande');
let reference = null;
{
  const { ctx, page } = await openPage();
  await page.goto(`${WEB}/panier?produit=${productSlug}&qty=1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.goto(`${WEB}/commande`, { waitUntil: 'networkidle' });
  ok('Le formulaire de commande s\'affiche', (await page.locator('#customerName').count()) > 0);

  // Téléphone invalide : le refus de l'API est attendu, on ne compte pas les erreurs ici.
  await page.fill('#customerName', 'Test Acheteur');
  await page.fill('#customerPhone', '123');
  await page.selectOption('#customerWilaya', { index: 1 });
  await page.fill('#customerAddress', 'Rue de test, Alger');
  await page.click('button[type=submit]');
  await page.waitForTimeout(1500);
  ok('Un téléphone invalide est refusé', !page.url().includes('confirmation'), page.url());

  // À partir d'ici, plus aucune erreur ne doit apparaître.
  const errorsAfter = [];
  page.on('pageerror', (e) => errorsAfter.push(String(e)));
  await page.fill('#customerPhone', '0555112233');
  await page.click('button[type=submit]');
  await page.waitForTimeout(3000);
  ok('La commande mène à la confirmation', page.url().includes('/commande/confirmation'), page.url());
  reference = (await page.locator('body').innerText()).match(/PLG-\d{6}/)?.[0] ?? null;
  ok('La référence est affichée', !!reference, String(reference));
  ok('Le bouton « Copier » est présent', (await page.getByRole('button', { name: /Copier/i }).count()) > 0);
  ok('Aucune erreur JS après validation', errorsAfter.length === 0, errorsAfter.slice(0, 2).join(' | '));
  await ctx.close();
}

section('Suivi de commande');
{
  const { ctx, page } = await openPage();
  await page.goto(`${WEB}/suivi`, { waitUntil: 'networkidle' });
  await page.fill('#reference', reference ?? 'PLG-000001');
  await page.fill('#phone', '0555112233');
  await page.click('button[type=submit]');
  await page.waitForTimeout(2500);
  ok('Le suivi retrouve la commande', (await page.locator('body').innerText()).includes(reference ?? ''));
  await page.fill('#phone', '0555999999');
  await page.click('button[type=submit]');
  await page.waitForTimeout(2000);
  const txt = await page.locator('body').innerText();
  ok('Un mauvais téléphone ne révèle rien', /Aucune commande/i.test(txt) || !txt.includes('Alger'));
  await ctx.close();
}

section('Langue et RTL');
{
  const { ctx, page } = await openPage('ar');
  await page.goto(`${WEB}/produits`, { waitUntil: 'networkidle' });
  ok('L\'arabe bascule en RTL', (await page.evaluate(() => document.documentElement.dir)) === 'rtl');
  ok('Le contenu arabe s\'affiche', /[؀-ۿ]/.test(await page.locator('body').innerText()));
  await ctx.close();
}

section('Mobile 320px');
{
  for (const lang of ['fr', 'ar']) {
    const { ctx, page } = await openPage(lang, { width: 320, height: 700 });
    for (const path of ['/', '/produits', '/packs', '/suivi', '/panier']) {
      await page.goto(WEB + path, { waitUntil: 'networkidle' });
      const r = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      ok(`Pas de débordement horizontal — ${lang} ${path}`, r.sw <= r.cw + 1, `${r.sw}/${r.cw}`);
    }
    await ctx.close();
  }
}

section('Intégrité de l\'API');
{
  const products = await (await fetch(`${API}/api/products?perPage=1`)).json();
  const variant = products.data[0].variants.find((v) => v.stock > 0);
  const payload = (extra = {}) => ({
    customerName: 'API Test', customerPhone: '0556001122', customerWilaya: 'Alger',
    customerAddress: 'Rue test, Alger', items: [{ variantId: variant.id, quantity: 1 }], ...extra,
  });
  const post = (body) => fetch(`${API}/api/orders`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });

  const forcedTotal = await (await post(payload({ total: 1 }))).json();
  ok('Le client ne peut pas imposer le total', forcedTotal.data?.total === variant.price);

  const forcedStatus = await (await post(payload({ status: 'expedie' }))).json();
  ok('Le client ne peut pas imposer le statut', forcedStatus.data?.status === 'nouveau');

  ok('Quantité négative refusée',
    (await post({ ...payload(), items: [{ variantId: variant.id, quantity: -1 }] })).status === 400);
  ok('Stock insuffisant refusé',
    (await post({ ...payload(), items: [{ variantId: variant.id, quantity: 999 }] })).status === 409);
  ok('L\'API admin exige une authentification', (await fetch(`${API}/api/admin/orders`)).status === 401);
  ok('Suivi avec mauvais téléphone refusé',
    (await fetch(`${API}/api/orders/lookup?reference=PLG-000001&phone=0000000000`)).status === 404);
}

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n${'='.repeat(52)}`);
console.log(`${results.length - failed.length}/${results.length} vérifications réussies`);
if (failed.length) {
  console.log('\nÉCHECS :');
  failed.forEach((f) => console.log(`  - ${f.name}`));
  process.exit(1);
}
