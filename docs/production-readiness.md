# FORNO — Préparation Production, 30 octobre 2026

## Décision actuelle

**Version préparée pour revue, commandes publiques fermées. La mise en service n'est pas validée.**

Cette étape n'applique aucune migration distante, ne crée aucun compte Production, ne fusionne pas `main`, ne déploie pas en Production et n'active ni commandes ni cron. Les opérations distantes de l'audit sont en lecture seule. Aucun secret n'est inclus dans ce rapport ou dans les fichiers livrés.

Sources consultées avant modification : `orders-integration-audit.md`, `orders-preview-validation.md`, `admin-dashboard.md`, `admin-pwa-push.md`. La base validée est `codex/test-commandes`, commit `d5fea5b`. La préparation est isolée dans `codex/production-preparation`. `main` reste à `95a2b587fdd2a4454d6a2096d8f543a67ef55ed8`.

## 1. État réellement observé

| Élément | Production observée | Préparation locale / limite |
|---|---|---|
| Vercel | Projet `pizza`, domaine `pizza-two-bay.vercel.app`, déploiement `dpl_2Vx6t2KCcLZDbE2rkok2TWfUBfDV`, ancien `main` | Astro + adaptateur Vercel ; pas de promotion effectuée |
| Supabase | `forno-pizza`, référence `fqjkkjvrklpzhwmswlsy` | Test séparé conservé, aucune copie de comptes/sessions/commandes/abonnements |
| Catalogue | 13 pizzas | Montagnarde et Norvégienne indisponibles tant que les tarifs ne sont pas confirmés |
| Planning | 30 services, 440 créneaux ; 0 service autorisé à prendre des commandes | Dates du 28 octobre au 1er décembre 2026, planning provisoire, 30 adresses absentes |
| Commandes | 0 commande et 0 ligne de commande | Aucun enregistrement Production créé pendant l'audit |
| Auth / administration | 0 utilisateur Auth, 0 session ; tables administrateur absentes | Création explicite d'un nouveau compte confirmé nécessaire |
| Push | Tables et configuration absentes, aucune Edge Function déployée | Nouvelle identité VAPID et nouveaux abonnements nécessaires |
| Maintenance | `forno-order-maintenance`, chaque minute, propriétaire `postgres`, en pause, 0 exécution | Aucun candidat à expiration ou anonymisation actuellement |
| Cloudflare | Widget « FORNO Commandes », mode Managed ; seul hostname autorisé : `pizza-two-bay.vercel.app`, pre-clearance désactivé | Domaine vérifié dans l'interface connectée, sans modifier le widget ni lire la clé secrète |

Les cinq variables Production attendues sont présentes dans les métadonnées Vercel. Leurs valeurs n'ont pas été déchiffrées. Leur présence ne prouve pas que la paire Turnstile ni la clé Supabase fonctionnent à l'exécution.

Contrôles HTTP réels sur le déploiement actuel : `/` et `/commander/` répondent 200 ; `GET /api/pickup-slots?quantity=1` et `POST /api/orders` répondent 503 `ORDERS_DISABLED` ; une requête de commande d'origine étrangère répond 403. Les nouvelles routes privées décrites ci-dessous ne sont pas encore déployées.

## 2. Écart entre `main` et la branche validée

La branche validée contient le durcissement Turnstile et l'isolation Preview, le dashboard mobile, les sessions privées/CSRF, les transitions transactionnelles de commandes, le planning/capacités, puis la PWA et l'outbox Push. Les 109 tests précédents passent encore. Les confirmations iPhone (réception réelle, commande en arrière-plan, clic, désabonnement/réabonnement) concernent exclusivement Test. Android reste à tester ; ces confirmations ne constituent pas une validation Push Production.

Des verrous initialement limités au Preview bloquaient l'administration et le Push en Production. Ils sont remplacés par deux profils sélectionnés au build. Le profil Production fixe uniquement le vrai projet et l'origine publique ; le profil Preview garde sa branche et sa base dédiées. Un profil Production pointant sur Supabase Test échoue fermé. Les clés Turnstile officielles de test restent interdites en Production.

