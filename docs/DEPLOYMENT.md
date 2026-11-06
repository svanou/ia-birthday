# Mise en service du pilote Pixel

## État vérifié

La plateforme fonctionne localement avec D1, R2 et Cloudflare Queues simulés par Wrangler. Le mode local copie le dessin importé, sans génération IA ni paiement réel. Le bandeau et les écrans indiquent cette simulation. Les services réels ne sont pas déclarés vérifiés.

Le site GitHub Pages est une présentation statique du **pilote sur invitation**, avec contact par e-mail. GitHub Pages ne peut pas exécuter le serveur du produit. Le forfait public annoncé est 39 EUR ; aucune vente n’est ouverte.

## Prérequis externes encore manquants

- Compte Cloudflare avec Workers, D1, R2 et Queues disponibles.
- Compte Stripe et clés de **test** pour le pilote.
- Compte Resend, domaine d’envoi possédé et vérifié (SPF/DKIM). Le propriétaire a indiqué ne pas encore posséder de domaine. Une adresse Gmail ne permet pas de configurer l’expéditeur personnalisé Resend.
- Compte API OpenAI, facturation et accès aux modèles `gpt-image-1-mini`, `gpt-4.1-mini` et `omni-moderation-latest`.
- Vérifier tarifs, disponibilité des modèles, conditions de traitement des dessins et accords applicables avant les appels réels. Ne pas remplacer un modèle silencieusement.

Aucune clé ne doit être mise dans Git, dans le navigateur ou dans le chat. Les clés déployées sont des secrets Workers, pas des variables Vite. Les identifiants D1/R2/Queue ne sont pas des secrets.

## Installation reproductible

Node 24, npm et Python avec Playwright/Chromium pour le test navigateur.

```sh
npm ci
npm run db:local
npm run check
# Terminal 1
npm run api
# Terminal 2
npm run dev
# Une fois les deux services disponibles
python platform/tests/browser_smoke.py
```

Dans un environnement avec HOME non inscriptible, préfixer les commandes Wrangler avec `XDG_CONFIG_HOME=/tmp/pixel-config WRANGLER_LOG_PATH=/tmp/pixel-wrangler.log WRANGLER_SEND_METRICS=false`.

Ne pas créer de worktree pour cette installation : utiliser le checkout isolé existant.

## Configuration Cloudflare

Créer les ressources depuis le compte du propriétaire, puis remplacer les identifiants d’exemple dans **env.production** de `wrangler.jsonc` :

```sh
npx wrangler d1 create pixel
npx wrangler r2 bucket create pixel-private
npx wrangler queues create pixel-generations
```

R2 doit rester privé, sans domaine public. Configurer une règle de cycle de vie supprimant le préfixe `originals/` après un jour, en complément du nettoyage applicatif. Vérifier l’exécution horaire du Cron et son fuseau UTC.

Renseigner les variables :

| Variable | Valeur du pilote |
| --- | --- |
| APP_MODE | `pilot` (jamais `local` sur un domaine distant) |
| APP_URL | origine HTTPS réelle du Worker, sans slash final |
| PILOT_EMAILS | adresses invitées séparées par des virgules |
| ADMIN_EMAILS | adresses administrateurs séparées par des virgules |
| EMAIL_FROM | nom et adresse du domaine vérifié |
| SALES_ENABLED | `false` |
| LEGAL_READY | `false` |

Configurer via le coffre de secrets Workers :

- `BETTER_AUTH_SECRET` : secret aléatoire d’au moins 32 octets.
- `RESEND_API_KEY` : envoi d’e-mails sur le domaine vérifié.
- `STRIPE_SECRET_KEY` : clé `sk_test_…` pendant le pilote.
- `STRIPE_WEBHOOK_SECRET` : signature du webhook de ce déploiement.
- `OPENAI_KEY` : clé du compte API OpenAI.

Ne pas copier les valeurs des placeholders d’un proxy cloud dans Workers : les clés du déploiement doivent provenir directement du coffre des fournisseurs.

