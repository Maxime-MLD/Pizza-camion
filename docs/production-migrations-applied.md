# FORNO — Exécution des migrations Production, 30 octobre 2026

**La transaction SQL a été exécutée une seule fois, puis son commit et ses effets ont été vérifiés dans une nouvelle requête.**

Cible exclusive : `forno-pizza`, référence `fqjkkjvrklpzhwmswlsy`, organisation MLD, région `eu-west-1`, état `ACTIVE_HEALTHY`. L'accord du propriétaire porte sur le seul fichier `supabase/production/01-admin-push.sql`. Aucun autre script de préparation n'a été exécuté.

## Correction du précontrôle

L'erreur précédente provenait du traitement de la réponse de `mcp__codex_apps__supabase_execute_sql`. Format réellement observé : objet MCP, `structuredContent: null`, tableau `content` contenant un unique bloc `text`, texte JSON dont le champ `result` est une chaîne. Cette chaîne contient un avertissement citant une balise, puis un tableau JSON entre deux balises de données sur des lignes dédiées, puis un rappel de sécurité.

L'ancienne expression sélectionnait la balise citée dans l'avertissement. Son extrait commençait par `boundaries`, d'où `SyntaxError: Unexpected token 'b', "boundaries"... is not valid JSON`. Aucune transaction n'avait été lancée lors de cet échec.

Le décodeur corrigé reconnaît uniquement les balises complètes sur des lignes dédiées et exige une paire unique et correspondante, un JSON valide et un tableau de lignes. Il rejette les erreurs d'outil, réponses multipart ambiguës et formes inattendues. Aucun retour non interprétable n'est assimilé à une réussite. Les données retournées ne sont jamais exécutées comme instructions. Le décodeur utilisé pour les précontrôles et les vérifications est conservé dans `scripts/supabase-response.mjs` ; ses 11 tests de régression utilisent uniquement des données synthétiques, sans clé.

## Précontrôles réellement réussis

- Identité et hôte du projet confirmés via `get_project` : `db.fqjkkjvrklpzhwmswlsy.supabase.co`.
- Quatre migrations de base présentes dans `forno_private.manual_migrations`, noms/versions/SHA-256 conformes au manifeste ; six ajouts absents. Deux entrées natives Supabase existantes identifiées et préservées.
- Les dix fichiers d'origine concordent avec leur SHA-256. Les six corps SQL incorporés sont identiques octet pour octet aux sources. Le bundle est identique au fichier relu du commit `c09b4d7`, avec un seul BEGIN et un seul COMMIT. Aucun fichier SQL n'a été modifié ou régénéré pour cette exécution.
- Aucun marqueur Test, objet administrateur/Push non réconcilié ou service synthétique. Les huit tables existantes sont protégées par RLS, sans accès direct navigateur/serveur applicatif. RPC et search_path contrôlés.
- 13 pizzas, 30 services, 440 créneaux ; zéro commande, ligne, utilisateur Auth ou session, et zéro service autorisé à recevoir des commandes.
- Vault et pg_cron présents, pg_net absent. Maintenance en pause, propriétaire postgres, planifiée chaque minute mais sans exécution.
- APIs publiques testées : créneaux GET et commandes POST répondent 503 `ORDERS_DISABLED` avant l'opération.

Empreinte SHA-256 exacte du bundle exécuté :

```text
de7dacc297eff725d24a782e833b9c12e2c636b496671463cc29d389015562fd
```

Empreinte SHA-256 du manifeste vérifié :

```text
4b1dc3115244fa8ab363ac98cf3fd8496d063f720cb5e5858c2e3b5b0ad9f3e2
```

## Exécution et historique

Le texte exact du fichier a été envoyé en un seul appel `execute_sql`, avec son transactionnement BEGIN/COMMIT et ses garde-fous. Aucun contournement, retrait de clause, réessai d'écriture ou exécution séparée des six migrations. Le retour sans erreur contient le résultat de la prise du verrou consultatif ; ce retour seul n'a pas été considéré comme preuve suffisante de commit. Les objets et les dix entrées de suivi ont ensuite été relus dans une requête distincte.

Les six ajouts sont enregistrés dans `forno_private.manual_migrations` avec les empreintes suivantes :

