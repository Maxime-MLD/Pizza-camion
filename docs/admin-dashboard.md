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

Jetons d’accès et de renouvellement uniquement dans des cookies `__Host-`, HttpOnly, Secure, SameSite=Strict, Path=/. Renouvellement côté serveur. Aucune clé Supabase, aucun jeton de session et aucune donnée client dans localStorage. Pas de client global partagé entre utilisateurs. La déconnexion renouvelle si nécessaire avant de révoquer la session locale Supabase, puis supprime les cookies.

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
| Local | 24 tests admin + 14 checkout + 33 commandes existantes | 71 réussis |
| Local | TypeScript, build Astro/Vercel, fonction compilée publique | Réussis, commandes publiques fermées |
| Fonction Vercel compilée | Pages admin anonymes, API anonymes, cookies, cache privé, CSRF | Réussis avec tout accès réseau interdit dans ce test |
| Supabase Test réel | Deux migrations admin, RLS, ACL et advisors | Appliquées ; aucun WARN/ERROR, INFO attendues pour tables privées sans politiques publiques |
| PostgreSQL Test réel | Autorisation/non-admin, cycle complet, conflit d’état, expiration, maintien de accepted après maintenance, 4 événements d’audit et révocation immédiate | Réussis dans une transaction intégralement annulée ; identités/session purement synthétiques non persistées, aucune connexion Auth simulée présentée comme réelle |
| Preview réel | Accès /admin sans session, formulaire de connexion et identifiants synthétiques invalides | Redirection et refus vérifiés, aucune donnée client révélée |
| Navigateur mobile | Formulaire de connexion à 390 px | Aucun débordement horizontal |
| Preview authentifié | Connexion réelle du premier compte, vues privées et actions depuis le navigateur | En attente de création du compte Auth Test par son propriétaire ; ne pas déclarer ces scénarios réussis |
| Concurrence admin réelle / réseau interrompu | Deux sessions administrateur, retour réseau et nouvelles commandes au polling | Restent à exécuter après connexion ; les tests locaux ne remplacent pas ces vérifications |

La migration complémentaire `20261029092544_harden_admin_settings_concurrency.sql` rend la vérification d’expiration atomique au moment de l’UPDATE et verrouille les services avant les réglages. Le changement du délai de préparation exige aussi que les services aient leurs commandes fermées, pour éviter une course avec le checkout. Aucun changement de la RPC du checkout n’a été nécessaire.

## Tests reproductibles

`npm run test:admin` : tests Auth simulés et PostgreSQL PGlite, dont autorisation, cookies/CSRF, renouvellement, transitions, expiration, conflits d’état, capacité, fermeture, horaires, réglages, rétention, permissions et révocation. Ils ne constituent pas une preuve de concurrence entre deux connexions PostgreSQL ; les validations Preview réelles sont documentées séparément après exécution.

Vérifier la fonction compilée avec `node scripts/verify-admin-build.mjs`. Exécuter également `npm run check`, `npm run test:checkout`, `npm run test:orders` et `npm run build`.

## Avant Production

Migration et autorisation d’un compte réel à approuver séparément. Valider l’authentification réelle, les parcours mobile/desktop et les transitions sur Preview, les pertes réseau, les mises à jour automatiques et la concurrence PostgreSQL réelle. Définir les conditions opérationnelles, la confidentialité et la conservation des journaux d’audit. Conserver commandes publiques et cron Production fermés jusqu’à validation explicite.