Le worker Edge est maintenant lié à son propre identifiant de déploiement Supabase, plutôt qu'à une référence Test dans le code. Une URL Supabase incohérente avec `DENO_DEPLOYMENT_ID` est refusée. Le canonical utilise le domaine Vercel actuel. Aucun design public n'est modifié.

Le scan du build Production porte sur **tout** `.vercel/output` : aucune référence au projet Test, à l'alias Preview, au compte Test, aux marqueurs de commandes synthétiques ou à l'ancien domaine Sites. Les fichiers de tests et de documentation peuvent conserver ces références explicites ; ils ne sont pas livrés dans cet artefact.

## 3. Migrations à soumettre à approbation

Production contient déjà les quatre migrations de base réconciliées dans `forno_private.manual_migrations` (commandes, catalogue, maintenance, permissions Data API), ainsi que le correctif plateforme `rls_auto_enable`. Leur réexécution n'est pas prévue. L'historique natif contient `20261028102507` et `20261028151032` ; ses horodatages diffèrent des noms des fichiers locaux. Ne pas lancer aveuglément `supabase db push` et ne pas réparer cet historique sans revue.

Les six ajouts suivants sont validés sur Test et absents de Production :

| Fichier d'origine | Objet |
|---|---|
| `20261029091206_forno_private_admin.sql` | Autorisations explicites, audit, RPC administrateur et sessions |
| `20261029092544_harden_admin_settings_concurrency.sql` | Concurrence et contrôles des réglages |
| `20261030051016_fix_admin_singleton_update.sql` | Compatibilité avec `safeupdate` |
| `20261030055421_forno_push_outbox.sql` | Abonnements privés, outbox transactionnelle, livraisons et permissions |
| `20261030055422_forno_push_dispatch.sql` | Intégration Vault / pg_net et job Push initialement en pause |
| `20261030061606_harden_push_platform_integration.sql` | Durcissement de l'intégration hébergée |

Fichiers préparés, **non exécutés** :

1. `supabase/production/01-admin-push.sql` : bundle atomique des six migrations ; verrou transactionnel, vérification SHA-256 des quatre migrations déjà présentes, refus d'une base marquée Test, d'objets non réconciliés ou de services courants ouverts. Aucun seed de recettes, de planning, d'Auth ou de commandes. Vérifie que Push et son job restent désactivés.
2. `migrations-manifest.json` : liste et empreintes des dix fichiers, régénérables avec `npm run prepare:production`. Aucun fichier de migration historique n'a été modifié.
3. `02-admin-grant.template.sql` : refuse de fonctionner tant que `TODO_NEW_PRODUCTION_AUTH_USER_UUID` n'est pas remplacé après identification explicite d'un **nouveau** compte Auth confirmé en Production. Aucun e-mail, mot de passe ou UUID Test incorporé.
4. `03-push-prepare.sql` : prépare un secret worker aléatoire propre à Production dans Vault et son empreinte, l'URL Production et le sujet VAPID. Ne retourne aucun secret, ne génère pas de VAPID Test et laisse le Push arrêté.
5. `04-verify-readonly.sql` : contrôles agrégés après migration, sans noms, téléphones, endpoints d'abonnement ni secrets. À exécuter après le bundle, pas sur le schéma actuel incomplet.

`pg_net` est absent en Production. Le bundle le crée directement dans `extensions` ; une installation existante dans un autre schéma provoque un arrêt pour revue. Ainsi la branche historique conditionnelle de déplacement avec DROP n'est pas exécutée. Aucun reset ni suppression de table de données n'est prévu. Les migrations sont suivies dans `manual_migrations`, sans réécriture de l'historique interne Supabase.

## 4. Variables et configuration Vercel

