# Tests de bout en bout

Rejoue le parcours complet d'un acheteur (catalogue → fiche produit → panier →
commande → suivi), en français et en arabe, sur desktop et sur un écran de 320 px,
puis vérifie l'intégrité de l'API (prix et statut non falsifiables, stock, accès admin).

Couvre également les points de contact (bouton WhatsApp, réseaux sociaux, données
structurées), les liens publicitaires menant directement au panier, et — si un
compte du back-office est fourni — le cycle de vie « livrée / retournée » d'un
colis : remise en stock au retour, effet sur l'encaissé, et absence de gonflage
du stock quand on bascule d'un statut à l'autre.

> ⚠️ À lancer contre une pile **locale**. Le test crée de vraies commandes et
> décrémente le stock : ne jamais le pointer vers la production.

## Lancer

```bash
# 1. base de données + jeu de données
cd server && npm run seed

# 2. les deux serveurs, dans deux terminaux
cd server && npm run dev     # API  sur :4000
cd web    && npm run dev     # site sur :3000

# 3. les tests
cd e2e
npm install
npx playwright install chromium   # une seule fois
npm test
```

## Variables

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `WEB_URL` | `http://localhost:3000` | adresse du site |
| `API_URL` | `http://localhost:4000` | adresse de l'API |
| `CHROME_PATH` | — | binaire Chromium déjà installé (optionnel) |
| `ADMIN_EMAIL` | — | compte du back-office ; active la section « Livraison et retour » |
| `ADMIN_PASSWORD` | — | mot de passe de ce compte |

Sans `ADMIN_EMAIL` / `ADMIN_PASSWORD`, la section « Livraison et retour » est
signalée comme ignorée : la suite reste verte, mais huit vérifications ne sont
pas jouées. Utiliser un compte **local**, jamais celui de la production.

Le script sort en code 1 si une vérification échoue : utilisable tel quel en CI.
