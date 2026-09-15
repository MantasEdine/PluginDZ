# Tests de bout en bout

Rejoue le parcours complet d'un acheteur (catalogue → fiche produit → panier →
commande → suivi), en français et en arabe, sur desktop et sur un écran de 320 px,
puis vérifie l'intégrité de l'API (prix et statut non falsifiables, stock, accès admin).

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

Le script sort en code 1 si une vérification échoue : utilisable tel quel en CI.
