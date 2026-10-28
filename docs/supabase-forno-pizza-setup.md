# Configuration Supabase de forno-pizza — état du 28 octobre 2026

## Ce qui a réellement été vérifié

Le plugin Supabase est installé et activé, mais aucun outil Supabase n’est exposé dans cette session Codex. L’endpoint MCP répond HTTP 401 sans authentification, ce qui confirme sa disponibilité réseau, pas un accès au compte. Aucun projet n’a été créé, listé ou modifié ; l’identifiant réel de **forno-pizza**, sa région, sa version serveur, ses tables, ses données et son historique distant restent **non vérifiés**. Aucun identifiant ni aucune clé n’a été déduit du nom du projet.

Le dossier local possède trois migrations d’origine, conservées sans changement. Une quatrième migration a été créée avec Supabase CLI 2.122.0 (`migration new`), puis préparée localement. Aucun `db push`, reset, création de commande ou autre écriture distante n’a été exécuté. Les contrôles de configuration Sites ont confirmé une liste de variables runtime vide (révision 0) ; aucune valeur secrète n’a été affichée ou enregistrée dans ce rapport.

Les paramètres Data API activée / Automatically expose new tables désactivé / Automatic RLS activé sont ceux indiqués par l’utilisateur ; ils n’ont pas pu être inspectés sur le projet distant. Le SQL ci-dessous est conçu pour ces paramètres.

## Résultat de l’audit local

- Cinq tables métier : `pizzas`, `services`, `pickup_slots`, `orders`, `order_items`. Deux tables internes : `forno_private.settings`, `request_limits`. Un registre privé `manual_migrations` est ajouté uniquement par le lot SQL Editor.
- UUID des commandes, références uniques, prix entiers en centimes, snapshots des lignes, contraintes CHECK, créneaux liés au bon service par FK composée, suppression des produits/services/créneaux utilisés interdite, cascade des lignes uniquement si une commande est explicitement supprimée. Le lot n’effectue aucune suppression de commande, table ou donnée existante.
- RLS activée explicitement sur toutes les tables ; aucune politique donnant accès aux clients. Les droits de `anon` et `authenticated` sont retirés même si les paramètres par défaut du projet accordent des privilèges résiduels.
- La migration complémentaire retire aussi l’accès direct aux tables et au schéma privé à `service_role`. Elle accorde explicitement `USAGE` sur `public` et `EXECUTE` uniquement sur les quatre RPC utilisées par l’application : rate_limit, pickup_slots, create_order, recover_order. La maintenance reste réservée au propriétaire SQL / cron ; la clé de l’application ne peut pas l’exécuter.
- Les RPC sont `SECURITY DEFINER`, avec search_path vide et objets qualifiés. Leur propriétaire doit être un rôle de migration de confiance (normalement `postgres`). Ce mode est nécessaire ici pour une API serveur étroite sans droit de table accordé au rôle applicatif. Aucun droit de connexion administrateur ou de modification de schéma n’est ajouté au rôle applicatif. Aucun accès client par `authenticated` global n’est ajouté.
- Les prix proviennent exclusivement de PostgreSQL. La capacité en pizzas et l’insertion sont vérifiées dans la même transaction, avec verrou d’idempotence, du service puis du créneau. La date réelle est celle de PostgreSQL en Europe/Paris, jamais celle fournie par le navigateur. Un rejeu d’une demande déjà enregistrée restitue son reçu sans créer de nouvelle commande ; un nouveau service d’un autre jour est rejeté.
- La migration complémentaire ajoute les index de FK manquants (`orders.service_id`, `order_items.pizza_id`), refuse les champs obligatoires NULL directement dans les RPC et verrouille le reçu lors d’une récupération / d’un rejeu expiré. Une acceptation concurrente ne doit pas être écrasée à partir d’un ancien état lu sans verrou.
- L’expiration des pending libère la capacité à son échéance, même lorsque le cron est arrêté. Le cron peut annuler les pending et anonymiser les coordonnées après la durée définie. **Le lot préparé laisse ce job inactif** pour ne pas purger de données avant validation de la durée et du fonctionnement réel. L’activer demandera une décision distincte.

RLS ne remplace pas les GRANT. Avec l’exposition automatique désactivée, il ne faut pas « réparer » l’accès en donnant SELECT sur les commandes à anon/authenticated : le navigateur appelle les routes Astro ; seul le serveur appelle les RPC. Conserver `public` dans les schémas exposés de la Data API pour ces RPC et **ne pas exposer `forno_private`**. Les paramètres globaux / privilèges par défaut des autres objets du projet ne sont pas modifiés.

