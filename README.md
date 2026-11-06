# Pixel — anniversaire IA animé par les parents

Pilote privé : 39 EUR par fête, jusqu’à dix enfants de 8–12 ans. Préparation et essai avant activation, quatre heures continues, vingt images de fête, trois univers et galerie trente jours.

## Démarrer localement

```sh
npm ci
npm run db:local
npm run check
npm run api  # terminal 1 : serveur Cloudflare local, port 8787
npm run dev  # terminal 2 : interface React, port 5173
```

Les images sont **simulées par copie du dessin** dans le mode local ; aucun paiement réel ni appel IA. Ce mode est refusé par l’API sur un hôte distant.

## Architecture

- `platform/src` : React/Vite, préparation, conducteur, validation, écran collectif, QR, PDF.
- `platform/worker` : API Hono, Better Auth, Stripe, OpenAI, file de génération et rétention.
- `platform/migrations` : D1 ; les fichiers sont privés dans R2.
- `index.html` et `assets/` : présentation publique statique sur GitHub Pages, distincte du serveur.

## Validation

`npm run check` : types, tests des droits d’accès et des réservations SQL, compilation.

`python platform/tests/browser_smoke.py` : avec les serveurs locaux démarrés et Playwright/Chromium, teste le parcours parent, D1/R2/Queue, QR à usage unique, cloisonnement des familles, validation et PDF. Ce test utilise un dessin artificiel et aucun service externe.

## Mise en service

Voir [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) pour la configuration, les secrets requis et les vérifications réelles. Les comptes Cloudflare, Stripe, Resend et OpenAI ne sont pas configurés dans cette session. Le propriétaire n’a pas encore de domaine d’envoi. La plateforme distante et la vente ne sont donc pas actives.

Les trois fêtes pilotes, les coûts IA réels et les documents commerciaux restent à valider avant l’ouverture des ventes. Ne pas confondre un test local réussi avec un paiement ou un e-mail réel vérifié.

Pour créer les services distants avec le workflow préparé : [comptes et configuration de production](docs/PRODUCTION-SETUP.md). `npm run production:plan` affiche les ressources sans requête réseau ni création.
