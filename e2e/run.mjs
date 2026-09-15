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

/**
 * Attend que le lien publicitaire ait réellement déposé sa ligne dans le panier.
 * Un délai fixe suffit sur une machine au repos et cède dès qu'elle est chargée :
 * on attend donc la quantité attendue, pas une durée.
 */
async function waitForCartQuantity(page, expected, timeout = 15000) {
  const field = page.locator('input[type="number"]').first();
  try {
    await field.waitFor({ state: 'visible', timeout });
    await page.waitForFunction(
      (want) => {
        const input = document.querySelector('input[type="number"]');
        return input instanceof HTMLInputElement && input.value === String(want);
      },
      expected,
      { timeout },
    );
  } catch {
    /* l'assertion appelante rapportera la valeur réellement lue */
  }
  return field.inputValue().catch(() => '');
}

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

/**
 * Produit de référence pour les tests qui manipulent des quantités.
 *
 * Il est choisi via l'API, et non « le premier de la liste » : l'ordre d'affichage
 * dépend des promotions et du stock, et un produit qui n'a qu'une unité en rayon
 * fait échouer un ajout au panier de 3 — sans qu'il y ait le moindre défaut.
 */
const catalogue = await (await fetch(`${API}/api/products?perPage=50`)).json();
const testProduct = (catalogue.data ?? [])
  .map((p) => ({ slug: p.slug, variant: p.variants.find((v) => v.stock >= 5) }))
  .find((p) => p.variant);

