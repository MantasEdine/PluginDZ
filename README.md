# Plugin.dz — boutique de chargeurs en gros

Catalogue e-commerce (gros / demi-gros) de chargeurs et accessoires de charge —
téléphone, montre, caméra, vélo électrique — pour le marché algérien.
**Français et arabe** (avec bascule RTL), prix en DA, **aucun paiement en ligne** :
la commande est enregistrée, le propriétaire reçoit un email, la livraison part
via **Yalidine** dans les **69 wilayas**, **livraison offerte**, paiement à la
réception.

## Contenu

```
.
├── server/          API Node + Express + TypeScript + Prisma + PostgreSQL
├── web/             Vitrine + back-office Next.js 15 + Tailwind v4
├── e2e/             Parcours acheteur de bout en bout (Playwright)
└── prospection/     Service de prospection — API Go + collecteur Python
    ├── api/         Prospects, suivi commercial, message WhatsApp (même jeton admin)
    └── collector/   Google Places → boutiques d'accessoires par wilaya
```

Le service de prospection a son propre [README](prospection/README.md) :
clé Google, variables, déploiement, et comment relire ou modifier le message
envoyé aux boutiques.

## Démarrage local

**1. Base de données + API**

```bash
cd server
cp .env.example .env          # ajuster DATABASE_URL, JWT_SECRET, RESEND_API_KEY
npm install
npx prisma migrate dev        # crée les tables
npm run seed                  # 7 marques, 5 types, 15 produits, 5 packs
npm run dev                   # http://localhost:4000
```

**2. Vitrine**

```bash
cd web
cp .env.example .env.local
npm install
npm run dev                   # http://localhost:3000
```

Back-office : http://localhost:3000/admin — `admin@plugin.dz` / `plugin2024`
(défini par `OWNER_EMAIL` / `OWNER_PASSWORD` dans `server/.env`, **à changer**).

## Tests

```bash
cd server && npm test         # 46 tests unitaires : téléphones, statuts, wilayas, slugs, attribution…
cd web    && npm test         # 25 tests unitaires : formatage, données structurées, contacts
cd e2e    && npm test         # 81 vérifications de bout en bout — pile locale uniquement
```

Les tests unitaires ne touchent ni base ni réseau et tournent en CI à chaque
push. La suite e2e crée de vraies commandes et modifie le stock : voir
[`e2e/README.md`](e2e/README.md) pour la lancer, et pour la section « livraison
et retour » qui demande un compte du back-office **local**.

## Fonctionnalités

### Vitrine
- **Accueil** : bannière, packs de gros mis en avant, promotions triées par
  remise décroissante, entrées par marque et par type.
- **Navigation dérivée du stock** : une marque n'affiche que les types de
  chargeurs qu'elle a réellement en rayon, et les sous-types réellement présents.
  Rien n'est codé en dur — un type sans stock disparaît tout seul.
- **Catalogue filtrable** : marque, type, sous-type, recherche, promo, tri
  (récent, prix croissant/décroissant, meilleures remises), pagination. Les
  filtres vivent dans l'URL, donc une recherche est partageable.
- **Fiche produit** : image, « détails », sélecteurs couleur / puissance / prise
  (affichés uniquement s'il y a plusieurs choix), prix mis à jour à la sélection,
  état du stock, produits similaires.
- **Packs** : contenu détaillé, valeur au détail et économie réalisée.
- **Panier** (localStorage), **commande** (nom, téléphone, wilaya parmi les 69,
  adresse, note), **confirmation** avec référence à copier, **suivi de commande**.
  Le suivi accepte toutes les écritures d'un même numéro (`+213…`, `00213…`,
  `06…`, avec ou sans espaces).
- **Contact** : bouton WhatsApp flottant (à droite en français, à gauche en
  arabe), Facebook / Instagram / TikTok en pied de page, tous déclarés en
  `sameAs` dans les données structurées.
- **Pastille « boutique officielle »** à côté du logo — un signe posé à côté de
  la marque, jamais dedans, dont le libellé accessible dit exactement ce qu'il
  affirme.
- **Écrans d'attente** : chaque page dessine sa silhouette pendant que le
  contenu arrive. Sur une connexion mobile lente, le visiteur voit que ça
  charge au lieu d'un écran figé.
- **Liens publicitaires** : `/panier?produit=slug&qty=2` (ou `?pack=slug`)
  dépose l'article directement au panier ; les paramètres `utm_*` du lien
  rattachent la vente à la campagne.

### Bilingue FR / AR
Le choix de langue est stocké dans un cookie, lu par le rendu serveur : le HTML
sort déjà avec le bon `lang` et `dir`, donc **le SEO fonctionne dans les deux
langues** et il n'y a pas de scintillement au chargement. La bascule est dans
l'en-tête (FR / ع). En arabe, toute l'interface passe en RTL — les marges
utilisent `ms-`/`me-` (logiques) et non `ml-`/`mr-`, donc la mise en page se
retourne proprement.

