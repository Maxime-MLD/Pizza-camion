# Environnement FORNO Test — validation actualisée le 29 octobre 2026

## Résultat actuel : parcours Preview complet réussi

La dernière clé Test enregistrée par l’utilisateur est acceptée. Le problème historique `401 / bad_checksum` décrit plus bas est résolu. Aucune valeur secrète n’a été affichée ou déchiffrée.

Déploiement réellement testé : `dpl_5DLGqBXUj4sCtFVGZ33Azfin6CBC`, https://pizza-bs4sckax6-maxime-mlds-projects.vercel.app, branche `codex/test-commandes`, commit `4c51c52`, cible Preview (`target=null`), protection Vercel conservée. L’API utilise exclusivement Supabase Test `brzcvncsycdpsrvulqss`. Le service synthétique du 29 octobre et ses créneaux sont distincts du planning Production.

| Vérification réellement exécutée | Portée | Résultat |
| --- | --- | --- |
| Tests automatisés et compilation | Local | 47 tests réussis (14 checkout, 33 commandes/SQL/fixtures), 3 scénarios réseau Cloudflare, TypeScript sans erreur et build Astro/Vercel réussi ; fonction compilée vérifiée sur le commit testé |
| Lecture des créneaux | HTTP Preview → Supabase Test | 200 ; date Europe/Paris du 29 octobre, seul « Village de test », préparation 30 min, créneau passé et désactivé indisponibles ; aucun basculement vers demain |
| Parcours complet navigateur | Navigateur → Vercel → Siteverify officiel de test → Supabase Test | Une Capri et une Maestro, retrait 11:00 : **F-00000007**, **2100 centimes**, **pending / En attente de confirmation**, panier revenu à 0 pizza et 0 € |
| Prix et lignes persistés | SQL Test en lecture seule | Deux lignes : Capri 1000 × 1, Maestro 1100 × 1 ; total 2100, pizza_count 2, statut pending |
| Nouvelle commande HTTP | Preview | 201, **F-00000008**, deux Capri, total recalculé 2000 centimes |
| Doubles soumissions et reprise | Preview + SQL Test | Deux répétitions (jeton identique puis jeton de test renouvelé) retournent la même référence F-00000008 ; reprise GET 200 sans coordonnées ; exactement une commande pour cette clé |
| Conflit d’idempotence | Preview | Quantité modifiée avec la même clé : 409 IDEMPOTENCY_CONFLICT |
| Dernière capacité, deux POST simultanés | Preview + SQL Test | Appels démarrés à 400 ms d’intervalle et terminés vers 1051/1054 ms : un 201 **F-00000009**, un 409 SLOT_FULL ; une seule commande de deux pizzas pour capacité deux. La preuve de verrou PostgreSQL sur deux connexions indépendantes du 28 octobre reste documentée plus bas |
| Manipulations et entrées invalides | Preview | Prix ajouté et quantité négative : 400 INVALID_REQUEST ; village et date différents : 409 WRONG_SERVICE ; créneau passé : 409 SLOT_EXPIRED ; désactivé : 409 SLOT_UNAVAILABLE ; jeton absent : 400 INVALID_REQUEST |
| Expiration et capacité | Preview + SQL Test | **F-00000010** synthétique sur créneau capacité deux ; seule son échéance est vieillie dans Test, puis API : créneau de nouveau disponible avant maintenance ; forno_maintenance() : statut cancelled |
| Service désactivé | Preview | Service Test remis orders_enabled=false : API ne propose plus de créneaux disponibles, POST 409 SERVICE_CLOSED |
| Responsive du reçu | Navigateur Preview | Desktop 1280 px et mobile 390 px ; scrollWidth égal à clientWidth, confirmation lisible, aucune régression de section introduite |
| Production finale | HTTP + SQL en lecture seule | /api/pickup-slots : 503 ORDERS_DISABLED ; 13 pizzas, 30 services, 440 créneaux, **0 commande**, **0 service activé**, cron en pause |

