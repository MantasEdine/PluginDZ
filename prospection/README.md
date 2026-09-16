# Prospection — trouver les boutiques, les contacter une par une

Deux programmes qui parlent à la boutique par son API, sans rien partager
d'autre :

```
prospection/
├── api/         Go   — le service : prospects, suivi commercial, message WhatsApp
└── collector/   Python — le collecteur : Google Places → boutiques par wilaya
```

```
Google Places ──(collecteur, Python)──▶ service (Go) ◀──(jeton admin)── back-office /admin/prospection
                                            │
                                            └──(GET /api/packs)──▶ API boutique   (packs et prix, en direct)
```

**Ce que ça fait.** Le collecteur demande à Google « magasin accessoires
téléphone *Oran* » (et deux autres formulations, dont une en arabe) pour
chacune des 69 wilayas, nettoie les numéros, et envoie les fiches au service.
Le back-office les affiche avec deux boutons : **WhatsApp** ouvre la
conversation avec un message en arabe déjà écrit — qui cite vos packs et prix
du moment — et **Appeler** compose le numéro.

**Ce que ça ne fait pas, volontairement.** Aucun message n'est envoyé par le
programme. Le gérant clique, relit, envoie — un prospect à la fois. C'est la
règle de WhatsApp, et la seule façon de ne pas se faire bloquer. Le collecteur
ne touche ni Facebook, ni Instagram, ni les sites d'annonces : leurs conditions
l'interdisent et ces sources se ferment en quelques jours. Google Places est
une API officielle : elle ne disparaîtra pas.

## Le message envoyé

Il est composé par le service (`api/internal/message/message.go`), en arabe,
avec le nom de la boutique, les trois promesses du site, jusqu'à cinq packs
**au prix de la pièce** (prix du pack ÷ quantité, chiffres collés — « 1600 دج
للقطعة »), une note « vente par packs de 5, 10 pièces ou plus », et le lien du
catalogue marqué
`utm_source=whatsapp&utm_campaign=prospection` — les commandes qui en viennent
apparaissent dans **Audience → Performance des campagnes**.

Pour le relire tel qu'il partira : dans le back-office, sur un prospect,
« Voir le message ». Pour changer une phrase : modifier `Build` dans
`message.go`, puis `go test ./...` — les tests vérifient que rien d'essentiel
n'a disparu.

## Démarrage local