Les libellés d'interface sont dans `web/src/lib/i18n.ts` (un seul fichier, deux
colonnes). Les **données produits** (noms, descriptions) restent telles que
saisies au back-office : ajouter une traduction produit demanderait des colonnes
`name_ar` / `description_ar`, à faire seulement si le besoin se confirme.

### Référencement
Balises `<title>` / description orientées sur les mots réellement tapés par les
acheteurs, canonicals sur chaque page, `sitemap.xml` et `robots.txt` générés,
données structurées **schema.org** (`Product` avec prix en DZD et disponibilité,
`BreadcrumbList`, `OnlineStore`, `WebSite`). La balise de vérification Google
Search Console se pose via `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION`.

### Back-office (`/admin`)
- Connexion JWT, rôles **propriétaire** et **admin** ; un compte désactivé perd
  l'accès immédiatement, même avec un jeton encore valide.
- **Tableau de bord** : nouvelles commandes, **encaissé (livré)** — l'argent
  réellement perçu —, chiffre engagé, **taux de retour** (en rouge au-delà de
  20 %), ruptures (≤ 5), test d'envoi d'email.
- **Revenus** : chiffre d'affaires par jour et par mois, comparaison avec la
  période précédente.
- **Audience** : visiteurs et pages vues par jour, sources de trafic, et
  **performance des campagnes** (visiteurs → commandes → chiffre, par
  `utm_campaign`).
- **Produits** : création/modification avec déclinaisons multiples, upload
  d'image, promo, activation, et **générateur de lien pub** (déclinaison,
  quantité, réseau, campagne, copie en un clic — avec avertissement si l'article
  est en rupture).
- **Packs** : composition (déclinaison × quantité) avec calcul en direct de la
  valeur au détail et de l'économie client ; même générateur de lien pub.
- **Commandes** : liste filtrable (référence, nom, téléphone sous toutes ses
  écritures, wilaya), détail, changement de statut.
