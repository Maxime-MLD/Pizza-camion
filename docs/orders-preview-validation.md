# Environnement FORNO Test — 28 octobre 2026

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