## Opérations préparées, à approuver avant application distante

1. Lire `supabase/setup/01-preflight-readonly.sql` dans le SQL Editor du projet **forno-pizza**. Vérifier aussi manuellement le nom du projet et son URL réelle dans le Dashboard : le nom de base `postgres` ne permet pas d’identifier le projet. Ce fichier examine tables, contraintes, index, ACL, RLS, fonctions, extensions, historique de migrations et job FORNO, sans lire de coordonnées client.
2. Examiner les résultats et confirmer le lot prévu. Sur une base vierge : création des cinq tables métier et tables privées, des fonctions, insertion des 13 pizzas, préparation du job puis pause de ce job, durcissement des permissions et deux index. Sur une base existante dont l’historique est reconnu : seules les migrations absentes sont exécutées. Aucun service n’est activé et aucune commande n’est créée.
3. Après accord, exécuter **tout** `supabase/setup/02-apply-reviewed.sql`. La transaction unique évite une fenêtre d’exposition entre CREATE et REVOKE. Un verrou de préparation empêche deux installations simultanées. Le lot consulte l’historique officiel Supabase s’il existe, ainsi que son registre privé. Les versions déjà enregistrées sont ignorées et les checksums locaux sont vérifiés.
4. Si `FORNO_BASELINE_UNTRACKED` ou `FORNO_HISTORY_SCHEMA_MISMATCH` apparaît, **arrêter** : des objets existants ne correspondent pas à un historique vérifiable. Ne pas supprimer les tables, ne pas marquer arbitrairement une migration comme appliquée et ne pas répéter la migration initiale. Comparer le schéma avec les fichiers et réconcilier l’historique après examen. Tout le lot est annulé en cas d’erreur.
5. Exécuter `supabase/setup/03-verify-readonly.sql`. Il doit trouver les 13 pizzas identiques au catalogue, les deux tarifs provisoires non commandables, toutes les protections RLS/ACL et aucun service avec commandes activées. Une divergence de catalogue est signalée et n’est pas écrasée.
6. Après contrôle de la période, exécuter séparément `supabase/setup/04-provisional-services.sql` : période préparée **28 octobre → 1er décembre 2026**, 30 services et 440 créneaux sur une base vierge, adresses NULL, `status=scheduled`, `orders_enabled=false`. Les exceptions datées et lignes existantes sont conservées. Le dimanche reste fermé. Relancer le script est idempotent. En présence de services existants personnalisés, les comptes peuvent différer légitimement et doivent être examinés.
7. Réexécuter la vérification en lecture seule. Aucun outil de cette session n’a exécuté les étapes distantes ci-dessus.

Le registre SQL Editor ne réécrit pas les tables internes `supabase_migrations`. Avant un futur déploiement par CLI, comparer les deux historiques et les fichiers puis effectuer une réconciliation explicite avec les outils de la version CLI utilisée. Ne pas lancer aveuglément `db push` après une installation SQL Editor.

Les trois migrations d’origine ne sont pas individuellement réexécutables. **Utiliser le lot complet avec suivi**, pas un collage répété de `001`. La migration catalogue utilise ON CONFLICT DO NOTHING : elle n’écrase ni prix ni description existante. Le job de la migration 003 et sa pause de la migration suivante deviennent visibles ensemble au COMMIT du lot initial ; aucune purge ne peut démarrer entre les deux sur une installation neuve.

Pour régénérer les fichiers préparés :

```sh
node scripts/prepare-supabase-setup.mjs
node scripts/prepare-order-data.mjs services 2026-10-28 35 > supabase/setup/04-provisional-services.sql
```

Adapter la date à la période réellement souhaitée, après contrôle du planning central. Ces commandes génèrent du SQL localement et ne se connectent pas à Supabase.

## Catalogue et planning

Les noms, ingrédients et prix sont repris de `src/data/pizzas.ts` : 13 IDs stables, tarifs de 1000 à 1300 centimes. Montagnarde (1200) et Norvégienne (1300) conservent leurs tarifs provisoires, avec `available=false` jusqu’à validation sur la carte d’origine. Les autres recettes restent disponibles au niveau catalogue, mais aucun service généré n’autorise une commande.

Le planning central reste : lundi Le Coteau, mardi Vougy, mercredi Mably, jeudi Renaison, vendredi Riorges, samedi Charlieu, dimanche fermé. Les horaires existants sont conservés ; les adresses TODO deviennent NULL. Les services datés Supabase sont l’autorité pour les commandes ; le planning hebdomadaire est uniquement le modèle. Une exception datée existante n’est jamais remplacée par le générateur.