| Variable | État Production | Configuration à préparer |
|---|---|---|
| `SUPABASE_URL` | Présente | Doit correspondre exactement au projet Production du profil |
| `SUPABASE_SECRET_KEY` | Présente, non lue | Clé du seul projet Production, exclusivement côté serveur |
| `ORDER_RATE_LIMIT_SALT` | Présente, non lue | Au moins 32 caractères, indépendante de Test |
| `TURNSTILE_SITE_KEY` | Présente | Clé publique du widget réel autorisant le domaine Production |
| `TURNSTILE_SECRET_KEY` | Présente, non lue | Secret du même widget ; jamais préfixé PUBLIC ni envoyé au navigateur |
| `FORNO_TURNSTILE_MODE` | Absente, défaut réel | `real` explicite conseillé ; jamais `official-test` |
| `FORNO_ORDERS_ENABLED` | Absente, défaut fermé | `false` explicite pendant toute la préparation et la recette privée |
| `FORNO_ADMIN_ENABLED` | Absente, défaut fermé | `false`, puis `true` seulement après migrations et attribution explicite |
| `FORNO_VALIDATION_ENABLED` | Nouvelle, défaut fermé | `false`, puis `true` uniquement pendant la recette administrateur privée |
| `FORNO_PUSH_ENABLED` | Absente, défaut fermé | `false`, puis activation distincte après revue SQL/permissions/worker |

`VERCEL_ENV` et `VERCEL_GIT_COMMIT_REF` sont les identités fournies par Vercel. Les champs `FORNO_DEPLOYMENT_PROFILE`, `FORNO_EXPECTED_SUPABASE_REF`, `FORNO_APP_ORIGIN`, `FORNO_PREVIEW_BRANCH` sont liés au build par le module serveur et ne sont pas des variables utilisateur à copier depuis Preview.

Le preset du projet reste Astro, build `npm run build`, adaptateur `@astrojs/vercel` 11.0.16 avec Astro 7.4.2 installé. Ne pas forcer un output statique `dist` qui ignorerait `.vercel/output` et les fonctions. Les pages publiques pré-rendues et les routes API/admin serveur restent présentes. Confirmer la racine du dépôt dans l'interface Vercel avant le premier build de la PR ; le connecteur ne l'a pas retournée dans son résultat exploitable.

La protection Vercel existante est conservée (`all_except_custom_domains`). Ne pas désactiver cette protection pour résoudre un test automatisé. Les variables Preview restent limitées à `codex/test-commandes` et ne doivent pas être copiées en Production ou sur une nouvelle branche de préparation. Aucun déploiement automatique de cette préparation n'est nécessaire pour la revue locale.

## 5. Sécurité Supabase, Auth, PWA et Push

Audit Production actuel : les huit tables FORNO existantes ont RLS activé, aucun SELECT direct pour `anon`, `authenticated` ou `service_role`. Les quatre RPC métier exposées sont exécutables uniquement par le rôle serveur ; la maintenance n'est plus exécutable par ce rôle. Fonctions sensibles SECURITY DEFINER à search_path vide. Aucun avertissement ni erreur de sécurité Supabase ; huit informations « RLS sans politique » sont attendues pour le modèle RPC privé. L'exposition automatique des nouvelles tables désactivée impose de conserver les GRANT explicites.

Après migration, vérifier aussi les nouvelles tables administrateur/Push, l'absence d'EXECUTE navigateur sur toutes les RPC `forno_%`, les contrôles de session active et d'autorisation, ainsi que Vault et `forno_private` non exposés par Data API. Les tests SQL locaux vérifient ces permissions applicatives ; ils ne remplacent pas l'audit des extensions hébergées.

Limite plateforme confirmée sur Test : `pg_net` appartient à `supabase_admin` ; certains REVOKE du rôle `postgres` ne retirent pas effectivement les privilèges PUBLIC de ses objets. Le schéma `net` n'est pas exposé par Data API (PGRST106 constaté sur Test), les rôles navigateur ne disposent pas d'un login SQL. Des opérateurs SQL privilégiés peuvent lire les en-têtes de la file pg_net : ils doivent être considérés comme de confiance. Seul un jeton worker dédié est placé dans cette file, jamais la clé Supabase ou la clé VAPID. Revérifier cet état en Production après installation ; ne pas annoncer que tous les REVOKE plateforme ont réussi.

