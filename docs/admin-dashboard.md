# Dashboard privé FORNO — développement sur Test

Branche : `codex/test-commandes`, à partir du commit de validation Preview `8c32132`. Aucun changement de design public. Aucune migration Production, aucune promotion, aucune ouverture publique.

## Routes et architecture

- `/admin/login/` : connexion email/mot de passe Supabase Auth, aucun formulaire d’inscription.
- `/admin/` : commandes du jour Europe/Paris, compteurs, priorité, téléphone, pizzas, remarque, total et transitions.
- `/admin/planning/` : services du jour aux 90 prochains jours, fermeture/ouverture Test, annulation protégée, horaires futurs et capacités.
- `/admin/reglages/` : compte, verrou global et paramètres métier versionnés.
- `/api/admin/login`, `/logout`, `/orders`, `/planning`, `/settings`, `/change` : backend Astro sur Vercel.

Les pages sont rendues à la demande et protégées par middleware. Astro et TypeScript natif suffisent ; aucune dépendance React ou SDK navigateur ajoutée. Les routes admin sont exclues du sitemap.

## Authentification et autorisation

Le serveur appelle Supabase Auth pour vérifier le jeton ; il ne fait pas confiance au contenu d’un cookie ou aux métadonnées utilisateur. Ensuite, une RPC vérifie l’appartenance active à `forno_private.admin_users` **et** l’existence de la session dans `auth.sessions`, avec son échéance éventuelle. La révocation est contrôlée à chaque lecture et écriture.

Jetons d’accès et de renouvellement uniquement dans des cookies `__Host-`, HttpOnly, Secure, SameSite=Lax, Path=/. Lax préserve la navigation depuis un lien extérieur ; les mutations restent protégées par Origin et CSRF. Renouvellement côté serveur. Aucune clé Supabase, aucun jeton de session et aucune donnée client dans localStorage. Pas de client global partagé entre utilisateurs. La déconnexion renouvelle si nécessaire avant de révoquer la session locale Supabase, puis supprime les cookies.

Toutes les mutations, connexion et déconnexion comprises, exigent Origin identique et jeton CSRF correspondant au cookie HttpOnly. Les données et réponses d’erreur admin sont `private, no-store`, non indexables et non intégrables dans une frame. Messages nettoyés ; aucune journalisation des mots de passe, jetons ou données personnelles. Limitation durable des tentatives par empreinte HMAC de l’IP et de l’email.

## Migration et permissions

`20261029091206_forno_private_admin.sql` ajoute deux tables privées avec RLS, une révision des réglages et trois RPC réservées à service_role : session, lecture limitée, mutation contrôlée. Aucun accès direct aux tables pour anon, authenticated ou service_role. Aucun utilisateur Auth n’est automatiquement administrateur. Le journal stocke seulement l’identité de l’opérateur, la ressource et les changements métier autorisés ; ni coordonnées ni remarques du client.

Le SQL vérifie à nouveau toutes les règles métier. Verrous service → créneau → commande, cohérents avec le checkout, puis vérification du statut attendu. Seules pending → accepted/rejected, accepted → preparing, preparing → ready, ready → completed sont autorisées. Pending expiré refusé. `completed` signifie remis/clôturé, jamais payé automatiquement. La maintenance existante ne touche que les pending expirés.

Fermer le service bloque les nouvelles demandes et conserve les commandes existantes. Annuler est refusé si des demandes non expirées ou commandes en traitement subsistent. Horaires modifiables seulement pour un service futur sans aucune commande ; les anciens créneaux sont désactivés et conservés, les créneaux utiles réactivés/créés. Capacité future toujours supérieure ou égale aux réservations effectives. Changements de réglages versionnés ; capacité et intervalle n’écrasent aucun créneau existant. Le délai est protégé pendant les commandes en cours et lorsque des services autorisent encore les commandes.

L’ouverture est interdite côté API hors du Preview Test exact et également verrouillée dans la RPC hors d’une base explicitement marquée Test. Le verrou général des commandes reste indépendant et fermé. Une future ouverture Production nécessitera une revue et une modification explicites de ces garde-fous.

## Premier administrateur

