# FORNO. Admin — PWA et Web Push

Étape 13, 30 octobre 2026. Branche `codex/test-commandes`, Supabase Test `brzcvncsycdpsrvulqss`. Aucune migration ni ouverture de commandes en Production.

## Architecture et confidentialité

Manifest distinct `/admin/manifest.webmanifest`, id/scope/start_url `/admin/`, display standalone. Le manifest public `/manifest.webmanifest` est inchangé. Installer depuis le dashboard, pas depuis l’accueil public. Icônes PNG 192/512, maskable 512 et Apple Touch 180 générées avec Sharp depuis les tokens existants, sans nouveau package de production. Safe areas et navigation basse conservées.

Service Worker `/admin/sw.js`, scope `/admin/`. Cache autorisé uniquement : guide statique `/admin/offline/` vérifié par marqueur, ses CSS et icônes. Navigations privées réseau uniquement ; échec réseau → guide, jamais un ancien tableau de commandes. APIs/Auth non interceptées, aucun token ni commande dans CacheStorage/IndexedDB/localStorage. Une page de protection Vercel ne passe pas la vérification du guide. La mise à jour d’un worker existant attend un clic explicite ; pas de rechargement pendant une saisie.

Abonnement depuis un geste explicite, derrière session admin vérifiée + CSRF existant. Endpoints et clés restent dans le schéma privé avec RLS et sans permissions browser/service_role directes. RPC `forno_push_admin` service_role uniquement, identité/session vérifiées en base, appareils limités au propriétaire, maximum 10 actifs ; test limité à 1/min/appareil. Cookie appareil opaque, Secure HttpOnly SameSite=Lax. Une panne Push ne bloque jamais la déconnexion Auth : signal HttpOnly ponctuel pour désabonner le navigateur, avertissement de vérification si le retrait serveur n’est pas confirmé. Trois tests couvrent succès, panne Push et jeton Auth expiré. Retrait, déconnexion et révocation admin effacent immédiatement endpoint/clés et annulent les envois en attente. Une livraison déjà acceptée par Apple/Google ne peut pas être rappelée.

Trigger INSERT pending → événement outbox dans la transaction de commande. Unicité commande/événement et événement/appareil. Aucun envoi avant commit. Worker Edge `forno-push-worker`, `npm:web-push@3.6.7` et dépendances verrouillées par deno.lock, vraie encryption Web Push/VAPID. La désactivation de la vérification JWT de la passerelle est remplacée par un jeton dédié de 256 bits et des RPC service_role qui vérifient son hash. Aucun contenu d’envoi libre fourni par l’appelant, aucun CORS.

`pg_net` réveille après commit ; `forno-push-outbox` vérifie chaque minute s’il reste du travail. Throttle 3 s. Pas de cron Vercel Hobby à la minute. Les jobs de maintenance des commandes et l’ancien test de concurrence restent en pause.

Réservations de livraison 90 s, verrou appareil puis livraisons, SKIP LOCKED et accusés clôturés par lease. Six tentatives au plus, backoff 30/60/120… s, arrêt à expiration de la demande. Réponses permanentes 404/410 → abonnement retiré. Réponse d’un ancien worker ignorée. Lots jusqu’à 20 événements/appareil, même topic et tag système `forno-orders`, renotify=false. Le transport est « au moins une fois » : si un processus meurt après l’acceptation fournisseur avant l’ACK SQL, une relivraison reste possible ; le tag regroupe l’alerte. Ne pas promettre exactement une réception ni une livraison garantie. Le dashboard et son polling de 8 s restent la source de vérité. Badge actualisé depuis les données autorisées lorsque l’application est ouverte ; aucune donnée métier stockée dans le worker.

Payload fermé : type/count et, pour une demande unique, référence, quantité et heure de retrait. Aucun nom, téléphone, note, adresse, endpoint ou jeton dans la notification. Clic toujours vers `/admin/` sur la même origine, avec contrôle serveur inchangé.

## Configuration et secrets

| Valeur | Emplacement | Visibilité |
| --- | --- | --- |
| FORNO_PUSH_ENABLED=true | Vercel Preview, branche codex/test-commandes seulement | Flag serveur, faux par défaut |
| VAPID public key | push_config, récupérée par le BFF admin | Publique par nature |
| VAPID private key | Supabase Vault, générée dans le worker | Serveur uniquement |
| VAPID subject | push_config.vapid_subject, depuis src/config/push.config.ts | URL de contact du site |
| Worker credential | Supabase Vault + hash privé | Serveur uniquement |
| Supabase server key | Secret automatique Edge et Vercel Preview existant | Serveur uniquement |