Administration : créer le compte propriétaire directement dans Supabase Auth Production, e-mail confirmé et mot de passe gardé privé, puis appliquer le modèle de grant après approbation de l'identité. Aucun compte/session Test n'est transféré. Vérifier dans Auth les paramètres d'inscription, confirmation, récupération et protection des mots de passe disponibles au forfait ; aucune option payante ni changement de permissions n'a été activé.

La PWA reste limitée à `/admin/` : manifest, icônes et worker propres ; aucun cache de pages/API privées, sessions, commandes ou coordonnées. Les cookies restent Secure, HttpOnly, SameSite=Lax ; vérification Auth et autorisation active côté serveur ; CSRF avec origine exacte et nonce. Le comportement de déconnexion résiste à une panne Push et retire l'abonnement local.

Pour Push Production, déployer séparément `supabase/functions/forno-push-worker` dans le **projet Production**, avec sa configuration `verify_jwt=false` existante : cela ne supprime pas l'authentification applicative, le worker exige le jeton dédié dont le hash est contrôlé par RPC. Les secrets Supabase serveur sont ceux injectés par la plateforme de ce projet. Le sujet VAPID préparé est `https://pizza-two-bay.vercel.app/` ; la paire VAPID sera générée dans le worker Production et sa clé privée stockée dans Vault. Ne copier ni VAPID ni jeton worker ni abonnement Apple Test.

Après validation du schéma, des permissions et du déploiement Edge, demander une approbation distincte avant `push_config.enabled=true`, l'activation du job `forno-push-outbox` et du flag Vercel. Le worker obtient alors sa propre paire avant abonnement du nouvel appareil Production. Le déclencheur d'outbox reste transactionnel avec la création de commande, les leases/retries et contraintes d'unicité évitent les doubles distributions. La réception effective Apple reste à revalider sur cette nouvelle origine et ce nouveau compte.

Distribution prévue chaque minute via Supabase pg_cron/pg_net, plus réveil transactionnel contrôlé ; aucune tâche Vercel minutely ajoutée. Vérifier les quotas et la consommation Edge partagés de l'organisation avant activation : le quota gratuit annoncé de 500 000 invocations n'est pas une garantie de gratuité pour toute charge. Aucun changement de forfait réalisé.

## 6. Maintenance et conservation à valider

| Donnée / mécanisme | Durée actuellement codée | Conséquence / décision |
|---|---|---|
| Commande pending | 15 minutes | Expiration puis capacité libérée ; vérifié sur Test, aucun run Production |
| Données personnelles de commandes | 30 jours à partir de `created_at` | Anonymisation, pas suppression des lignes commerciales ; s'applique à **tous les statuts**, même une commande encore active |
| Compteurs de débit | Suppression des buckets de plus de 24 heures par maintenance | Pas de nouvelle conservation ajoutée |
| Journaux d'audit administrateur | Aucune purge automatique définie | Durée à décider avant activation commerciale |
| Événements et livraisons Push | Expiration opérationnelle des envois, pas de purge historique générale | Expiration d'un événement ≠ suppression des métadonnées ; durée à décider |
| Abonnement révoqué | Endpoint et clés effacés immédiatement par la procédure | Métadonnées de révocation conservées ; durée à décider |

La fonction `public.forno_maintenance()` est identique entre Test et Production (empreinte MD5 `7ca7619412df51400afd9f53d235037a`). Une exécution cron Test antérieure a réussi ; le job Production reste en pause. La maintenance expire les demandes puis anonymise les coordonnées des anciennes commandes. Aucun changement de TTL, de rétention, de fonction ou de cron n'est effectué ici. Les sauvegardes et journaux externes ont leurs propres règles, à documenter avec les obligations applicables ; ce rapport ne les invente pas.

## 7. Recette privée Production proposée — accord requis avant exécution

Ce protocole utilise de vrais services techniques Production mais n'ouvre jamais le point d'entrée public. Il doit être approuvé avec son créneau et son volume synthétique avant création d'une commande.

