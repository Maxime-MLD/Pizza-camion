# Validation des commandes FORNO — 28 octobre 2026

## Conclusion

**Pas prêt pour l'ouverture.** La production reste fermée. Aucun service activé, aucune commande créée, aucune maintenance exécutée, aucune donnée supprimée pendant cet audit. Les corrections et tests ajoutés sont locaux ; ils n'ont pas été déployés.

Production auditée : https://pizza-two-bay.vercel.app ; dépôt `Maxime-MLD/Pizza-camion`, commit déployé `95a2b587fdd2a4454d6a2096d8f543a67ef55ed8`, déploiement `dpl_4NyhLNxBjJMVcG27kHyRu6AoECDe`, état READY.

L'histoire à vérifier : panier navigateur → retrait du jour → coordonnées → widget Turnstile → API Astro/Vercel → Siteverify Cloudflare → transaction Supabase → reçu `pending` → confirmation navigateur.

## Résultats et limites

| Vérification | Résultat | Preuve / portée |
| --- | --- | --- |
| Accueil et `/commander/` déployés | Réussi, production | HTTP 200 ; tunnel observé dans le navigateur |
| Adaptateur Vercel et routes API | Réussi | `@astrojs/vercel` 11.0.16, Astro 7.4.2 ; APIs `prerender=false`, réponses JSON réelles |
| Verrou global | Réussi, production | GET créneaux, GET et POST commandes : 503 `ORDERS_DISABLED` ; origine étrangère : 403 ; méthode non autorisée : 405 |
| Variables Vercel | Présence confirmée, valeurs non vérifiées | Cinq noms attendus, portée Production, type secret ; aucune variable Preview. Aucun déchiffrement. `FORNO_ORDERS_ENABLED` absent, donc verrou fermé |
| API Vercel → Supabase avec sa clé secrète | Non exécuté | Le verrou se trouve avant la connexion. La présence des variables ne prouve ni leur valeur ni leur validité runtime |
| Base réelle | Réussi, lecture seule | `forno-pizza`, ref `fqjkkjvrklpzhwmswlsy`, eu-west-1, PostgreSQL 17.11, ACTIVE_HEALTHY ; 13 pizzas, 30 services, 440 créneaux |
| Catalogue | Réussi, lecture seule | Noms, recettes et centimes conformes aux données du dépôt. Montagnarde et Norvégienne indisponibles, tarifs à confirmer |
| Service du jour / Paris | Réussi, SQL réel | 2026-10-28, Mably, 18:00–21:30, `scheduled`, `orders_enabled=false`, 14 créneaux tous indisponibles ; aucun report à demain |
| Délais / capacités / dimanche / changement de date | Réussi localement | Tests SQL PGlite et TypeScript ; horloge contrôlée dans la copie de test uniquement. À rejouer sur une vraie base de test |
| RLS et privilèges | Réussi, base réelle | RLS actif sur les huit tables FORNO ; aucun accès direct de tables pour anon/authenticated/service_role. Quatre RPC métier seulement pour service_role, maintenance réservée au propriétaire |
| Data API anonyme | Réussi, HTTP réel | Clé publishable : lectures `orders`, `order_items` et RPC créneaux refusées, HTTP 401 / PostgreSQL 42501 ; aucune donnée personnelle retournée |
| Advisors Supabase | Pas d'alerte de sécurité WARN/ERROR retournée | Huit INFO `rls_enabled_no_policy`, cohérents avec l'interdiction délibérée d'accès client. `rls_auto_enable()` inaccessible aux rôles applicatifs |
| Cloudflare Siteverify | Réussi, réseau réel avec clés officielles de test | Réponse succès, refus `invalid-input-response`, refus `timeout-or-duplicate`. Ce n'est pas une validation des clés Production |
| Jetons absents / invalides / expirés / réutilisés | Réussi localement ; refus Cloudflare de test observé | Aucun appel de création après échec. Expiration réelle de cinq minutes et réutilisation d'un vrai jeton à rejouer sur Preview |
| Widget sur le domaine Vercel | Non exécuté | L'étape 3 est inaccessible tant que les commandes sont fermées. Pas de contournement du verrou ni de Turnstile |
| Tunnel fermé desktop / mobile | Réussi, navigateur Production | Panier synthétique d'une Capri ; bouton Continuer désactivé ; aucun widget monté. Largeurs 1440 et 390 px, largeur du document identique à celle du viewport |
| Commande complète, référence, lignes et confirmation | Non exécuté sur Vercel/Supabase | Aucun environnement Preview ni projet/branche Supabase de test accessible. Les succès locaux utilisent PGlite et un transport injecté |
| Deux connexions sur la dernière capacité | Non exécuté | PGlite sérialise sa connexion ; ce test ne prouve pas les verrous d'un véritable PostgreSQL multiconnexion |
| Cron | Installé et en pause | `forno-order-maintenance`, `* * * * *`, propriétaire postgres, `active=false`, aucun historique de run |