Dix commandes synthétiques au total sont conservées dans Test : les six preuves SQL historiques et quatre nouvelles commandes via Vercel. Au contrôle de 10:04 heure de Paris : 3 pending, 1 accepted et 6 cancelled. Ces statuts évoluent avec l’expiration ; aucune commande supprimée. Les données utilisées sont fictives, aucune donnée personnelle Production copiée.

La maintenance Test a été appelée à nouveau après vieillissement ciblé de la seule commande F-00000010. Le fonctionnement réel pg_cron, l’anonymisation à 30 jours et la suppression d’un ancien compteur synthétique avaient déjà été vérifiés le 28 octobre. Les deux jobs Test et le job Production restent en pause. Le délai de conservation technique de 30 jours doit être approuvé avant activation Production.

## État de fermeture et limites avant ouverture

Le service Test est refermé après les essais. Le verrou FORNO_ORDERS_ENABLED est remis à false **uniquement en Preview sur codex/test-commandes** pour les prochains déploiements. Le client de vérification et son accès temporaire sont retirés en fin de contrôle. Aucune promotion en Production, aucune modification des clés, données ou services Production.

Le widget de démonstration a automatiquement fourni un jeton dans le navigateur et le serveur a réellement appelé Siteverify. Les clés officielles de test ne prouvent pas la protection anti-bot réelle, l’autorisation du domaine Production, ni l’expiration/réutilisation d’un vrai jeton. Un widget réel autorisé sur un domaine de test doit encore être validé, puis les paramètres opérationnels, les tarifs à confirmer, la confidentialité/rétention et l’autorisation explicite d’ouverture. **Le système n’est pas déclaré prêt à ouvrir les commandes publiques.**

Aucune nouvelle correction du code métier n’a été nécessaire après l’enregistrement de la clé valide. Le fichier modifié lors de cette validation finale est ce rapport ; les corrections et tests précédents sont déjà sur la branche de test.

## Historique des diagnostics précédents (résolus)

Les paragraphes suivants conservent les étapes antérieures ; leurs mentions d’absence de clé ou de parcours non exécuté décrivent l’état à ces dates et ne remplacent pas les résultats actuels ci-dessus.


## État actualisé le 29 octobre — clé Preview enregistrée, valeur rejetée

La présence de `SUPABASE_SECRET_KEY` en Preview est désormais confirmée dans l'interface et l'API Vercel, uniquement sur `codex/test-commandes`. Le formulaire d'ajout ciblait Production par défaut et signalait un doublon ; la nouvelle entrée a été enregistrée après retrait de Production et sélection de la branche. La valeur masquée saisie par l'utilisateur n'a jamais été affichée ou déchiffrée.