1. Dans **Supabase Test uniquement**, Authentication → Users → Add user → Create new user : créer l’adresse autorisée, définir un mot de passe privé et confirmer l’email. Ne pas transmettre ce mot de passe au chat, à Git ou aux logs.
2. Le propriétaire applique `supabase/seeds/admin-test.sql` après remplacement local de `TODO_ADMIN_EMAIL`. Le script exige un utilisateur confirmé et le marqueur Test exact. L’identité réelle n’est pas enregistrée dans le dépôt.
3. Définir `FORNO_ADMIN_ENABLED=true` uniquement sur Vercel Preview / `codex/test-commandes`. Les autres secrets Test existants restent côté serveur. HTTPS obligatoire, y compris pour le développement des sessions.
4. Se connecter via le Preview protégé, puis vérifier les autorisations. Révoquer un administrateur : propriétaire SQL → `update forno_private.admin_users set active=false where user_id=...`. Ne pas accorder ce pouvoir depuis le dashboard.

Aucun faux compte ni utilisateur n’est créé en Production. Les migrations et ce bootstrap ne doivent pas y être exécutés sans accord explicite.

## Actualisation mobile

Polling authentifié toutes les 8 secondes, sans canal Realtime public. Chaque réponse vérifie à nouveau la session et l’autorisation. Actualisation manuelle, reprise au retour de l’onglet et après reconnexion, erreurs réseau visibles, actions bloquées tant que la fraîcheur n’est pas rétablie. Les champs en cours d’édition ne sont pas écrasés par le polling. Au maximum 500 commandes du jour, avec avertissement si la limite est atteinte.

Signal visuel pour une nouvelle demande ; son facultatif activé par un geste explicite, dépendant du navigateur. Pas de notifications push ou de réception garantie lorsque l’application est en arrière-plan. Aucune de ces garanties n’est annoncée.

## Résultats vérifiés le 29 octobre 2026

| Portée | Vérifications | Résultat |
| --- | --- | --- |
| Local | 26 tests admin + 14 checkout + 33 commandes existantes | 73 réussis |
| Local | TypeScript, build Astro/Vercel, fonction compilée publique | Réussis, commandes publiques fermées |
| Fonction Vercel compilée | Pages admin anonymes, API anonymes, cookies, cache privé, CSRF | Réussis avec tout accès réseau interdit dans ce test |
| Supabase Test réel | Trois migrations admin, RLS, ACL et advisors | Appliquées ; INFO attendues pour tables privées sans politiques publiques. Après création du compte Auth, un WARN fournisseur apparaît pour la protection contre les mots de passe compromis, désactivée |
| PostgreSQL Test réel | Autorisation/non-admin, cycle complet, conflit d’état, expiration, maintien de accepted après maintenance, 4 événements d’audit et révocation immédiate | Réussis dans une transaction intégralement annulée ; identités/session purement synthétiques non persistées, aucune connexion Auth simulée présentée comme réelle |
| Preview réel | Accès /admin sans session, formulaire de connexion et identifiants synthétiques invalides | Redirection et refus vérifiés, aucune donnée client révélée |
| Navigateur mobile | Formulaire de connexion à 390 px | Aucun débordement horizontal |
| Preview authentifié | Connexion réelle du premier compte, vues privées et actions depuis le navigateur | Connexion et lecture réussies ; cycle complet F-00000015 et refus F-00000016 vérifiés en base |
| Concurrence admin réelle | Deux vues authentifiées modifient F-00000017 | Une transition enregistrée et une trace d’audit ; l’autre vue affiche le conflit. Même session Auth partagée, deux requêtes distinctes |
| Actualisation automatique | Nouvelles demandes, compteurs et historique | Trois nouvelles demandes apparaissent sans action manuelle ; compteurs et statuts suivent les mutations |
| Indisponibilité et reprise | Backend admin Preview fermé puis rétabli | Message de données anciennes et sauvegarde désactivée, puis retour automatique à jour et bouton réactivé, sans rechargement ni reconnexion. Aucune coupure physique du réseau de l’utilisateur |

La migration complémentaire `20261029092544_harden_admin_settings_concurrency.sql` rend la vérification d’expiration atomique au moment de l’UPDATE et verrouille les services avant les réglages. Le changement du délai de préparation exige aussi que les services aient leurs commandes fermées, pour éviter une course avec le checkout. Aucun changement de la RPC du checkout n’a été nécessaire.

## Tests reproductibles

`npm run test:admin` : tests Auth simulés et PostgreSQL PGlite, dont autorisation, cookies/CSRF, renouvellement, transitions, expiration, conflits d’état, capacité, fermeture, horaires, réglages, rétention, permissions et révocation. Ils ne constituent pas une preuve de concurrence entre deux connexions PostgreSQL ; les validations Preview réelles sont documentées séparément après exécution.