**1. Le service** (a besoin de Postgres et de l'API boutique sur :4000)

```bash
cd prospection/api
createdb prospection                    # une base propre au service
DATABASE_URL=postgresql://postgres@localhost:5432/prospection \
JWT_SECRET=<le même que server/.env> \
COLLECTOR_TOKEN=dev-collector-token \
go run ./cmd/api                        # http://localhost:8080
```

Les migrations sont dans le binaire et s'appliquent au démarrage. En
développement, `JWT_SECRET` et `COLLECTOR_TOKEN` ont des valeurs par défaut
alignées sur l'API boutique ; en production ils sont obligatoires.

**2. Le collecteur**

```bash
cd prospection/collector
pip install .                           # ou : pip install requests phonenumbers
PLACES_API_KEY=… PROSPECTION_API_URL=http://localhost:8080 COLLECTOR_TOKEN=dev-collector-token \
plugin-collect run --wilayas Alger Oran # deux wilayas pour commencer
```

Sans clé Google, pour voir l'interface avec des données d'exemple :

```bash
PROSPECTION_API_URL=http://localhost:8080 COLLECTOR_TOKEN=dev-collector-token \
plugin-collect run --wilayas Alger --fixture tests/fixtures/places_page.json
```

**3. Le back-office** : `NEXT_PUBLIC_PROSPECTION_URL=http://localhost:8080`
dans `web/.env.local`, puis http://localhost:3000/admin/prospection — avec la
connexion habituelle. Le service vérifie le jeton de la boutique tel quel : un
seul compte pour les deux.

## La clé Google

1. https://console.cloud.google.com → créer un projet (ou en choisir un).
2. **APIs & Services → Library** → activer **Places API (New)**.
3. **APIs & Services → Credentials → Create credentials → API key**. Restreindre
   la clé à l'API Places (New) — une clé sans restriction qui fuit coûte cher.
4. La clé va dans `PLACES_API_KEY` (jamais dans le dépôt).

**Coût — et comment le plafonner.** Chaque page de résultats est un appel
facturé. Le collecteur demande le numéro de téléphone, le site et la note :
ces champs placent l'appel dans le palier *Text Search Enterprise*, dont Google
offre **1 000 appels par mois** (tarif en vigueur sur la page *Places API (New)
pricing*). Un passage complet — 3 formulations × 69 wilayas × jusqu'à 3 pages —
fait au plus ~620 appels : **un passage par mois reste gratuit**, c'est le
rythme du workflow. Trois garde-fous, du plus sûr au plus indicatif :

1. **Le plafond du collecteur, dans le code** : `--max-calls`, **700 par
   passage** par défaut. Le client compte chaque page demandée et refuse la
   suivante une fois le plafond atteint ; ce qui a déjà été collecté est
   conservé et envoyé. Une boucle, un bug, une relance de trop : impossible
   de dépasser. C'est le seul garde-fou qui ne dépend pas de Google.
2. **Quota Google** (s'il est modifiable — un compte en période d'essai ne
   peut pas le baisser, l'option est grisée) :
   https://console.cloud.google.com/apis/api/places.googleapis.com/quotas →
   *SearchTextRequest per day* → 700.
3. **Alerte de budget** (prévient, ne bloque pas) :
   https://console.cloud.google.com/billing/budgets → budget de 5 $ avec
   alertes à 50 % et 100 %.

Pendant l'essai gratuit (crédit offert), rien n'est débité tant que le compte
n'est pas passé manuellement en compte payant — ne pas cliquer « Activer le
compte complet ». Commencer par deux wilayas.

## Ce que le service garantit

- **Pas de doublon.** Une même fiche Google (même `place_id`) ou un même numéro
  ne donne qu'un prospect, même si le collecteur repasse chaque mois.
- **Le suivi ne s'efface jamais.** Une nouvelle collecte met à jour le nom,
  l'adresse, la note Google ; elle ne touche ni au statut, ni à la note du
  gérant, ni à la date de premier contact.
- **Fixe ≠ mobile.** Un fixe (021…) a le bouton *Appeler*, pas *WhatsApp*.
- **« Ne pas contacter » retire les deux boutons.** C'est une demande de la
  personne, pas une réponse commerciale (ça, c'est « pas intéressé »).
- **Même jeton, mêmes règles.** HS256, même secret : un jeton forgé avec un
  autre algorithme est refusé. Le collecteur, lui, a son propre jeton, valable
  seulement sur la route d'ingestion, comparé à temps constant.

## Statuts

```
nouveau → contacte → interesse → client
                   └→ pas_interesse        (réponse : on peut relancer plus tard)
nouveau → ne_pas_contacter                 (demande : boutons retirés)
```

## API du service

Réponses `{ "data": … }` en succès, `{ "error": "…" }` sinon.

| Route | Auth | Rôle |
|---|---|---|
| `GET /health` | — | vivant ? |
| `POST /internal/leads` | `X-Collector-Token` | ingestion par lots (≤ 500) : `{ "leads": [ … ] }` |
| `GET /leads?wilaya&status&q&page&perPage` | jeton admin | liste paginée |
| `GET /leads/{id}` | jeton admin | un prospect |
| `PATCH /leads/{id}` | jeton admin | `{ "status"?, "note"? }` |
| `DELETE /leads/nouveaux` | jeton admin | supprime les prospects encore « nouveau » (jamais contactés, sans note) : `{ "deleted": n }` |
| `GET /leads/{id}/contact` | jeton admin | message, `whatsappUrl`, `telUrl`, `contactable` |
| `GET /stats` | jeton admin | totaux par statut et par wilaya |
| `GET /wilayas` | jeton admin | wilayas ayant au moins un prospect |

## Variables d'environnement

**Service (`api/`)**

| Variable | Obligatoire | Rôle |
|---|---|---|
| `DATABASE_URL` | oui | Postgres du service (URL libpq / pgx) |
| `JWT_SECRET` | en prod | **le même** que l'API boutique |
| `COLLECTOR_TOKEN` | en prod | secret partagé avec le collecteur |
| `SHOP_API_URL` | non (`http://localhost:4000`) | API boutique publique, pour les packs |
| `SITE_URL` | non (`https://plugin-dz.com`) | lien mis dans le message |
| `CORS_ORIGINS` | non (`http://localhost:3000`) | origines du back-office, séparées par des virgules |
| `MESSAGE_MAX_PACKS` | non (5) | packs cités au plus |
| `APP_ENV` | non | `production` rend les secrets obligatoires |
| `PORT` | non (8080) | port HTTP |

**Collecteur (`collector/`)**

| Variable | Rôle |
|---|---|
| `PLACES_API_KEY` | clé Google (Places API New) |
| `PROSPECTION_API_URL` | URL du service |
| `COLLECTOR_TOKEN` | le même que côté service |

**Back-office (`web/`)** : `NEXT_PUBLIC_PROSPECTION_URL` — URL publique du service.

## Déploiement

**Service → Railway** (ou tout hébergeur de conteneurs)
1. Nouveau service depuis le dépôt, *Root Directory* `prospection/api` — le
   `Dockerfile` fait le reste (binaire statique, image minimale).
2. Une base Postgres dédiée (Railway en crée une en un clic) → `DATABASE_URL`.
3. `JWT_SECRET` = celui de l'API boutique ; `COLLECTOR_TOKEN` = une longue
   chaîne aléatoire ; `SHOP_API_URL` = l'URL publique de l'API boutique ;
   `CORS_ORIGINS` = `https://plugin-dz.com` ; `APP_ENV=production`.
4. Sur Vercel : `NEXT_PUBLIC_PROSPECTION_URL` = l'URL publique du service, puis
   redéployer.

**Collecteur → GitHub Actions** (gratuit, sans serveur)
Le workflow `.github/workflows/prospection-collect.yml` tourne le 1er de
chaque mois et à la demande (onglet *Actions*, avec un choix de wilayas). Il lui faut
trois secrets de dépôt : `PLACES_API_KEY`, `PROSPECTION_API_URL`,
`COLLECTOR_TOKEN`. Tant qu'ils manquent, il s'arrête proprement au lieu
d'échouer. Le `Dockerfile` du collecteur sert si l'on préfère un cron Railway.

## Tests

```bash
cd prospection/api && go test ./...          # 31 tests ; + Postgres si PROSPECTION_TEST_DATABASE_URL est défini
cd prospection/collector && python3 -m pytest   # 58 tests, sans réseau ni base
```

Les scénarios du stockage s'exécutent sur l'implémentation mémoire **et** sur
Postgres : ce que les tests HTTP vérifient sur l'une est vrai de l'autre. La CI
lance les deux à chaque push.

## Ce qui n'est pas (encore) là

- **Envoi automatique** : non, et ce n'est pas un manque — voir plus haut.
- **Autres sources** : seulement Google Places. D'autres annuaires officiels
  pourraient s'ajouter derrière la même interface `place_to_lead`.
- **Relances planifiées** : la note et la date de contact sont là ; un rappel
  « à relancer dans 7 jours » serait le pas suivant naturel.