| Migration | SHA-256 vérifié après commit |
|---|---|
| `20261029091206_forno_private_admin.sql` | `d4d718c59a92800b47280e198b6eaa06cc4110648d0ed604141a4b14ca54844f` |
| `20261029092544_harden_admin_settings_concurrency.sql` | `1a346feb51ed830383acc47c819da9eeb5eeed9328d818ef2a3f374a9fe8d1bf` |
| `20261030051016_fix_admin_singleton_update.sql` | `525d6cf3603f08ef992c622fe327183236b3ca31bbc0340335579b3d66cb7e00` |
| `20261030055421_forno_push_outbox.sql` | `b00a4af4ccacb67723b0af0e6948dac0e7fc4639292e5ab1f6e90a34521d643d` |
| `20261030055422_forno_push_dispatch.sql` | `eb83395284765366d8a15e0606c69e07ec453f3cdd3c974a37cecab174cbe92a` |
| `20261030061606_harden_push_platform_integration.sql` | `272b78c5330a0dc304a59c74d05a6e448027a105af22a0c135a187c4fc235ee6` |

Total : dix entrées manuelles, quatre anciennes et six nouvelles. L'historique natif Supabase reste exactement `20261028102507 / forno_reviewed_initial_setup` et `20261028151032 / restrict_rls_auto_enable_execution`, sans réécriture ni doublon. Consulter le suivi manuel avant tout futur `db push` ; la liste native seule ne représente pas le contenu appliqué par ce bundle.

## Contrôles après commit

| Contrôle | État confirmé |
|---|---|
| Nouvelles tables privées | `production_environment`, `admin_users`, `admin_audit`, `push_config`, `push_subscriptions`, `push_events`, `push_deliveries` |
| RLS | Activé sur les 15 tables FORNO vérifiées |
| Accès direct aux tables FORNO | Aucun SELECT/INSERT/UPDATE/DELETE pour anon, authenticated ou service_role |
| RPC publiques FORNO | 11 contrôlées ; aucune exécution navigateur ; service_role autorisé uniquement aux RPC métier, maintenance exclue |
| Fonctions privées | 8 contrôlées ; aucune exécution directe navigateur ou service_role ; search_path vide |
| Politiques permissives | Aucune ajoutée ; accès via les RPC contrôlées |
| Triggers | `order_push_outbox` et `admin_push_revoked` présents et actifs ; Push global désactivé |
| Extension pg_net | Installée dans `extensions`, propriétaire supabase_admin ; aucune branche DROP de déplacement exécutée |
| Jobs | `forno-order-maintenance` et `forno-push-outbox`, chaque minute, propriétaire postgres, **tous deux en pause**, zéro exécution |
| Push | `enabled=false`, aucune URL worker, aucun secret worker ni paire VAPID préparés |
| Données | 13 pizzas, 30 services, 440 créneaux conservés ; zéro commande, compte Auth, administrateur, session, abonnement, événement, livraison ou audit |
| Conservation | TTL pending 15 minutes et rétention 30 jours inchangés ; fonction de maintenance identique |
| APIs publiques | Toujours 503 `ORDERS_DISABLED` après commit ; aucun service ouvert |

Le conseiller de sécurité Supabase retourne uniquement 15 informations « RLS activé sans politique », attendues pour le modèle RPC privé ; aucun WARN ni ERROR. [Explication de ce diagnostic Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Limite plateforme contrôlée : les objets `net` appartiennent à supabase_admin et leurs privilèges PUBLIC de lecture de file restent hérités par anon/authenticated/service_role malgré les REVOKE du rôle postgres. Cette particularité était documentée avant exécution. Elle ne concerne pas les tables FORNO. Une requête réelle à Data API avec une clé **publique** et `Accept-Profile: net` est refusée par HTTP 406 `PGRST106`, `Invalid schema: net` : ce schéma n'est pas exposé. Aucune clé ni aucun contenu de file n'a été affiché. Aucune modification supplémentaire de permissions n'a été tentée.

## Périmètre respecté et suite

Pas de création d'administrateur, pas d'exécution des scripts `02-admin-grant.template.sql` ou `03-push-prepare.sql`, pas de préparation/activation des secrets Push, pas de lancement cron, pas de fusion Git et pas de déploiement Vercel. Le fichier SQL et le manifeste conservent les empreintes approuvées. La correction concerne uniquement le traitement de la réponse de précontrôle, avec les tests et ce rapport.

Cette étape valide l'installation du schéma, pas l'ouverture des commandes ni le circuit de commande Production. Les étapes suivantes restent celles du rapport de préparation, avec leurs accords distincts : identité administrateur, configuration et déploiement fermé, Push propre à Production et recette privée réelle.