Le tunnel est implémenté en composants Astro et TypeScript navigateur, sans React ni SDK Supabase côté client. Le client serveur est un transport PostgREST natif qui envoie la clé privilégiée en en-tête `apikey`, jamais au navigateur. Les erreurs SQL connues sont traduites en codes métier ; les diagnostics et corps de commandes ne sont pas journalisés.

Les vérifications locales et leurs résultats finaux sont consignés dans la section « Commandes de validation » ci-dessous ; elles ne transforment pas un résultat simulé en test de production.

## Réconciliation des commandes

À 16:16 heure de Paris, un snapshot SQL cohérent sous le rôle postgres comptait **0 commande et 0 ligne**, sans statut existant. Une seconde lecture à 16:17 confirmait zéro commande. La séquence de références indique `last_value=1`, **`is_called=false`** : sa valeur initiale n'est pas une commande. La troisième lecture finale, à **16:23:22**, effectuée avec `supabase/tests/audit-readonly.sql`, confirme les mêmes résultats et zéro ligne actuellement concernée par l'expiration, la purge personnelle ou le nettoyage des compteurs. L'appel SQL sous `SET LOCAL ROLE service_role` confirme également l'accès à la seule RPC de lecture, qui renvoie Mably indisponible.

L'ancienne indication d'une commande n'est pas expliquée par ces preuves. Une ligne de résultat d'outil, un compteur ou une séquence ne constituent pas une ligne de `public.orders`. Aucun historique de suppression n'est disponible pour conclure qu'une commande a été supprimée. Aucun nom ni téléphone n'a été lu.

## Maintenance et conservation

La définition réellement installée de `forno_maintenance()` :

- annule les `pending` dont l'échéance est dépassée ;
- efface prénom, nom, téléphone, commentaire et empreinte de demande après **30 jours depuis `created_at`**, pour tous les statuts ; conserve commandes et lignes ;
- supprime les compteurs anti-abus datant de plus de 24 heures.

Le délai `pending` est de 15 minutes, plafonné par l'heure de retrait. La lecture des créneaux exclut déjà les pending expirés ; la capacité peut donc se libérer sans cron. Le statut physique attend la maintenance ou une RPC de reprise/création. Les commandes acceptées continuent à consommer leur capacité.

La durée de conservation est un paramètre technique encore à approuver, pas une politique juridique validée. Vérifier aussi les sauvegardes, droits des clients et le traitement des commandes encore en cours avant toute activation. Le cron n'a pas été activé ni lancé pour l'audit. Son absence d'historique ne prouve pas son fonctionnement futur.

## Corrections locales et non-régression

1. `src/server/ordersApi.ts` : clé d'idempotence Siteverify déterministe par **tentative + jeton**. Les retries du même jeton gardent la même clé ; un jeton renouvelé dispose d'une nouvelle clé, tout en conservant l'idempotence métier de la commande. Le code précédent réutilisait la clé de commande pour tous ses jetons. Risque trouvé par lecture du code, aucun échec de renouvellement confirmé en production.
2. La réponse Siteverify exige maintenant `success === true`, en plus du domaine exact et de `action=order`. Aucun mode de contournement n'est ajouté.
3. `src/config/checkout.config.ts` : statut `pending` affiché « En attente de confirmation », conformément au résultat attendu. Le texte explique toujours que la demande doit être acceptée.
4. `tests/orders.test.ts` : refus des jetons, domaine/action, pannes réseau, renouvellement de jeton, empreinte métier stable et codes métier de disponibilité.
5. `scripts/verify-turnstile-network.mjs` : test réseau reproductible avec les seules clés officielles publiques de test, sans connexion à Supabase ni écriture.

**Particularité vérifiée :** la clé officielle « always passes », utilisée avec le jeton dummy, retourne `hostname=example.com` et aucune action `order`. Notre contrôle de domaine/action la refuse correctement sur le domaine de l'application. Ne pas assouplir ces contrôles pour rendre un test vert. Pour le test complet, employer un widget Turnstile distinct configuré sur le domaine exact de Preview.