Après reconstruction, le Preview `dpl_9odXNoe9ADEYDQyXFNUMC28RDYGp` (https://pizza-bs4s2h0l6-maxime-mlds-projects.vercel.app, commit `0b307ca`, target Preview) atteint réellement la passerelle Supabase Test. La lecture des créneaux retourne 503 DATABASE_UNAVAILABLE. Les logs Supabase Test limités au chemin RPC et aux codes d'erreur confirment **HTTP 401, UNAUTHORIZED_INVALID_API_KEY, bad_checksum**, sur `/rest/v1/rpc/forno_rate_limit`. Une seconde valeur enregistrée puis redéployée a produit le même refus. Les permissions SQL de service_role sur la RPC et le schéma public sont présentes : elles ne corrigent pas une clé refusée par la passerelle.

Le blocage d'absence de variable décrit dans les sections historiques ci-dessous est donc résolu. Le prérequis restant est une **valeur Secret valide du projet forno-pizza-test**, copiée intégralement avec le bouton de copie du fournisseur. L'édition inline de la seule entrée Preview est préparée dans Vercel. La rotation groupée Production & Preview a été fermée sans validation pour préserver Production. L'onglet source Supabase Test affiche une connexion à effectuer par l'utilisateur ; aucun identifiant demandé dans le chat.

Les fixtures de test ont été rendues compatibles avec un nouveau jour, sans effacer les preuves ni les commandes historiques. Un test PGlite dédié vérifie la conservation des lignes historiques et le refus des doublons du jour. Cette préparation a été appliquée **uniquement à Supabase Test**, le 29 octobre : service synthétique du jour et créneaux à partir de 11:00 ; les six commandes précédentes sont conservées. Aucune commande supplémentaire n'a été créée par les appels API refusés.

Validation locale actualisée : **14 tests checkout + 33 tests commandes/SQL/fixtures = 47 réussis**, trois scénarios réseau Cloudflare réussis, TypeScript (123 fichiers) sans erreur/avertissement/hint, build Astro/Vercel réussi et vérification de la fonction compilée réussie. Le checkout utilisateur revenu sur main a été préservé ; ces travaux utilisent le worktree géré `forno-preview-validation` sur la branche de test. Aucune modification du code exécuté en Production.

En attendant la connexion de l'utilisateur à la source Supabase, le verrou Preview est remis à false pour les déploiements suivants, le client HTTP privé arrêté et son accès temporaire révoqué. L'édition de la seule variable Preview reste ouverte pour la correction par l'utilisateur ; aucune rotation groupée ni modification de la clé Production validée.

## Reprise du 29 octobre — configuration toujours bloquante

Le Preview a été reconstruit depuis le commit `439e1ea` sur la branche de test : déploiement `dpl_Cf6Bvxgtmss51rYtbhMPUSz5VX4p`, cible Preview (`target=null`), URL `https://pizza-2n0ri1ymd-maxime-mlds-projects.vercel.app`. Avec le verrou Preview temporairement activé, une lecture HTTP réellement authentifiée de `/api/pickup-slots` retourne **503 NOT_CONFIGURED**. Aucune commande envoyée ni donnée Test modifiée pendant cette reprise.

Les métadonnées lues sans déchiffrement pour le projet `pizza`, équipe `MLD projets`, branche `codex/test-commandes`, retournent les six variables de test configurées par l'agent mais toujours aucune `SUPABASE_SECRET_KEY` Preview. L'adresse publique fournie par l'utilisateur identifie correctement le site ; elle ne permet pas de vérifier où la variable a été enregistrée. Le parcours complet reste non validé. Aucun autre secret n'a été testé ou déclaré valide par ce résultat.

Le verrou Preview a ensuite été remis à false dans sa configuration pour les déploiements suivants ; l'accès temporaire de vérification a été révoqué et le client arrêté. Le service Test du 29 octobre est resté scheduled, commandes désactivées ; les six commandes synthétiques précédentes sont conservées. Les tests existants du 28 octobre ne sont pas présentés comme rejoués le 29.

Incident corrigé pendant la reconstruction : la cible API `preview` a été rejetée par Vercel. Une tentative utilisant `staging` a réassigné brièvement l'alias secondaire `pizza-maxime-mlds-projects.vercel.app`. Celui-ci a été rétabli immédiatement sur le déploiement Production d'origine `dpl_4NyhLNxBjJMVcG27kHyRu6AoECDe`, puis vérifié. Le domaine public `pizza-two-bay.vercel.app` est resté sur ce déploiement, avec 503 ORDERS_DISABLED. La reconstruction finale utilise une source Git explicitement épinglée à la branche de test et omet la cible API pour obtenir un vrai Preview. Aucun changement de base Production ni promotion de code.

Action nécessaire : enregistrer la clé serveur de Supabase **forno-pizza-test** dans [Vercel / pizza / variables](https://vercel.com/maxime-mlds-projects/pizza/settings/environment-variables), portée **Preview**, branche **codex/test-commandes**, nom **SUPABASE_SECRET_KEY**, puis Save. La clé doit être copiée directement entre les interfaces Supabase Test et Vercel, jamais transmise dans le chat. La page exacte des variables a été demandée à l'ouverture dans le panneau navigateur.

## Isolation et déploiements

Création approuvée par l'utilisateur après annonce du coût Supabase : **0 par mois** dans l'organisation MLD. Projet `forno-pizza-test`, ref `brzcvncsycdpsrvulqss`, région eu-west-1, PostgreSQL 17.11. Aucune donnée personnelle copiée de Production.

Branche `codex/test-commandes`, indépendante de `main` :

- `16fdc3e` : corrections validées de l'audit et tests ;
- `5668785` : isolation du Preview, validation officielle de test Turnstile et fixtures SQL.

Preview déployé : https://pizza-3vsil9isc-maxime-mlds-projects.vercel.app ; déploiement `dpl_2S7eRT42ysQyZUdDaYRbFbimsyQS`, READY. La production reste sur son commit précédent. Aucune promotion.

Protection SSO Vercel conservée : une requête sans authentification redirige vers vercel.com. Le client de test dispose d'un accès temporaire via le connecteur Vercel, non publié, sans désactiver la protection. Les liens temporaires ne sont pas enregistrés dans Git ; le client HTTP les reçoit sur stdin sans écho.

L'accès temporaire utilisé pendant ces vérifications a ensuite été **révoqué**, le client arrêté et son fichier privé supprimé. Aucun lien d'accès n'est livré dans le rapport.

Les variables créées sont **Preview uniquement, branche codex/test-commandes** : URL de Supabase Test, sel anti-abus distinct, clés officielles Cloudflare, mode officiel de test et verrou de commande. Aucune valeur Production lue, déchiffrée ou copiée.

## Ce qui est réellement vérifié

| Test | Portée | Résultat |
| --- | --- | --- |
| 14 tests checkout + 32 tests commandes/SQL | Local | Réussis, dont garde-fous Preview et refus des clés de test hors Preview |
| Trois scénarios Siteverify officiels | Réseau Cloudflare réel | Succès, refus et jeton dépensé vérifiés ; aucune clé réelle Production utilisée |
| TypeScript et build Vercel | Local | Réussis ; verrou contrôlé dans la fonction compilée |
| Migrations et catalogue | Supabase Test réel | Lot des quatre migrations appliqué dans l'ordre, 13 pizzas ; marqueur de test privé avec RLS |
| Planning synthétique | Supabase Test réel | Service du jour uniquement, « Village de test », horaires étendus de test ; service de demain scheduled / commandes désactivées ; aucune adresse inventée |
| Commande et prix | SQL réel | `F-00000001`, pending initial, deux Capri : 2000 centimes ; champs de prix falsifiés ignorés par la RPC et prix relus en base ; lignes et snapshots vérifiés. Le schéma API refuse ces champs en amont |
| Idempotence | SQL réel | Même UUID et empreinte : une référence et une ligne de commande. Empreinte différente refusée |
| Entrées interdites | SQL réel | 11 refus attendus : conflit d'idempotence, village, date, service de demain, créneau désactivé/passé, quantités, pizza indisponible et commandes désactivées |
| Capacité après expiration | SQL réel | Pending synthétique vieilli : capacité libérée immédiatement avant maintenance ; accepted continue à consommer sa capacité |
| Deux connexions concurrentes | PostgreSQL Test réel | PID A 20554, PID B 20552 ; B observé en `Lock / transactionid`, bloqué par A ; attente 9,832717 s ; B reçoit SLOT_FULL ; une commande, deux pizzas pour capacité deux (`F-00000006`) |
| Cron de maintenance | pg_cron Test réel | Run succeeded de 19:05:00 à 19:05:00 heure de Paris ; pending expiré → cancelled ; coordonnées et empreinte du synthétique âgé de 31 jours effacées ; ancien compteur supprimé |
| RLS / ACL | Supabase Test réel | Tables FORNO protégées ; pas d'accès direct anon/authenticated/service_role ; quatre RPC métier seulement pour service_role ; advisors : INFO attendues pour absence de politiques publiques, aucun WARN/ERROR retourné |
| Accès au Preview | HTTP réel authentifié | JSON de l'API accessible après authentification ; 503 ORDERS_DISABLED tant que le verrou est fermé |
| Navigateur → Vercel → Turnstile → Supabase → confirmation | Non exécuté à ce stade | Clé serveur Supabase Test non visible dans les métadonnées Vercel Preview ; voir configuration restante |

Les premiers essais concurrents via deux appels MCP ont été sérialisés par le connecteur : ils n'étaient pas une preuve de chevauchement. Le test concluant utilise un job cron de test comme connexion indépendante et observe explicitement le verrou avant son relâchement. Le job `forno-test-concurrency` est ensuite remis en pause. Aucun trigger de délai ni changement de la RPC Production n'a été installé.

Six commandes synthétiques SQL ont été créées dans Test à ce stade, sans suppression. Une commande ancienne a été anonymisée par la maintenance de test. Aucun nom/téléphone réel utilisé. Les références SQL ne constituent pas une confirmation navigateur testée.

## Turnstile : portée exacte des garanties

`FORNO_TURNSTILE_MODE=official-test` n'est accepté que si : VERCEL_ENV vaut preview, la branche est exactement codex/test-commandes, l'URL pointe exactement vers brzcvncsycdpsrvulqss.supabase.co, et les clés sont les clés officielles de test attendues.

L'appel HTTPS Siteverify est toujours effectué et `success === true` est obligatoire. En mode officiel isolé, le serveur exige aussi les métadonnées de réponse de test et le hostname de démonstration example.com. Une erreur Cloudflare, une réponse mal formée ou des métadonnées inattendues ferment l'envoi.

En mode réel, le domaine exact et action=order restent obligatoires ; une réponse marquée comme test est refusée. Les clés officielles sont refusées en Production, même si quelqu'un les y configure par erreur. Aucune donnée de requête client ne peut activer le mode de test.

Ces clés officielles ne prouvent **ni l'anti-bot réel, ni l'autorisation du domaine Production, ni la durée de vie/réutilisation d'un vrai jeton**. La validation d'un widget réel distinct sur Preview reste nécessaire avant une décision d'ouverture. Voir [documentation Cloudflare](https://developers.cloudflare.com/turnstile/troubleshooting/testing/).

## Configuration restante

La dernière lecture Vercel ne retourne `SUPABASE_SECRET_KEY` que pour Production. La confirmation de l'utilisateur a été reçue, mais l'ajout Preview n'est pas confirmé par l'API. Ne pas activer le verrou ni copier la clé Production pour contourner ce point.

L'utilisateur doit enregistrer la clé serveur de **forno-pizza-test** dans le projet Vercel **pizza / MLD projets**, nom SUPABASE_SECRET_KEY, portée Preview, branche codex/test-commandes. Ne jamais envoyer cette valeur dans le chat. Après présence vérifiée : activer le verrou sur cette branche uniquement et reconstruire le Preview ; vérifier son identité de base et les créneaux avant tout POST.

Restent alors : envoi depuis le navigateur avec widget officiel de test, référence et statut « En attente de confirmation », décrément du panier, reprise du reçu, POST idempotents et invalides via Vercel, et widget réel de domaine pour les garanties anti-bot normales.

## Fichiers et reproduction

- `src/config/order-environments.config.ts` : identités des deux bases et branche autorisée, aucune clé.
- `src/server/orderEnvironmentGuard.ts`, `environment.ts`, `supabase.ts`, `ordersApi.ts` : isolation serveur et traitement des réponses officielles de test.
- `tests/orders.test.ts`, `scripts/verify-turnstile-network.mjs` : tests locaux et réseau.
- `supabase/tests/preview-marker.sql`, `preview-fixtures.sql`, `real-orders.sql`, `real-concurrency.sql` : fixtures et protocole SQL réservé à Test. Ne pas rejouer sur les fixtures déjà utilisées ; les gardes refusent les doublons.
- `scripts/preview-http-probe.mjs` : client API limité au Preview vérifié ; accès temporaire reçu sans écho sur stdin, aucun secret Supabase requis côté client.
- `.env.example` : noms de configuration uniquement. Aucun fichier .env réel ni secret committé.

## Conditions de maintenance Production

Le cron Production reste **en pause**. Le cron Test a été remis en pause après son exécution réussie. La rétention technique actuelle est de 30 jours depuis created_at, tous statuts : valider cette règle, les commandes encore en traitement, la politique de confidentialité et les sauvegardes avant toute activation Production.

À 19:07 heure de Paris, lecture seule Production : 13 pizzas, 30 services, 440 créneaux, **0 commande**, aucun service activé, cron inactif. L'ouverture publique n'est toujours pas autorisée et le système n'est pas déclaré prêt pour Production.
