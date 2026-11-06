# Comptes et mise en service de Pixel

## État réel

Le code et le déploiement automatisé sont préparés. Aucun compte Cloudflare, Stripe, Resend ou OpenAI n’a été créé par l’agent ; aucun service distant n’a encore été provisionné. L’accès Cloudflare n’est pas authentifié. La connexion GitHub intégrée refuse la lecture des secrets/variables et la création des environnements (`403 Resource not accessible by integration`). Les propriétaires peuvent effectuer ces actions directement dans GitHub.

## Actions du propriétaire

1. Créer ou utiliser un compte [Cloudflare](https://dash.cloudflare.com/sign-up), activer Workers et R2, puis choisir son sous-domaine workers.dev. Relever l’Account ID. Créer un token limité à ce compte avec les permissions nécessaires à Workers Scripts, D1, R2 et Queues (édition), ainsi que la lecture du compte. Ne pas utiliser une clé globale. Les fournisseurs peuvent demander d’activer la facturation ; aucune formule payante n’a été souscrite automatiquement.
2. Créer ou utiliser [Stripe](https://dashboard.stripe.com/register). Le pilote utilise une clé de test. Les paiements réels exigent l’activation de l’entreprise, l’identité du vendeur et son compte de versement dans Stripe.
3. Créer un projet API sur [OpenAI](https://platform.openai.com/), activer la facturation API et une limite budgétaire. L’abonnement ChatGPT ne remplace pas cette facturation. Vérifier l’accès aux trois modèles prévus ; les prix et générations réels restent à mesurer.
4. Choisir et enregistrer un domaine à son nom, puis créer un compte [Resend](https://resend.com/signup). Aucun domaine n’a été choisi ou acheté. Le déploiement peut utiliser workers.dev, mais les e-mails aux familles requièrent un domaine d’envoi vérifié. Ne pas utiliser `gmail.com` comme domaine à enregistrer dans Resend.

Les mots de passe, pièces d’identité, coordonnées bancaires et clés privées ne doivent pas être partagés dans la conversation.

## Configuration sécurisée dans GitHub

Dans le dépôt `svanou/ia-birthday`, ouvrir Settings → Environments et créer `pixel-pilot`. Limiter les branches de déploiement à `main`. Créer `pixel-live` séparément seulement pour préparer la future production. Le workflow refuse de s’exécuter depuis une autre branche.

Ajouter dans l’environnement choisi :

| Variables (non secrètes) | Contenu |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Identifiant exact du compte Cloudflare |
| `PIXEL_EMAIL_FROM` | `Pixel <contact@votre-domaine.fr>` |
| `PIXEL_ADMIN_EMAILS` | E-mail du propriétaire, éventuellement plusieurs séparés par virgules |
| `PIXEL_PILOT_EMAILS` | Familles explicitement invitées ; par défaut seuls les admins |

| Secrets | Contenu |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Token limité au compte Cloudflare |
| `STRIPE_SECRET_KEY` | `sk_test_…` pour le pilote, `sk_live_…` uniquement dans pixel-live |
| `RESEND_API_KEY` | Clé permettant de gérer le domaine et d’envoyer les liens |
| `OPENAI_KEY` | Clé du projet API OpenAI |
| `STRIPE_WEBHOOK_SECRET` | Facultatif au premier lancement ; nécessaire pour reprendre un webhook existant dont le secret n’a pas pu être enregistré |

`BETTER_AUTH_SECRET` est généré dans le processus de déploiement et envoyé directement au coffre Worker, sans impression ni fichier. Il est conservé lors des déploiements suivants. Les clés des fournisseurs restent dans GitHub Secrets et Workers, jamais dans le dépôt ni dans un artefact.

Les secrets d’un proxy Codex ne sont pas copiés dans Workers : le workflow lit les vraies clés saisies dans GitHub Secrets par le propriétaire. Le brouillon d’environnement Codex déclare seulement l’accès Cloudflare nécessaire à l’administration directe et les domaines API ; il ne crée pas les comptes et n’active pas les services.

## Déploiement préparé

Depuis l’onglet Actions du dépôt, lancer **Provision and deploy Pixel**, branche `main`, stage `pilot`.

Le workflow :

1. Installe depuis le lockfile, vérifie les types, les tests et le build.
2. Lit le sous-domaine Cloudflare réel puis crée ou réutilise les ressources `pixel-birthday-pilot` : D1, bucket R2 privé et Queue. Les ressources live ont d’autres noms.
3. Préserve les règles R2 existantes et ajoute la suppression du préfixe `originals/` après 24 heures. Une configuration publique ou inconnue provoque un arrêt ; aucun bucket n’est rendu public.
4. Applique les migrations, déploie le Worker/API et les fichiers, et configure le Cron horaire.
5. Crée le domaine Resend s’il n’existe pas. Tant qu’il n’est pas vérifié, affiche les enregistrements DNS publics nécessaires et s’arrête. Ajouter ces enregistrements chez le gestionnaire DNS puis vérifier le domaine dans Resend et relancer le workflow.
6. Vérifie l’accès en lecture aux modèles OpenAI, crée le webhook Stripe signé et enregistre les secrets dans Workers. Les webhooks existants ne sont ni supprimés ni remplacés à l’aveugle.
7. Vérifie l’endpoint de configuration du Worker et confirme que les ventes restent fermées.

Ces scripts sont testés avec des réponses simulées des fournisseurs ; ils n’ont pas été exécutés contre de vrais comptes. Une réponse API différente ou un abonnement manquant provoque un arrêt explicite. Relancer après correction réutilise les ressources déjà créées. Aucun nettoyage destructif n’est automatique en cas d’échec partiel.

Pour consulter le plan sans accès externe : `npm run production:plan`.

Pour provisionner depuis un environnement déjà authentifié : `npm run production:provision -- --stage=pilot`. Les identifiants doivent être injectés au préalable et `PIXEL_EMAIL_FROM` doit désigner le domaine choisi. La configuration générée `wrangler.deploy.json` est ignorée par Git. Le transfert des clés des fournisseurs est réservé au workflow GitHub Actions.

## Avant d’encaisser

Le stage `live` prépare une infrastructure de production, mais **ne lève pas** `SALES_ENABLED=false` et `LEGAL_READY=false`.

Le parcours réel e-mail → achat test → génération → écran collectif → PDF doit réussir. Vérifier également les erreurs, remboursements, renouvellements de liens et suppressions dans les tableaux de bord. La lecture d’un modèle OpenAI ne prouve ni le succès d’une génération ni sa latence.

Les trois fêtes pilotes, le coût par fête, les informations du vendeur et les accords d’exécution immédiate versionnés restent requis selon le plan validé. Voir [DEPLOYMENT.md](DEPLOYMENT.md). Ne pas ouvrir les ventes uniquement parce que le workflow est vert.