La paire VAPID peut alternativement être importée par les variables Edge VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY avant sa première génération. Le stockage Vault remplace ces variables dans ce déploiement : pas de nouvelle clé à recopier dans Vercel. Ne jamais remplacer la paire après abonnement sans prévoir le réabonnement des appareils. Le worker actuel et les garde-fous BFF sont épinglés à Test ; une migration Production demandera une configuration explicite et revue, pas seulement un flag.

Migrations : `20261030055421_forno_push_outbox.sql`, `20261030055422_forno_push_dispatch.sql`, `20261030061606_harden_push_platform_integration.sql`. Bootstrap Test séparé `supabase/tests/push-bootstrap.sql`, avec marqueur natif obligatoire ; il ne retourne aucun secret. Déploiement Edge : contrôle Deno strict, puis `node scripts/bundle-push-worker.mjs /tmp/forno-push-worker-bundle.ts`, upload du bundle avec deno.json/deno.lock via le connecteur.

## Contrainte pg_net vérifiée

Supabase possède les objets net via supabase_admin. Les REVOKE tentés par postgres ne retirent pas ses grants PUBLIC : ne pas interpréter leur succès SQL comme un retrait effectif. [Explication officielle](https://supabase.com/kb/troubleshooting/revoking-access-to-pg_net-objects-has-no-effect). Les rôles navigateur sont NOLOGIN et net doit rester hors Data API. Vérification réelle avec clé publishable et Accept-Profile: net : PGRST106, seuls public et graphql_public exposés. Vault n’est pas lisible par anon/authenticated. Tout opérateur pouvant se connecter directement à PostgreSQL doit être considéré comme de confiance ; le jeton dédié de réveil est temporairement lisible dans la file, jamais une clé Supabase ni VAPID. Aucun rôle DB applicatif LOGIN ajouté.

La migration complémentaire recrée uniquement l’extension nouvellement installée avec ses métadonnées dans extensions : file vide et absence de dépendances vérifiées, aucun CASCADE. Aucun reset ni suppression de commandes. L’avertissement préexistant sur les mots de passe compromis reste à décider avant Production ; aucun changement de plan.

## Validation

Local : 73 tests existants + 36 tests Push/PWA. Ils comprennent PostgreSQL PGlite, BFF session/CSRF et Service Worker dans VM ; ce sont des tests simulés, pas une réception sur téléphone. TypeScript Astro et Deno strict, build Astro/Vercel.

Test cloud : migrations appliquées, RLS/ACL des nouvelles tables et RPC vérifiés ; worker authentifié appelé via pg_net → HTTP 200 et VAPID prête. POST non authentifié → 401. `supabase/tests/push-transaction.sql` exécuté sur le vrai PostgreSQL Test : outbox atomique, double claim refusé, retry, lease fencing, 410 et effacement des clés validés ; transaction entièrement annulée, aucune requête vers un fournisseur Push issue de ces fixtures.

Concurrence PostgreSQL réelle : `supabase/tests/push-concurrency.sql`, deux connexions (MCP et pg_cron). Le second worker attend 10,08 s sur le verrou du premier, puis reçoit null. Une seule livraison, une seule tentative, appareil synthétique révoqué et aucun envoi fournisseur. Le job ponctuel reste en pause ; le scheduler Push est rétabli actif.

Preview protégé du commit `4822077` : déploiement `dpl_HGNqXRW21kf1FtpHcJzrKLZXdgwq`, READY, target=null, alias stable. Navigateur réel : manifest reçu avec id/scope/start_url /admin/, mode standalone et trois icônes ; guide hors ligne rendu à 390 px, scrollWidth=clientWidth=390 ; API Push sans session affiche UNAUTHORIZED. Le connecteur HTTP Vercel ne parvient pas à résoudre le déploiement, même via son URL unique ; le fallback CLI dispose d’une connexion expirée. La protection n’est pas modifiée. Ces limites de l’outil n’empêchent pas la navigation dans le Preview authentifié Vercel.

Réception matérielle : le propriétaire confirme la réception de la notification test sur iPhone. Android est indisponible pour le moment, validation différée. La réception d’une nouvelle commande, l’arrière-plan et le clic restent à confirmer. Aucun succès SQL, HTTP 201 d’un fournisseur ou test dans une VM ne vaut preuve de réception sur un appareil.

## Essais matériels obligatoires

1. Ouvrir le Preview stable protégé dans Safari iPhone / Chrome Android, s’authentifier à Vercel si demandé puis au dashboard avec le compte Test habituel. Aucun mot de passe à transmettre.
2. Installer depuis `/admin/` (iPhone iOS16.4+ : Partager → écran d’accueil). Ouvrir l’icône, vérifier connexion/navigation et session persistante. La protection Vercel peut nécessiter une nouvelle connexion dans le stockage de l’application installée ; ne pas la désactiver.
3. Réglages : nommer chaque appareil, Activer, autoriser explicitement, Envoyer une notification test. Confirmer séparément iPhone/Android, application au premier plan puis en arrière-plan, clic vers commandes.
4. Après au moins un abonnement physique confirmé, exécuter `supabase/tests/push-new-order.sql` pour créer une demande synthétique Test via la RPC métier avec service refermé avant commit et verrou global toujours faux. Vérifier notification réelle sur chaque téléphone et aucun champ client, référence/compteur dans le dashboard.
5. Retirer un appareil depuis l’autre, vérifier l’absence d’envoi suivant. Réabonner, désactiver localement, vérifier le fournisseur/OS. Tester hors connexion et retour réseau, mise à jour, expiration session et révocation admin avec fixtures isolées.

## Limites, conservation et coûts

Aucune infrastructure payante ajoutée. Quotas Supabase partagés à surveiller : le scheduler SQL tourne chaque minute, l’Edge n’est invoquée que pour initialisation/travail dû. [Quotas Edge](https://supabase.com/docs/guides/functions/pricing), [scheduling](https://supabase.com/docs/guides/functions/schedule-functions), [contraintes iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/). OS, réseau, Focus/économie batterie et autorisations peuvent retarder ou bloquer la réception.

Les clés d’abonnement sont effacées à la révocation. Événements et tentatives ne contiennent aucune coordonnée client ; ils référencent les commandes et sont supprimés en cascade si la commande est supprimée. Leur purge périodique n’est pas activée : une durée de conservation des métadonnées techniques reste à convenir. La maintenance/purge des commandes Production reste en pause.

Avant Production : valider les deux appareils et le parcours réel, configurer origine/projet/subject Production et protection admin, revue migrations/RLS/quotas/rétention, appliquer seulement après accord, créer la paire VAPID Production indépendante et les abonnements Production. Valider Turnstile et commandes séparément. Aucune promotion automatique du Preview, aucune ouverture publique autorisée par cette étape.


## Validation matérielle du 30 octobre — iPhone

Le propriétaire confirme la réception de la notification test sur iPhone. La base contient un abonnement Apple actif (`web.push.apple.com`), un événement test envoyé en une tentative, réponse fournisseur 201 à 06:39:06 UTC. La confirmation humaine constitue la preuve de réception, séparément de l’accusé Apple. Le bouton Test a bien parcouru le BFF authentifié, l’outbox, pg_net, l’Edge, VAPID et le Service Worker. Android ne peut pas être testé par le propriétaire pour le moment ; aucune validation Android n’est revendiquée.

Déploiement final du code applicatif : `dpl_DoAFD36Nzfkt7avcCe4GSd5DpWfr`, commit `e687b1b`, READY, target=null, même alias stable. 109 tests locaux (73 existants + 36 nouveaux), TypeScript sans diagnostic, Deno strict, build Astro et vérification de la fonction compilée réussis. Le Preview réel refuse les créneaux avec ORDERS_DISABLED.

Contrôle Production en lecture seule : déploiement inchangé `dpl_2Vx6t2KCcLZDbE2rkok2TWfUBfDV`, commit main `95a2b58` ; zéro commande, zéro service autorisé, aucune table Admin/Push, cron de maintenance en pause. Sur Test, un ancien service du 28 octobre garde un flag d’ouverture historique ; il est hors date et ne peut être commandé. Le service actuel du 30 reste fermé ; aucune modification de ce service historique effectuée.


Autres contrôles finaux : révocation de l’administrateur avec le vrai abonnement Apple dans une transaction annulée → endpoint/clés effacés et appareil inactif à l’intérieur de la transaction ; rollback → abonnement réel préservé. Cron Push propriétaire postgres, fréquence minute, trois dernières exécutions succeeded, file pg_net vide. Les crons de maintenance et de concurrence sont toujours en pause.

À la fin de cette passe, la création de la nouvelle commande physique attend le signal « iPhone en arrière-plan, prêt » demandé au propriétaire. Le script est prêt et vérifié localement mais n’a pas été exécuté sur Test ; les 16 commandes synthétiques précédentes sont conservées. L’essai Android est explicitement différé par le propriétaire. Restent aussi le clic depuis une notification, le retrait/réabonnement matériel et le hors-ligne réel sur les téléphones ; la page statique et la logique de cache ont été vérifiées séparément.

Capture du guide servi par le Preview à 390 px, conservée hors dépôt : `/tmp/forno-pwa-offline-full.jpg`. La visualisation directe du guide ne constitue pas à elle seule un test de coupure réseau matérielle. Le contrôle VM vérifie le fallback et l’absence de cache des routes privées.