Sources : [Siteverify Cloudflare](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/), [clés officielles de test](https://developers.cloudflare.com/turnstile/troubleshooting/testing/). Un jeton réel expire après 300 secondes et n'est utilisable qu'une fois, hors retry idempotent de la même validation.

## Protocole isolé prêt à approuver

Ce protocole n'a **pas** été exécuté. Toute création de base facturable nécessite un accord sur son coût. Toute création de commandes de test nécessite l'accord demandé par l'utilisateur. Ne pas réutiliser les secrets ni les données personnelles Production.

1. Fournir/sélectionner une **base Supabase de test distincte**, ou une branche de développement sans données personnelles. Vérifier sa ref différente de `fqjkkjvrklpzhwmswlsy`. Ne pas utiliser l'autre projet personnel inactif comme base jetable.
2. Appliquer les migrations revues sur cette base vierge ; rapprocher l'historique sans rejouer les migrations sur Production. Initialiser les 13 pizzas et le planning depuis les générateurs du dépôt. Aucun changement des recettes, prix ou planning Production.
3. Créer un Preview Vercel protégé, sur une branche dédiée, avec uniquement les secrets de la base de test et un sel anti-abus distinct. Les cinq variables Production ne sont pas disponibles en Preview actuellement. Sur ce Preview seulement, définir `FORNO_ORDERS_ENABLED=true` ; ne pas modifier cette variable en Production.
4. Créer un widget Turnstile **de test réel distinct**, autorisant le hostname exact de ce Preview, avec action `order`. Configurer sa paire de clés en Preview uniquement. Garder les contrôles serveur du domaine et de l'action. L'utilisateur réalise lui-même tout challenge interactif nécessaire.
5. Dans la base de test uniquement, ouvrir le service **du jour Paris** provenant du planning. Le lancer assez tôt pour disposer de créneaux à plus de 30 minutes et avant la marge de fermeture. Ne pas changer l'horloge serveur ni reporter automatiquement au lendemain. Réserver plusieurs créneaux distincts aux scénarios ; le dernier a une capacité de deux pizzas et aucun ordre existant.
6. Utiliser uniquement des coordonnées synthétiques de test ; aucun SMS/email n'est envoyé par ce code. Aucune vraie commande commerciale. Budget de données : au plus **10 commandes synthétiques** sur la base de test. Conserver les reçus/statuts et compteurs agrégés, jamais les jetons ou coordonnées dans les preuves.

| Scénario isolé | Résultat exigé |
| --- | --- |
| Navigateur → widget → POST → DB → confirmation | HTTP 201 ; référence réelle `F-…` ; une commande pending ; lignes en base ; total au centime ; texte « En attente de confirmation » ; panier décrémenté une seule fois |
| Prix falsifié | Ajout `totalCents`, prix unitaire ou autre champ inconnu : 400 ; aucune commande. Payload accepté : prix relus en DB, snapshots conformes |
| Quantité et recette | Négatif, fraction, >20, doublon, produit indisponible refusés ; aucun enregistrement partiel |
| Village, date, heure, service | Autre jour/village, créneau d'un autre service, passé, désactivé, hors horaires, service fermé/terminé : refus ; aucun report à demain |
| Double clic / réponse réseau perdue | Même UUID et même requête → une référence, une commande ; reprise par `X-Order-Request-Key`, aucune PII dans le reçu |
| Idempotence conflictuelle | Même UUID avec contenu différent → 409 ; aucune seconde commande |
| Renouvellement Turnstile | Jeton invalide, réellement expiré ou déjà dépensé pour une autre tentative : refus avant création. Nouveau jeton valide : même clé métier et nouvelle clé de validation |
| Dernier créneau, deux connexions réelles | Deux UUID distincts demandent chacun deux pizzas sur une capacité de deux ; une réussite, une erreur SLOT_FULL, total de deux pizzas. Refaire avec même UUID : une seule référence |
| Rollback concurrence | Session A tient le verrou puis rollback ; session B attend puis réussit ; aucun enregistrement partiel |
| Expiration et rétention | Sur la base de test uniquement : pending dépassé ne consomme plus ; maintenance annule ; ancien enregistrement synthétique est anonymisé ; accepted conserve capacité. Ne pas modifier le TTL/retenue Production |
| Cron réel | Après validation explicite des effets sur la base de test seulement : exécution minute constatée dans `cron.job_run_details`, puis remise en pause |
| Mobile / desktop | Sélection du seul créneau, blocage après date changée, focus, erreurs et confirmation lisibles sans débordement |

Le scénario de verrou à deux sessions est détaillé dans `supabase/tests/concurrency.md`. Un test HTTP en parallèle sans preuve du chevauchement des transactions ne suffit pas à prouver un verrou. Aucun nettoyage des commandes Production ; aucun nettoyage du test sans autorisation. Toute ouverture publique reste une décision ultérieure explicite.

## Commandes de validation

```sh
npm run test:checkout
npm run test:orders
npm run test:turnstile:network
npm run check
npm run build
node scripts/verify-vercel-build.mjs
```

Le test réseau est volontairement séparé des tests automatisés hors réseau. Il n'utilise jamais `.env` ni les identifiants Production. La vérification du build force le verrou fermé dans son propre processus et contrôle les sorties compilées.

Résultats finaux : **14 tests checkout + 30 tests commandes/SQL = 44 tests réussis** ; trois scénarios réseau Cloudflare réussis ; `astro check` : 119 fichiers, zéro erreur, avertissement ou hint ; build Astro/Vercel réussi ; vérification des routes et du verrou dans la fonction Vercel compilée réussie. `git diff --check` réussi. Aucun échec restant dans ces contrôles ; le test d'intégration complet reste non exécuté pour les raisons du tableau.

## Avant ouverture publique

Faire réussir le protocole Preview avec la vraie Data API et un vrai widget, valider tarifs/planning/capacités et politique de conservation, contrôler le cron de test, puis déployer les corrections revues. Vérifier les cinq secrets runtime Production et le domaine du widget sans les afficher. **Ne modifier ni le verrou global Production, ni `orders_enabled`, ni le cron Production sans autorisation explicite.**