if (!testProduct) {
  console.log('\nImpossible de continuer : aucun produit n\'a de déclinaison avec au moins');
  console.log('5 unités en stock. Relancer `npm run seed` dans server/ pour repartir au propre.');
  await browser.close();
  process.exit(1);
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
{
  // Ici on suit délibérément la première carte du catalogue : c'est le chemin
  // qu'emprunte un visiteur, et il doit fonctionner quel que soit le produit.
  const { ctx, page, errors } = await openPage();
  await page.goto(`${WEB}/produits`, { waitUntil: 'networkidle' });
  const first = page.locator('a.card').first();
  await first.click();
  await page.waitForLoadState('networkidle');
  // Depuis les écrans d'attente, « réseau au repos » peut survenir pendant que le
  // squelette est encore affiché : on attend le vrai contenu, pas le silence réseau.
  await page.locator('h1').first().waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForFunction(() => document.querySelectorAll('.skeleton').length === 0, null, { timeout: 15000 });
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
  await page.goto(`${WEB}/panier?produit=${testProduct.slug}&qty=2`, { waitUntil: 'networkidle' });
  const lue = await waitForCartQuantity(page, 2);
  ok('Le lien publicitaire fixe la quantité', lue === '2', `quantité lue : ${lue || '(champ absent)'}`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  ok('Le panier survit au rafraîchissement', (await page.locator('input[type="number"]').count()) > 0);
  const remove = page.getByRole('button', { name: /Retirer/i }).first();
  const removable = await remove.isVisible().catch(() => false);
  if (removable) {
    await remove.click();
    await page.waitForTimeout(600);
  }
  ok('« Retirer » vide le panier',
    removable && /panier est vide/i.test(await page.locator('body').innerText()),
    removable ? 'le panier n\'est pas vide après suppression' : 'aucune ligne à retirer');
  await ctx.close();
}

section('Commande');
let reference = null;
{
  const { ctx, page } = await openPage();
  await page.goto(`${WEB}/panier?produit=${testProduct.slug}&qty=1`, { waitUntil: 'networkidle' });
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

section('Contact et réseaux');
{
  const { ctx, page } = await openPage('fr');
  await page.goto(`${WEB}/`, { waitUntil: 'networkidle' });

  const wa = await page.evaluate(() => {
    const all = [...document.querySelectorAll('a[href*="wa.me"]')];
    // Le pied de page a aussi un lien WhatsApp : le bouton flottant est le seul
    // en position fixed.
    const floating = all.find((el) => getComputedStyle(el).position === 'fixed');
    const r = floating?.getBoundingClientRect();
    return {
      total: all.length,
      href: floating?.getAttribute('href') ?? '',
      w: r ? Math.round(r.width) : 0,
      h: r ? Math.round(r.height) : 0,
      onScreen: r ? r.right <= window.innerWidth + 1 && r.bottom <= window.innerHeight + 1 : false,
      social: ['facebook.com', 'instagram.com', 'tiktok.com']
        .filter((host) => document.querySelector(`a[href*="${host}"]`)).length,
      sameAs: (() => {
        const tag = [...document.querySelectorAll('script[type="application/ld+json"]')]
          .map((n) => JSON.parse(n.textContent))
          .find((d) => d['@type'] === 'OnlineStore');
        return Array.isArray(tag?.sameAs) ? tag.sameAs.length : 0;
      })(),
    };
  });

  ok('Le bouton WhatsApp flottant est présent', wa.w > 0);
  ok('Il pointe vers le bon numéro', /wa\.me\/213549982823/.test(wa.href), wa.href);
  ok('Sa cible tactile fait au moins 44 px', wa.w >= 44 && wa.h >= 44, `${wa.w}x${wa.h}`);
  ok('Il reste dans l\'écran', wa.onScreen);
  ok('Le pied de page propose aussi WhatsApp', wa.total >= 2, `${wa.total} lien(s)`);
  ok('Les trois réseaux sont liés', wa.social === 3, `${wa.social}/3`);
  ok('Les réseaux sont déclarés dans les données structurées', wa.sameAs === 3, `sameAs: ${wa.sameAs}`);

  // Le bouton s'adresse aux clients : dans le back-office il recouvrirait les
  // formulaires de gestion.
  await page.goto(`${WEB}/admin/login`, { waitUntil: 'networkidle' });
  const inAdmin = await page.evaluate(() =>
    [...document.querySelectorAll('a[href*="wa.me"]')]
      .some((el) => getComputedStyle(el).position === 'fixed'));
  ok('Le bouton flottant est absent du back-office', !inAdmin);
  await ctx.close();
}

section('Pastille boutique officielle');
for (const [lang, attendu] of [['fr', 'Boutique officielle Plugin.dz'], ['ar', 'متجر Plugin.dz الرسمي']]) {
  for (const width of [320, 1280]) {
    const { ctx, page } = await openPage(lang, { width, height: 800 });
    await page.goto(`${WEB}/`, { waitUntil: 'networkidle' });
    const info = await page.evaluate(() => {
      const header = document.querySelector('header');
      // L'en-tête contient la version compacte ET la version large du logo :
      // l'une des deux est masquée selon la largeur, on veut celle qui s'affiche.
      const badge = [...header.querySelectorAll('svg[role="img"]')]
        .filter((el) => el.querySelector('title'))
        .find((el) => el.getBoundingClientRect().width > 0);
      const r = badge?.getBoundingClientRect();
      const cart = header.querySelector('a[href*="panier"]');
      const c = cart?.getBoundingClientRect();
      return {
        w: r ? Math.round(r.width) : 0,
        label: badge?.getAttribute('aria-label') ?? '',
        inside: r ? r.right <= window.innerWidth + 1 && r.left >= -1 : false,
        overlapsCart: r && c
          ? !(r.right <= c.left || r.left >= c.right || r.bottom <= c.top || r.top >= c.bottom)
          : false,
        scrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth,
      };
    });
    ok(`La pastille s'affiche — ${lang} ${width}px`, info.w >= 14, `${info.w}px`);
    ok(`Son libellé est traduit — ${lang} ${width}px`, info.label === attendu, info.label);
    ok(`Elle reste dans l'écran — ${lang} ${width}px`, info.inside);
    ok(`Elle ne recouvre pas le panier — ${lang} ${width}px`, !info.overlapsCart);
    // Le risque réel de cette pastille : quelques pixels de plus dans un en-tête
    // déjà serré sur un écran de 320 px.
    ok(`L'en-tête ne déborde pas — ${lang} ${width}px`, info.scrollW <= info.innerW + 1,
      `${info.scrollW} > ${info.innerW}`);
    await ctx.close();
  }
}

section('Lien publicitaire vers le panier');
{
  const { ctx, page } = await openPage('fr');
  // Reproduit exactement ce que le back-office met dans le presse-papiers.
  const link = `${WEB}/panier?produit=${testProduct.slug}&qty=3`
    + '&utm_source=tiktok&utm_medium=social&utm_campaign=test-e2e';
  await page.goto(link, { waitUntil: 'networkidle' });
  const lue = await waitForCartQuantity(page, 3);

  const qty = page.locator('input[type="number"]').first();
  ok('Le lien pub dépose l\'article au panier', await qty.isVisible().catch(() => false));
  ok('Le lien pub applique la quantité', lue === '3', `quantité lue : ${lue || '(champ absent)'}`);
  ok('Le lien pub nettoie l\'URL', !/utm_|produit=/.test(page.url()), page.url());

  const attrib = await page.evaluate(() => {
    const row = document.cookie.split('; ').find((r) => r.startsWith('plugin_attrib='));
    return row ? JSON.parse(decodeURIComponent(row.slice('plugin_attrib='.length))) : null;
  });
  ok('La campagne du lien est mémorisée pour la commande',
    attrib?.source === 'tiktok' && attrib?.campaign === 'test-e2e', JSON.stringify(attrib));
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

  // Un client écrit son numéro comme il veut : « +213 661... », « 00213... » ou
  // « 0661... » désignent la même ligne et doivent tous retrouver sa commande.
  const intlResponse = await post(payload({ customerPhone: '+213 661 44 55 66' }));
  const intl = await intlResponse.json();
  const intlRef = intl.data?.reference;
  ok('La commande de contrôle est bien créée', Boolean(intlRef),
    `HTTP ${intlResponse.status} — ${JSON.stringify(intl).slice(0, 160)}`);
  const formats = ['+213661445566', '00213661445566', '0661445566', '0661 44 55 66'];
  const codes = [];
  for (const phone of formats) {
    const r = await fetch(`${API}/api/orders/lookup?reference=${intlRef}&phone=${encodeURIComponent(phone)}`);
    codes.push(r.status);
  }
  ok('Le suivi accepte toutes les écritures du même numéro', codes.every((c) => c === 200),
    `référence ${intlRef ?? '(non créée)'} — ` + formats.map((f, i) => `${f} → ${codes[i]}`).join(', '));
  ok('Un autre numéro reste refusé malgré la normalisation',
    (await fetch(`${API}/api/orders/lookup?reference=${intlRef}&phone=0661445567`)).status === 404);
}

/*
 * Cycle de vie « livrée / retournée ». Nécessite un compte du back-office :
 * exporter ADMIN_EMAIL et ADMIN_PASSWORD pour activer cette section, sinon elle
 * est signalée comme ignorée plutôt que de faire échouer la suite.
 */
section('Livraison et retour (back-office)');
if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
  console.log('  SKIP  ADMIN_EMAIL / ADMIN_PASSWORD absents — section ignorée');
} else {
  const auth = await (await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
  })).json();
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.data?.token}` };

  // Le slug et la déclinaison viennent du même produit : les croiser donnait un
  // `undefined` selon l'ordre du catalogue.
  const stockOf = async (id) => {
    const p = await (await fetch(`${API}/api/products/${testProduct.slug}`)).json();
    return p.data.variants.find((v) => v.id === id)?.stock ?? null;
  };
  const setStatus = (id, status) =>
    fetch(`${API}/api/admin/orders/${id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ status }) });
  const stats = async () => (await (await fetch(`${API}/api/admin/stats`, { headers: H })).json()).data;

  const v = testProduct.variant;
  const before = await stockOf(v.id);
  ok('Le stock de départ est lisible', typeof before === 'number', `lu : ${before}`);

  const created = await (await fetch(`${API}/api/orders`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: 'E2E Cycle Colis', customerPhone: '0661778899', customerWilaya: 'Alger',
      customerAddress: 'Rue du cycle, Alger', items: [{ variantId: v.id, quantity: 2 }],
    }),
  })).json();
  const list = await (await fetch(`${API}/api/admin/orders?search=${created.data.reference}`, { headers: H })).json();
  const orderId = list.data[0].id;

  await setStatus(orderId, 'expedie');
  ok('Un colis expédié garde le stock réservé', (await stockOf(v.id)) === before - 2);

  const s0 = await stats();
  await setStatus(orderId, 'livre');
  const s1 = await stats();
  ok('Une commande livrée entre dans l\'encaissé',
    s1.deliveredRevenue === s0.deliveredRevenue + created.data.total);
  ok('Une commande livrée ne revient pas en stock', (await stockOf(v.id)) === before - 2);

  await setStatus(orderId, 'retourne');
  ok('Un colis retourné revient en stock', (await stockOf(v.id)) === before,
    `${before - 2} -> ${await stockOf(v.id)}, attendu ${before}`);
  const s2 = await stats();
  ok('Un colis retourné sort de l\'encaissé', s2.deliveredRevenue === s0.deliveredRevenue);
  ok('Le taux de retour est exposé', typeof s2.returnRate === 'number');

  // Le piège classique : basculer entre états ne doit jamais créer de stock.
  for (let i = 0; i < 3; i++) { await setStatus(orderId, 'livre'); await setStatus(orderId, 'retourne'); }
  ok('Les bascules livré/retourné ne gonflent pas le stock', (await stockOf(v.id)) === before,
    `stock final ${await stockOf(v.id)}, attendu ${before}`);

  ok('Un statut inconnu est rejeté', (await setStatus(orderId, 'statut_invente')).status === 400);
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