Vérifier la fonction compilée avec `node scripts/verify-admin-build.mjs`. Exécuter également `npm run check`, `npm run test:checkout`, `npm run test:orders` et `npm run build`.

## Avant Production

Migration et autorisation d’un compte réel à approuver séparément. Valider l’authentification réelle, les parcours mobile/desktop et les transitions sur Preview, les pertes réseau, les mises à jour automatiques et la concurrence PostgreSQL réelle. Définir les conditions opérationnelles, la confidentialité et la conservation des journaux d’audit. Conserver commandes publiques et cron Production fermés jusqu’à validation explicite.

## Compte Test et avertissement Auth

Le propriétaire a créé puis confirmé le compte Auth demandé. Son UUID a été ajouté explicitement à admin_users, avec une trace admin_grant, uniquement sur Test. Aucun mot de passe transmis à l’agent.

Le contrôle Supabase signale maintenant `auth_leaked_password_protection` (WARN). L’option de rejet des mots de passe connus comme compromis est désactivée ; elle est disponible sur le plan Pro et supérieur selon [la documentation Supabase](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Aucun changement de forfait ou action payante effectué. Ce point reste à décider avant Production.

Trois demandes synthétiques de dashboard ont été préparées via la RPC métier dans Test : F-00000012 (acceptation), F-00000013 (refus), F-00000014 (expiration). Le service est refermé dans la même transaction avant commit et le verrou global reste fermé ; ces fixtures ne permettent aucune commande publique. Le numéro F-00000011 a été consommé par la séquence lors du test SQL annulé, sans commande persistante correspondante (comportement normal des séquences PostgreSQL).

## Correction du premier essai de connexion

Le premier formulaire était bloqué avant Supabase Auth par une incompatibilité entre `Referrer-Policy: no-referrer` et la vérification stricte Origin des formulaires natifs : un navigateur peut envoyer `Origin: null`. La politique est désormais `same-origin`, sans révéler les références aux sites tiers et sans accepter d’Origin nul. Le test de la fonction compilée vérifie cet en-tête et le passage du formulaire jusqu’à Auth. Après déploiement du commit 67fa18d, le test navigateur avec identifiants synthétiques a produit deux RPC de limitation 200 puis un vrai `/auth/v1/token` 400 dans Supabase Test. La connexion valide du propriétaire a ensuite réussi ; la session persiste entre les routes et les redéploiements Preview. Les erreurs CSRF et les indisponibilités ont désormais des messages distincts des mauvais identifiants.

## Parcours authentifié réel — reprise à 14:26, Europe/Paris

Le navigateur de validation a réutilisé la session réelle créée par le propriétaire, sans lecture du mot de passe ni des cookies HttpOnly. Les premières fixtures ont naturellement expiré pendant l’attente : elles sont conservées et ne sont pas réactivées. Trois nouvelles demandes via RPC Test : F-00000015 (cycle complet), F-00000016 (refus), F-00000017 (conflit). Leur arrivée automatique est visible sans Actualiser : trois nouvelles demandes et compteur à trois.

F-00000015 : pending → accepted → preparing → ready → completed depuis les boutons du navigateur, quatre traces d’audit en base. F-00000016 : rejected, une trace, visible dans l’historique. F-00000017 : deux vues authentifiées envoient Accepter ; une seule transition et une seule trace d’audit, l’autre vue affiche le conflit. Il s’agit de deux onglets partageant la même session Auth, sans prétendre avoir utilisé deux identités distinctes.

Les commandes expirées apparaissent sans action d’acceptation ; les demandes terminées et refusées sont accessibles dans l’historique. Un contrôle RPC sur PostgreSQL Test avec la vraie identité/session vérifie aussi le refus d’accepter F-00000014 expirée, de réduire la capacité sous les réservations et d’annuler un service avec F-00000017 acceptée. Ces refus sont exécutés dans une transaction annulée. L’autorisation de la même identité Auth est refusée lorsqu’on retire temporairement son attribution dans une transaction annulée, sans interrompre les autres connexions.

Le service du jour Test a été ouvert puis refermé avec confirmation, en conservant la commande acceptée. Le verrou général Preview et la Production restent fermés. La confirmation native du navigateur a bloqué son pilote ; elle a été remplacée par un dialog intégré, accessible au clavier, avec Annuler par défaut. La nouvelle confirmation est réellement utilisée sur Preview : annulation du service du jour refusée avec commande acceptée ; annulation réussie d’un service synthétique vide dédié au 31 octobre.

Horaires futurs : fermeture du 30 octobre changée de 21:30 à 21:45, quinze créneaux actifs générés, puis rétablie à 21:30, quatorze actifs. Les anciens créneaux sont conservés. Le créneau de 17:00 du 29 octobre affiche deux pizzas réservées après le refus de F-00000016 ; la réduction à deux est acceptée, celle à un refusée par la RPC. Aucun changement de planning Production.

Mobile 390 px : scrollWidth=clientWidth=390, boutons et navigation basse lisibles ; captures conservées hors dépôt. Aucune donnée personnelle réelle de client utilisée.

## Reprise du 30 octobre — réglages et renouvellement de session

Le premier enregistrement des réglages via PostgREST échouait avec SQLSTATE 21000, alors que l’appel SQL direct et PGlite réussissaient. La configuration Supabase contient `safeupdate` : l’UPDATE de la table à ligne unique n’avait pas de clause WHERE explicite. La migration `20261030051016_fix_admin_singleton_update.sql` ajoute `where singleton=true and admin_revision=cfg.admin_revision` et un contrôle de ligne modifiée. La protection Supabase reste active et les migrations déjà appliquées ne sont pas réécrites. Application uniquement à Test.

Après correction, depuis le vrai formulaire Preview : capacité par défaut 8 → 9, révision 0 → 1 et un événement d’audit ; capacité du créneau existant inchangée à 8. Une tentative de délai 30 → 31 est refusée avec le message métier des commandes en cours, sans incrément de révision. La capacité par défaut est ensuite rétablie à 8. Le contrôle local vérifie aussi qu’une erreur de sécurité PostgREST ferme l’opération sans révéler les détails SQL.

La session créée la veille a été renouvelée automatiquement : les journaux Supabase Test retournent un appel `grant_type=refresh_token` 200 le 30 octobre vers 06:11 Europe/Paris. Aucune lecture du jeton ni nouvelle saisie du mot de passe par l’agent.

## Indisponibilité réelle du backend et reprise

Le 30 octobre, FORNO_ADMIN_ENABLED est mis temporairement à false uniquement en Preview / codex/test-commandes, puis le commit b726af7 est déployé : dpl_8MtVWqvjkdDjFBWL34QhCPi1vHkb. L’onglet Réglages déjà ouvert reçoit le refus 503 via son polling : message « Connexion interrompue. Les données affichées peuvent être anciennes » et bouton Enregistrer désactivé, vérifié dans le DOM.

Le même flag Preview est remis à true et un déploiement Preview du même commit est créé, sans cible Production : dpl_6C2LheLixWXuRhcL2hQp5ssUs3sd. Le même onglet, sans navigation ni rechargement, revient automatiquement à « À jour » et le bouton est réactivé. La session reste valide. Le flag d’ouverture des commandes publiques n’est jamais activé.

Ce scénario teste une indisponibilité du backend, avec le même chemin de fermeture des actions qu’une erreur réseau. Il ne constitue pas un test de coupure Wi-Fi/4G réelle. Le son facultatif dépend de l’autorisation du navigateur ; aucun test d’audibilité matérielle ni de notifications push n’est revendiqué.

Contrôle final Test : 13 pizzas, 16 commandes synthétiques conservées, aucune pending encore valable, un utilisateur Auth et un administrateur autorisé ; les journaux d’audit ne contiennent ni champs client ni numéros de téléphone. Les deux crons Test restent en pause. Les valeurs de réglages sont rétablies à 30 minutes / 8 pizzas / 15 minutes, révision 2, avec deux événements d’audit de réglages.

Mobile : les vues Commandes, Planning et Réglages sont mesurées à 390 px sans débordement. Le dialog de confirmation est lisible ; Échap annule sans mutation et ramène le focus au bouton déclencheur. Les captures de test sont conservées hors dépôt.

Déconnexion réelle vérifiée en fin d’essai : le bouton revient au formulaire de connexion, Supabase Test ne conserve aucune session admin active et l’API `/api/admin/orders` retourne `UNAUTHORIZED`. Une navigation sur `/admin/` redirige à nouveau vers `/admin/login/`. Le compte reste autorisé, mais l’utilisateur devra se reconnecter ; le mot de passe n’a jamais été lu ni transmis au chat.

Livraison limitée à la branche `codex/test-commandes` et au Preview protégé. Production : zéro commande, zéro service autorisant les commandes, cron en pause, aucune table admin appliquée. Aucune promotion sur main et aucune modification des pages publiques.