```sh
npm run check
npx wrangler d1 migrations apply pixel --env production --remote
npx wrangler deploy --env production
```

Le profil production contient volontairement un identifiant D1 invalide tant que le compte n’est pas configuré. Aucun déploiement n’a été exécuté avec des valeurs inventées.

Dans Stripe, créer un endpoint `https://<origine>/api/stripe/webhook` pour `checkout.session.completed`, `checkout.session.async_payment_succeeded` et `charge.refunded`. La confirmation du navigateur ne délivre jamais un forfait : seul le webhook signé, avec montant/devise et commande vérifiés, le fait. Tester les renvois d’événements et les remboursements complets en mode test.

## Validation externe avant invitations

1. Connexion réelle par e-mail (un lien à usage unique, expiration dix minutes) ; un non-invité ne reçoit pas de lien.
2. Achat Stripe test et un seul forfait malgré des webhooks répétés ; aucune clé live dans le pilote.
3. Création OpenAI réelle à partir d’un dessin sans identité ; filtrage d’entrée/sortie, suppression de l’original et affichage après accord du parent.
4. Téléphone et ordinateur sur un réseau extérieur, QR à usage unique, impossibilité de piloter depuis l’écran collectif.
5. Panne IA, coupure navigateur, expiration, téléchargement PDF, nettoyage après rétention. Vérifier la suppression R2 et D1, pas seulement le masquage dans l’interface.
6. Contrôler temps de génération et coûts dans les tableaux de bord fournisseurs ; rapprocher les jobs enregistrés (`model`, état, horodatages) de la facturation. Le coût par fête n’a pas été mesuré avec de vrais appels.
7. Trois fêtes avec des familles sans présence de Sylvain. Relever les blocages, la compréhension du conducteur et les téléchargements de souvenirs.

## Passage à la vente

Compléter identité du vendeur français, adresse, immatriculation, TVA applicable, médiation, CGV, rétractation/exécution immédiate, politique de conservation des comptes/factures et accords liés aux dessins. Le pilote ne constitue pas une validation juridique de ces documents.

Le formulaire d’activation doit alors afficher les accords contractuels réellement retenus et en enregistrer la version. Tant que cette étape n’est pas développée et validée, laisser `SALES_ENABLED=false` et `LEGAL_READY=false` : les drapeaux ne remplacent pas les documents et le recueil des accords.

Configurer ensuite les clés Stripe live et son webhook distinct, `APP_MODE=live`, puis les deux drapeaux uniquement après validation. Confirmer l’offre 39 EUR avec les taxes applicables incluses et vérifier la marge. Le budget d’hébergement visé est inférieur à 50 EUR/mois au lancement ; les limites des fournisseurs et coûts variables doivent être suivis.

## Exploitation

L’espace administrateur permet de rechercher les fêtes, prolonger une session (1 heure par action) ou révoquer l’accès avec un motif audité. Les remboursements s’effectuent dans Stripe ; un remboursement complet révoque le forfait via webhook. Aucun support en direct n’est promis.

Le Cron annule les jobs bloqués après dix minutes (crédit libéré), supprime les originaux sous 24 heures et les souvenirs après 30 jours. Un fournisseur peut avoir facturé une requête interrompue : ne pas la relancer automatiquement. Les sessions sans activation expirent après six mois ; leurs données de préparation sont purgées 30 jours plus tard.

Les suppressions de compte/données sont traitées sur demande vérifiée à l’adresse de support. Supprimer les objets R2 et les lignes liées avant les comptes ; conserver seulement les pièces légalement requises selon la politique à finaliser avant la vente. Ne pas publier les journaux d’e-mails, les liens de connexion, les QR privés ni les dessins.

## Site public existant

Le site statique dans `index.html` + `assets/` reste servi par GitHub Pages. Pour le régénérer après une modification de présentation : démarrer le serveur local et exécuter `python scripts/export_landing.py`. Aucun appel API ni contrôle de simulation ne figure dans cet export. Après validation du déploiement, remplacer les demandes d’invitation par un lien vers l’origine HTTPS de la plateforme ; ne pas inventer l’URL.