1. Appliquer uniquement les migrations approuvées, vérifier permissions, jobs arrêtés et zéro compte/commande importé. Créer et autoriser le nouveau propriétaire. Déployer la version approuvée avec `FORNO_ORDERS_ENABLED=false`, tous les autres flags initialement false.
2. Autoriser l'administration et la recette privée : `FORNO_ADMIN_ENABLED=true`, `FORNO_VALIDATION_ENABLED=true`, mode Turnstile réel. Conserver le flag public false. L'URL `/admin/verification/` exige une session Auth et un administrateur actif ; les POST exigent CSRF. Aucune dérogation pour un simple cookie ou une URL cachée.
3. Dans le diagnostic privé, afficher le véritable widget et obtenir un jeton. Le valider une fois auprès de Siteverify ; renvoyer le même jeton avec un nouvel identifiant d'essai doit échouer. Tester token absent/invalide, expiration après cinq minutes sans validation, renouvellement/reset, hostname/action incorrects dans les contrôles locaux. Le secret reste serveur. Ne pas réutiliser l'identifiant Siteverify pour maquiller une réutilisation de jeton en succès idempotent.
4. Avec accord explicite, autoriser temporairement un unique service daté du jour Europe/Paris et ses créneaux déjà approuvés, sans changer prix ni planning à l'aveugle. Le verrou public reste false ; seul le proxy privé authentifié peut appeler les fonctions habituelles. Si aucun service approprié n'existe ce jour-là, reporter la recette ou faire approuver un service isolé ; ne pas basculer au lendemain.
5. Activer le Push Production après son approbation distincte, abonner l'iPhone sur l'origine Production et envoyer d'abord une notification technique. Passer ensuite le vrai circuit : client privé → Turnstile → prix recalculés → commande pending et lignes Supabase → référence réelle → outbox → notification en arrière-plan → dashboard → acceptée → préparation → prête → remise. Les coordonnées utilisées doivent être explicitement synthétiques ou autorisées ; ne pas publier de données personnelles dans les captures/rapports.
6. Vérifier idempotence, double soumission, créneau complet, mauvaise quantité/date/village/prix, délai de préparation, fin de service, changement de date et deux commandes concurrentes sur la dernière capacité, avec un nombre borné de commandes approuvé. Ne jamais désactiver Turnstile, RLS ou la validation serveur. Les confirmations affichent « En attente de confirmation » tant que le pizzaiolo n'a pas accepté.
7. Faire expirer une demande synthétique via maintenance uniquement après revue de ses conséquences globales (candidats à anonymisation compris). Vérifier capacité et journal d'exécution. Aucune purge de données réelles pour faciliter le test.
8. Pendant et après chaque étape, une session navigateur non administrateur doit recevoir 503 `ORDERS_DISABLED` sur les API publiques ; les routes privées sans session 401/303, avec faux CSRF 403. Relever uniquement références, statuts et comptages. Fermer le service de recette et remettre `FORNO_VALIDATION_ENABLED=false` à la fin. Les commandes synthétiques restent identifiées dans le rapport ; pas de suppression automatique.

Les nouvelles routes privées réutilisent les RPC, les contrôles de créneau/prix/Turnstile, les limites de débit et l'idempotence existants. Leur activation est refusée si le flag public est true, si les clés sont de test ou si le profil/base/origine ne correspondent pas. Les tentatives privées ont un espace de stockage navigateur distinct pour éviter de mélanger leurs identifiants avec le panier public.

Référence Cloudflare : [validation serveur](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/) — jetons valables 300 secondes et à usage unique. Les tests locaux de refus ne prouvent pas que la paire réelle déployée est valide. Ce dernier point reste ouvert jusqu'à la recette autorisée.

## 8. Résultats des vérifications

