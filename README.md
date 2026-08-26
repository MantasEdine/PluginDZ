# Plugin.dz — boutique de chargeurs en gros

Catalogue e-commerce (gros / demi-gros) de chargeurs et accessoires de charge —
téléphone, montre, caméra, vélo électrique — pour le marché algérien.
**Français et arabe** (avec bascule RTL), prix en DA, **aucun paiement en ligne** :
la commande est enregistrée, le propriétaire reçoit un email, la livraison part
via **Yalidine**.

## Contenu

```
plugin-dz/
├── server/     API Node + Express + TypeScript + Prisma + PostgreSQL
└── web/        Vitrine + back-office Next.js 15 + Tailwind v4
```

Tout est fonctionnel : catalogue, packs, panier, commande, back-office, i18n FR/AR.

## Démarrage local

**1. Base de données + API**

```bash
cd server
cp .env.example .env          # ajuster DATABASE_URL, JWT_SECRET, SMTP
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
- **Panier** (localStorage), **commande** (nom, téléphone, wilaya parmi les 58,
  adresse, note), **confirmation** avec référence, **suivi de commande**.

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

### Back-office (`/admin`)
- Connexion JWT, rôles **propriétaire** et **admin**.
- **Tableau de bord** : nouvelles commandes, chiffre confirmé, ruptures (≤ 5).
- **Produits** : création/modification avec déclinaisons multiples, upload
  d'image, promo, activation.
- **Packs** : composition (déclinaison × quantité) avec calcul en direct de la
  valeur au détail et de l'économie client.
- **Commandes** : liste filtrable, détail (adresse, articles), changement de
  statut nouveau → confirmé → expédié → annulé.
- **Marques & types** : création, renommage, suppression.

## Modèle de données

```
Brand → ChargerType → sous-type (texte) → Product → ProductVariant
Pack ──(PackItem)──> ProductVariant
Order ──(OrderItem)──> ProductVariant | Pack
```

- **`pack_items`** : table de jonction — un pack contient N unités d'une ou
  plusieurs déclinaisons, sans jamais modifier le schéma.
- **`order_items.unit_price`** : instantané du prix au moment de la commande.
  Les tarifs changent, l'historique des commandes reste juste.
- **Catégories dérivées** : `variants: { some: { stock: { gt: 0 } } }` — la
  navigation est un filtrage, pas un arbre figé.
- **Stock 0 = invisible** en boutique, toujours visible au back-office.

### Garde-fous côté commande
- Le prix envoyé par le client est **ignoré** : le serveur relit le prix en base.
- Le stock est décrémenté dans la **même transaction** que la création, avec un
  garde `stock >= quantité` qui annule tout en cas de commande concurrente.
- Annuler une commande **remet le stock en rayon** (une seule fois).
- L'échec de l'email ne fait jamais échouer la commande.
- Le suivi de commande exige la référence **et** le téléphone du client.

## Déploiement

**Vitrine → Vercel**
1. Importer le dépôt, régler *Root Directory* sur `plugin-dz/web`.
2. Variables d'environnement : `NEXT_PUBLIC_API_URL`, `API_URL`,
   `NEXT_PUBLIC_SITE_URL` (l'URL finale, ex. `https://plugin.dz`).

**API → Railway / Render / Fly** (Vercel n'héberge pas bien un Express
long-running, et les images uploadées ont besoin d'un disque persistant)
1. Racine `plugin-dz/server`, build `npm run build`, start `npm start`.
2. Variables : `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS` (l'URL Vercel),
   `PUBLIC_API_URL`, les `SMTP_*` et `ORDER_NOTIFICATION_EMAIL`.
3. Au premier déploiement : `npx prisma migrate deploy` puis `npm run seed`.

**Base → Neon / Supabase / Railway** : copier l'URL dans `DATABASE_URL`.

**Emails** : sans `SMTP_HOST`, les notifications sont écrites dans la console —
pratique en développement. En production, renseigner un SMTP (Gmail, Resend,
Brevo) et `ORDER_NOTIFICATION_EMAIL`.

**Images** : stockées dans `server/uploads/` et servies en statique. L'hébergeur
doit fournir un disque persistant ; sinon, coller des URLs Cloudinary dans le
champ image du back-office — aucune migration n'est nécessaire, le champ est
déjà une URL.

## Endpoints

### Publics
`GET /api/health` · `/api/wilayas` · `/api/brands` · `/api/brands/:slug` ·
`/api/charger-types` · `/api/charger-types/:slug` · `/api/products` ·
`/api/products/:slug` · `/api/promos` · `/api/packs` · `/api/packs/:slug` ·
`/api/orders/lookup` — `POST /api/orders`

### Back-office (`Authorization: Bearer <token>`)
`POST /api/auth/login` · `GET /api/auth/me` · `POST /api/auth/password` ·
`GET /api/admin/stats` · CRUD `/api/admin/{brands,charger-types,products,packs}` ·
`GET /api/admin/variants` · `GET|PATCH /api/admin/orders` ·
`/api/admin/admins` (propriétaire) · `POST /api/admin/uploads`

## CI

`.github/workflows/plugin-dz.yml` : à chaque push touchant `plugin-dz/`,
typecheck + build de l'API (avec un Postgres de service et les migrations) et de
la vitrine.

## Décisions prises

1. **Déclinaisons** : couleur / puissance / type de prise. Un produit à prix
   unique se crée avec une seule déclinaison — la fiche n'affiche alors aucun
   sélecteur.
2. **Sous-type** : champ texte nullable sur `products`, comme prévu. Il alimente
   déjà le filtrage et la navigation par marque.
3. **« Pour les détails »** : le champ `description` (texte long).
4. **Comptes admin** : plusieurs comptes, un rôle `owner` (seul à pouvoir créer
   les autres) et des rôles `admin`.
5. **Wilayas** : liste fixe des 58, validée côté serveur.
6. **Images** : upload local avec nom de fichier aléatoire ; le champ reste une
   URL, donc passer à Cloudinary plus tard ne coûte aucune migration.

## Pistes suivantes

- Traduction des données produits (colonnes `name_ar` / `description_ar`).
- Galerie multi-images par produit.
- Export CSV des commandes au format Yalidine.
- Grille de prix dégressive par palier de quantité.