## Variables runtime de l’hébergement Sites

Les cinq variables suivantes sont actuellement absentes de Sites. Les déclarations `.env.example` sont des marqueurs TODO, pas des identifiants réels.

| Variable | Valeur à récupérer / créer | Configuration |
| --- | --- | --- |
| `SUPABASE_URL` | URL exacte du projet forno-pizza, dialogue Connect / paramètres Data API | Variable runtime Sites côté serveur |
| `SUPABASE_SECRET_KEY` | Secret key dans les API Keys du vrai projet ; jamais la publishable/anon key | Secret runtime Sites |
| `ORDER_RATE_LIMIT_SALT` | Valeur aléatoire d’au moins 32 caractères, indépendante de Supabase | Secret runtime Sites |
| `TURNSTILE_SECRET_KEY` | Clé secrète du widget Cloudflare Turnstile | Secret runtime Sites |
| `TURNSTILE_SITE_KEY` | Clé publique du même widget, autorisé pour le domaine réel FORNO | Variable runtime Sites ; seule cette clé de widget est rendue au navigateur |

Le stockage dans les secrets des Edge Functions Supabase ne configure **pas** l’hébergement Sites. Ne pas placer ces valeurs dans `.openai/hosting.json`, le code source ou une variable PUBLIC_. Ne pas coller les clés dans le chat ou les logs. Le développement local Cloudflare utilise `.dev.vars` ignoré par Git. L’ancienne variable optionnelle `PUBLIC_WEB3FORMS_ACCESS_KEY` concerne seulement le formulaire de contact et n’est pas requise pour commander.

L’ajout des secrets et un redéploiement restent à faire après identification du vrai projet. Aucune clé n’a été créée, copiée ou modifiée dans cette étape.

## Avant les commandes réelles

Le système reste **non opérationnel** tant que les opérations suivantes ne sont pas validées : connexion au bon Supabase, application et vérification distantes des migrations, tarifs/planning/adresses, capacité et préparation, secrets Sites, vrai widget Turnstile, tests d’intégration réels et politique de confidentialité complétée.

Le fichier `supabase/setup/05-enable-maintenance-after-approval.sql` est séparé et non exécuté : il active le job existant sans le recréer ni supprimer son historique. Il faut d’abord approuver la durée de conservation, tester le cron et la purge sur des données synthétiques dans un environnement de test. Puis vérifier les exécutions via `cron.job_run_details`. Aucun service ne doit être activé avant cela. L’activation des commandes devra être explicite, limitée à un service daté validé (`status=open`, `orders_enabled=true`) ; aucun fichier de préparation ne la réalise.

Le protocole de concurrence réelle à deux connexions et de tests anonymes HTTP est dans `supabase/tests/concurrency.md`. Le futur administrateur devra suivre le même ordre de verrous et gérer explicitement acceptation, refus et expiration. Aucun tableau de bord n’a été développé et le design du site n’a pas été modifié.

## Tests locaux et limites

`npm run test:orders` exécute le SQL dans PostgreSQL PGlite isolé, teste l’installation fraîche et ses rejouements, l’historique officiel partiel, le refus d’une base non suivie, les checksums, les 13 pizzas, les 30 services / 440 créneaux, les ACL/RLS et la compatibilité RPC sans accès direct aux tables. Les rôles anon/authenticated/service_role sont simulés localement. La validation Zod, les prix, la capacité, l’idempotence, l’expiration et la purge existantes restent couvertes.

PGlite ne fournit pas pg_cron : un stub **de test seulement** vérifie la configuration inactive, sans planificateur réel. Ses appels sont sérialisés sur une seule connexion ; les tests de verrous entre deux connexions et les règles anonymes via le vrai Data API ne sont donc pas présentés comme exécutés. Les tests existants du tunnel, TypeScript et le build doivent également passer.

Sources : [Data API : grants et RLS](https://supabase.com/docs/guides/api/securing-your-api), [privilèges des fonctions](https://supabase.com/docs/guides/database/functions), [gestion du Cron](https://supabase.com/docs/guides/cron/quickstart), [connexion MCP Supabase](https://supabase.com/docs/guides/getting-started/mcp). Le changelog actuel a été consulté ; la suppression annoncée de vieux chiffrements TLS ne nécessite pas de modification du transport fetch moderne de ce projet.