| Vérification | Résultat | Portée |
|---|---|---|
| Tests checkout / commandes / admin / Push | 14 + 33 + 26 + 36 = 109 réussis | Local, régression des fonctions déjà validées sur Preview |
| Nouveaux tests préparation | 20 réussis | Profils, refus public, proxy privé, CSRF, diagnostic, worker et six scénarios SQL |
| TypeScript / Astro check | 0 erreur, 0 avertissement, 0 hint | 177 fichiers |
| Deno check worker | Réussi | Contrôle strict local, pas un déploiement Edge |
| SQL local PGlite | Réussi, transaction/idempotence/permissions/conservation et garde-fous | Auth, cron et net simulés ; ne valide pas l'extension pg_net ni Vault hébergés |
| Build et routes Vercel Production | Réussis | Artefact local `.vercel/output`, pas déployé |
| Tests de l'artefact compilé | Réussis | Handler réel, dépendances réseau simulées ; cookies, CSRF, routes et fermeture publique |
| Scan ressources Test dans l'artefact Production | Réussi | Fonction serveur et assets statiques |
| HTTP Production actuel | Réussi | Pages 200, commande/créneaux fermés, origine étrangère refusée |
| Audit Supabase Production actuel | Réussi sur schéma existant | Lecture seule, nouveaux objets encore absents |
| Hostname / mode Cloudflare réel | Confirmés | Interface connectée en lecture seule |
| Jeton réel Production, réutilisation, expiration | **Non exécutés** | Version privée non déployée, aucun administrateur Production |
| Push et circuit complet Production | **Non exécutés** | Migrations, compte, worker, VAPID et autorisations en attente |
| Android / hors ligne matériel | **Non validés** | Téléphone non disponible lors de la recette précédente |
| `npm run check:todo` | **Échec : 240 correspondances brutes** | Ne pas confondre matches et nombre de contenus manquants ; le contrôle inclut aussi des noms de constantes/exemples |

Le contrôle TODO reste actif. Parmi les vrais éléments à finaliser : coordonnées et mentions légales de l'entreprise, informations de confidentialité et de conservation, planning/adresses réels, deux tarifs, photographie À propos temporaire. Des marqueurs du starter expliquent aussi des correspondances. Aucun contenu n'a été inventé pour rendre ce contrôle vert. `validate:production` n'est donc pas annoncé comme réussi.

## 9. Déploiement, décisions et retour arrière

Ordre proposé, chaque action distante restant soumise à l'accord demandé par le propriétaire :

1. Relire cette préparation et la comparaison avec `main`. Décider les coordonnées légales, tarifs/planning, rétention et volume de recette. Valider les quotas et la politique Auth sans action payante implicite.
2. Approuver le bundle SQL six migrations, contrôler son manifeste puis exécuter sur le seul projet Production. Auditer immédiatement permissions/RLS/extension et jobs en pause. Approuver séparément l'identité Auth et le grant.
3. Après accord explicite de fusion/déploiement, intégrer la branche validée et cette préparation dans `main`, déployer avec les commandes publiques fermées. Enregistrer le commit et l'ID du déploiement. Conserver l'ancien déploiement pour retour arrière. Ne pas promouvoir le Preview Test.
4. Autoriser et exécuter la recette privée ci-dessus, puis décider séparément l'activation Push, la maintenance et, **en dernier**, l'ouverture publique. Un test complet réel doit réussir avant toute déclaration de disponibilité commerciale.

Retour arrière : garder/remettre `FORNO_ORDERS_ENABLED=false`, désactiver le validateur privé et fermer les services concernés ; arrêter les jobs Push/maintenance si nécessaire, sans effacer commandes ni abonnements ni secrets. Redéployer/rollback vers `95a2b58` / `dpl_2Vx6t2KCcLZDbE2rkok2TWfUBfDV` après accord. Les migrations sont additives et les endpoints de commandes initiaux restent compatibles ; conserver le schéma et les données pour diagnostic plutôt qu'un down/reset. Ne pas faire tourner automatiquement les secrets VAPID, ce qui invaliderait les abonnements. Contrôler à nouveau pages 200, API publiques fermées, absence de fuite PII, compteurs et statuts conservés.

**Aucune ouverture publique ni activation de cron n'est autorisée par la seule livraison de ce rapport.**