- **Marques & types** : création, renommage, suppression.
- **Prospection** : boutiques d'accessoires repérées sur Google Places, par
  wilaya, avec suivi (nouveau → contacté → intéressé → client), bouton
  **WhatsApp** qui ouvre la conversation avec un message en arabe déjà écrit
  (packs et prix lus en direct sur la boutique, lien marqué pour l'attribution)
  et bouton **Appeler**. Rien n'est envoyé automatiquement : le gérant relit et
  envoie, un prospect à la fois.

## Modèle de données

```
Brand → ChargerType → sous-type (texte) → Product → ProductVariant
Pack ──(PackItem)──> ProductVariant
Order ──(OrderItem)──> ProductVariant | Pack
Visit   (page vue anonyme + attribution de campagne)
```

- **`pack_items`** : table de jonction — un pack contient N unités d'une ou
  plusieurs déclinaisons, sans jamais modifier le schéma.
- **`order_items.unit_price`** : instantané du prix au moment de la commande.
  Les tarifs changent, l'historique des commandes reste juste.
- **Catégories dérivées** : `variants: { some: { stock: { gt: 0 } } }` — la
  navigation est un filtrage, pas un arbre figé.
- **Stock 0 = invisible** en boutique, toujours visible au back-office.

### Cycle de vie d'une commande

```
nouveau → confirme → expedie → livre
                         └──→ retourne
   └──────→ annule
```

| Statut | Stock | Chiffre d'affaires |
|---|---|---|
| `nouveau`, `confirme`, `expedie` | réservé | engagé (sauf `nouveau`) |
| `livre` | consommé | **encaissé** |
| `retourne` | **rendu au rayon** | exclu |
| `annule` | rendu au rayon | exclu |

La distinction **retourné / annulé** compte : un retour a coûté un transport
aller-retour, une annulation rien. Les règles vivent dans
`server/src/lib/order-status.ts`, d'où les requêtes dérivent leurs listes de
statuts — ajouter un statut sans décider s'il rapporte de l'argent fait échouer
un test.

### Garde-fous côté commande
- Le prix envoyé par le client est **ignoré** : le serveur relit le prix en base.
- Le stock est décrémenté dans la **même transaction** que la création, avec un
  garde `stock >= quantité` qui annule tout en cas de commande concurrente.
- Annuler ou déclarer retournée une commande **remet le stock en rayon** (une
  seule fois, quel que soit le nombre de bascules de statut).
- Le numéro de téléphone est **normalisé** (`0XXXXXXXXX`) à l'enregistrement et
  comparé sous sa forme canonique au suivi.
- L'échec de l'email ne fait jamais échouer la commande.
- Le suivi de commande exige la référence **et** le téléphone du client.
- **Limites de débit** (par IP, pensées pour le NAT des opérateurs mobiles) :
  connexion 20 / 15 min, commandes 60 / min, suivi 120 / min, tracking 1200 / min.

### Attribution des campagnes
Un lien portant `utm_source` / `utm_campaign` (ou `gclid` / `fbclid`) est
mémorisé en cookie first-party pendant 30 jours selon la règle du dernier
contact ; chaque page vue et la commande le transmettent, et le back-office
rapproche visites et ventes par campagne. Aucune donnée personnelle : l'identifiant
de visiteur est un aléa de navigateur. La normalisation est faite **côté serveur**
(`server/src/lib/attribution.ts`) pour que visites et commandes soient
comparables à l'octet près.

## Déploiement

**Vitrine → Vercel**
1. Importer le dépôt, régler *Root Directory* sur `web`.
2. Variables : `NEXT_PUBLIC_API_URL`, `API_URL`, `NEXT_PUBLIC_SITE_URL`
   (`https://plugin-dz.com` — sert aux canonicals, au sitemap et au générateur
   de liens pub), `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` (optionnel).

**API → Railway / Render / Fly** (Vercel n'héberge pas bien un Express
long-running, et les images uploadées ont besoin d'un disque persistant)
1. Racine `server`, build `npm run build`, start `npm start`.
2. Variables : `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS` (les URL du site,
   séparées par des virgules), `PUBLIC_API_URL`, `RESEND_API_KEY`, `MAIL_FROM`,
   `ORDER_NOTIFICATION_EMAIL`.
3. Au premier déploiement : `npx prisma migrate deploy` puis `npm run seed`.
   **À chaque migration suivante, redéployer l'API** — le site seul ne suffit pas.

**Base → Neon / Supabase / Railway** : copier l'URL dans `DATABASE_URL`.

**Emails** : envoyés via [Resend](https://resend.com) par simple appel HTTP, sans
SDK. Sans `RESEND_API_KEY`, les notifications sont écrites dans la console —
pratique en développement. Le bouton « Tester l'email » du tableau de bord
indique la clé, l'expéditeur, le destinataire et la réponse de Resend.

**Images** : stockées dans `server/uploads/` et servies en statique. L'hébergeur
doit fournir un disque persistant ; sinon, coller des URLs Cloudinary dans le
champ image du back-office — aucune migration n'est nécessaire, le champ est
déjà une URL.

## Endpoints

### Publics
`GET /api/health` · `/api/wilayas` · `/api/brands` · `/api/brands/:slug` ·
`/api/charger-types` · `/api/charger-types/:slug` · `/api/products` ·
`/api/products/:slug` · `/api/promos` · `/api/packs` · `/api/packs/:slug` ·
`/api/orders/lookup` — `POST /api/orders` · `POST /api/track`

### Back-office (`Authorization: Bearer <token>`)
`POST /api/auth/login` · `GET /api/auth/me` · `POST /api/auth/password` ·
`GET /api/admin/stats` · `GET /api/admin/mail-test` ·
`GET /api/admin/analytics/{revenue,visitors,campaigns}` ·
CRUD `/api/admin/{brands,charger-types,products,packs}` ·
`GET /api/admin/variants` · `GET|PATCH /api/admin/orders` ·
`/api/admin/admins` (propriétaire) · `POST /api/admin/uploads`

## CI

`.github/workflows/plugin-dz.yml` : à chaque push, pour l'API (avec un Postgres
de service et les migrations) comme pour la vitrine — typecheck, **tests
unitaires**, build.

## Décisions prises

1. **Déclinaisons** : couleur / puissance / type de prise. Un produit à prix
   unique se crée avec une seule déclinaison — la fiche n'affiche alors aucun
   sélecteur.
2. **Sous-type** : champ texte nullable sur `products`. Il alimente le filtrage
   et la navigation par marque.
3. **« Pour les détails »** : le champ `description` (texte long).
4. **Comptes admin** : plusieurs comptes, un rôle `owner` (seul à pouvoir créer
   les autres) et des rôles `admin`.
5. **Wilayas** : liste fixe des **69** (1–48 historiques, 49–58 loi 19-12,
   59–69 loi 26-06 d'avril 2026), validée côté serveur.
6. **Images** : upload local avec nom de fichier aléatoire ; le champ reste une
   URL, donc passer à Cloudinary plus tard ne coûte aucune migration.
7. **Stock des packs** indépendant du stock des déclinaisons : un pack a son
   propre stock, vendre un pack ne décrémente pas les unités qui le composent.
   À revoir si les packs et les unités sortent du même rayon.

## Pistes suivantes

- Pixel Meta / TikTok, pour que les régies optimisent sur les commandes réelles.
- Choix **stop desk / à domicile** à la commande.
- Traduction des données produits (colonnes `name_ar` / `description_ar`).
- Galerie multi-images par produit.
- Export CSV des commandes au format Yalidine.
- Grille de prix dégressive par palier de quantité.
