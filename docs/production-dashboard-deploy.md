# FORNO — Étape 16 : candidature de déploiement Admin fermé

Date : 30 octobre 2026. **Préparation vérifiée ; fusion et déploiement en attente de l'accord explicite du propriétaire.** Le dashboard n'est pas annoncé comme déployé. Aucune nouvelle migration, commande ou ressource payante créée pendant cette étape.

## Source et intégration proposée

| Référence vérifiée après fetch | Commit |
|---|---|
| `origin/main`, actuellement en Production | `95a2b587fdd2a4454d6a2096d8f543a67ef55ed8` |
| `origin/codex/test-commandes`, validation isolée | `d5fea5b61bbdf079b153b751db02fcaba554854e` |
| Base fonctionnelle de `codex/production-preparation` | `c09b4d7429c5f38cf2617b2d3934366eea86640c` |

`main` est ancêtre de la branche Test validée, elle-même ancêtre de la candidature. La préparation contient 24 commits au-dessus du `main` actuel, avant le commit final de documentation/tests opérateur de cette étape. Le commit exact proposé à l'approbation sera celui annoncé à la fin de la préparation ; aucune modification fonctionnelle ne sera ajoutée après approbation sans nouvelle vérification.

Intégration recommandée : avancer `main` vers ce commit exact, sans force et sans réécriture de l'historique. Si `origin/main` a changé au moment de l'accord, arrêter pour revoir l'écart. Le build Git Production doit partir de ce commit et des variables Production. Ne pas promouvoir l'alias ou le build Preview Test.

Les différences fonctionnelles par rapport à `main` sont l'administration, les sessions/CSRF, la PWA, l'infrastructure Push, le durcissement des commandes et les profils d'environnement. Par rapport à la branche Test, les profils et le worker ne dépendent plus de la seule base Test ; des routes de recette administrateur existent mais sont **désactivées** dans la configuration livrée. Navbar, Hero, villages, photographie, catalogue, couleurs et styles publics restent identiques. Les changements checkout sont techniques (choix de transport et stockage distinct pour la recette privée), sans modification du design. Le canonical pointe sur le domaine actuel.

## Précontrôle Supabase réel

Projet exclusif `forno-pizza` / `fqjkkjvrklpzhwmswlsy`. Marqueur Production présent, aucun marqueur Test. Les dix migrations suivies, dont les six ajouts Admin/Push, correspondent aux noms, versions et SHA-256 du manifeste approuvé. Pas de nouvel appel d'écriture SQL pendant l'étape 16.

Un seul administrateur, UUID `7ae555de-0fb3-4b82-986c-c37183bba7ce`, actif et relié à un compte Auth dont l'e-mail est confirmé. Ce compte a été créé en Production et autorisé lors de l'étape précédente ; aucune copie d'identité ou de session Test.

Comptages réels : 13 pizzas, 30 services, 440 créneaux, **0 commande, 0 service ouvert et 0 abonnement Push**. Push désactivé, aucune URL worker/clé VAPID/clé worker préparée. `forno-order-maintenance` et `forno-push-outbox` restent en pause, chaque minute, propriétaire postgres. Aucun RLS désactivé et aucune permission d'exécution navigateur sur les RPC publiques FORNO.

## Configuration Vercel réellement enregistrée

Projet `pizza`, ID `prj_ai4WQvWWbtzhfDRCO6Tg9iAqOS8v`, équipe `team_y9ZVHnbOPhjVZc0qYi1QfIL6`. Preset Astro et Node 24.x. Le déploiement actif reste `dpl_2Vx6t2KCcLZDbE2rkok2TWfUBfDV`, READY, branche main/commit `95a2b58`.

Les cinq variables non secrètes suivantes ont été créées dans la portée **Production uniquement**, puis relues et comparées :

| Variable | Valeur vérifiée |
|---|---|
| `FORNO_ORDERS_ENABLED` | `false` |
| `FORNO_ADMIN_ENABLED` | `true` |
| `FORNO_VALIDATION_ENABLED` | `false` |
| `FORNO_PUSH_ENABLED` | `false` |
| `FORNO_TURNSTILE_MODE` | `real` |

Elles seront prises en compte par le prochain build Production autorisé. L'ajout de variables ne redéploie pas le site courant. Les neuf variables Preview gardent leurs identifiants, portées, branche et valeurs non secrètes vérifiées. Les cinq secrets Production préexistants gardent leurs identifiants/types/portées : `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `ORDER_RATE_LIMIT_SALT`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`. Aucun n'a été déchiffré, remplacé ou affiché.

**Limite de vérification avant déploiement :** présence et portée des secrets confirmées, mais pas leur valeur ou validité effective. Le profil serveur n'accepte que l'URL du projet Production ; une erreur de correspondance doit échouer fermé. La clé Supabase sera validée par la connexion réelle et les lectures du dashboard après déploiement. Le domaine du widget réel Turnstile a été confirmé lors de l'étape 14 ; la correspondance de la paire injectée et la validation d'un vrai jeton restent à contrôler lors d'une recette privée autorisée ultérieure. Le dashboard ne nécessite pas d'ouvrir le tunnel de commande pour tester son Auth.

La protection Vercel existante (`all_except_custom_domains`) est conservée. Ne pas la désactiver pour l'automatisation. Le `vercel.json` impose Astro, `npm run build` et les en-têtes SW/manifest ; le build ne lance aucune migration, seed ou bootstrap Push. Le SW reste limité à `/admin/` et ne met pas les réponses privées en cache. Ne pas remplacer la sortie Vercel par un simple dossier statique `dist`.

## Vérifications locales exécutées sur la candidature

| Contrôle | Résultat |
|---|---|
| Checkout | 14 tests réussis |
| Commandes | 33 tests réussis |
| Administrateur | 26 tests réussis |
| Push / PWA | 36 tests réussis |
| Profils et SQL Production simulé | 20 tests réussis |
| Total fonctionnel demandé | **129 tests, zéro échec** |
| Décodeur des réponses MCP | **11 tests supplémentaires, zéro échec** |
| Astro/TypeScript | 179 fichiers, zéro erreur/avertissement/hint |
| `npm run build:production` | Réussi, artefact `.vercel/output` généré |
| `verify-vercel-build.mjs` | Pages publiques présentes, APIs fermées, runtime et routage vérifiés |
| `verify-admin-build.mjs --production` | Handler compilé : routes privées, cookies Secure/HttpOnly/Lax, CSRF et no-store vérifiés |
| `verify-production-build.mjs` | Scan intégral sans ressource/identité Test ; validation privée protégée ; API publique fermée même avec session administrateur |
| `npm run check:todo` | **Échec existant : 240 occurrences brutes** |

Les contrôles compilés utilisent un transport simulé, sans clé ou appel réseau réel : ils ne prouvent pas la connexion du compte Production. Les tests SQL locaux utilisent PGlite et ne sont pas une exécution distante. Les traces `LOGIN_FAILED` attendues dans le smoke test correspondent à ses scénarios négatifs synthétiques.

Le contrôle TODO reste actif et non contourné. Il inclut des marqueurs intentionnels de tests/starter et des contenus réellement à compléter (mentions/confidentialité, planning/adresses, deux tarifs, image temporaire). Le site public n'est pas modifié pour cette étape ; ces points restent à finaliser avant ouverture commerciale. `validate:production` complet n'est donc pas annoncé comme réussi. La demande d'approbation concerne le dashboard privé et des commandes maintenues fermées.

## Accord nécessaire et contrôles après déploiement

L'accord demandé devra nommer le commit exact à intégrer dans `main` et à construire en Production, tout en conservant les cinq valeurs ci-dessus. L'approbation ne couvrira aucune migration, commande synthétique, ouverture de service, cron, Push ou activation de recette privée.

Après accord seulement :

1. Recontrôler le HEAD distant de main et les flags. Publier l'intégration en avance rapide et suivre le nouveau build Production. Vérifier l'ID/commit/cible READY et l'alias `pizza-two-bay.vercel.app` ; ne pas annoncer un succès à partir du seul statut de build.
2. Tester le site public et `/commander/`, puis `/admin/login/` sur le domaine réel. Sans session, pages admin → login et APIs admin → 401 ; aucune PII dans une erreur ou un cache public. Vérifier refus CSRF et caches privés, sans créer de commande.
3. Laisser le propriétaire se connecter directement dans le formulaire Production ; ne demander, saisir, lire ou afficher aucun mot de passe. Après sa confirmation, vérifier Commandes, Planning et Réglages : données exclusivement Production, zéro commande Test, services fermés et ouverture verrouillée.
4. Vérifier les flags recette/Push désactivés : routes privées de validation indisponibles et aucune souscription ou permission de notification demandée. Ne pas cliquer sur une action modifiant planning/capacité ou ouvrant un service.
5. Contrôler manifest, icônes, worker et scope `/admin/`, l'absence de cache privé et le comportement de déconnexion. Faire vérifier l'installation réelle sur l'iPhone du propriétaire ; distinguer les checks techniques d'une installation matérielle confirmée. Android reste à tester lorsqu'un appareil est disponible.
6. Vérifier de nouveau `/api/pickup-slots` et POST `/api/orders` → 503 `ORDERS_DISABLED`, DB sans nouveau service ouvert, abonnement ou commande, deux crons en pause. Consulter les erreurs runtime sans publier de secrets ou données personnelles. Produire ensuite seulement le rapport de déploiement réel et ses limites.

## Retour arrière proposé

Déploiement de référence conservé : **`dpl_2Vx6t2KCcLZDbE2rkok2TWfUBfDV`**, commit **`95a2b587fdd2a4454d6a2096d8f543a67ef55ed8`**. Si le nouveau dashboard échoue : garder commandes/validation/Push false, fermer l'accès admin si nécessaire (`FORNO_ADMIN_ENABLED=false` pour un nouveau build), puis restaurer le déploiement de référence selon ce plan approuvé. Une restauration Vercel peut suspendre l'auto-affectation des prochains déploiements : contrôler ce réglage avant toute livraison suivante.

Aucun down/reset SQL, aucune suppression de commande/utilisateur/audit, aucune révocation implicite du propriétaire et aucune rotation VAPID. Le schéma additif reste compatible avec le site public précédent. Après rollback, vérifier alias, pages publiques, API fermée, crons en pause et comptages conservés. Toute modification de la branche main après intégration devra être traitée séparément, sans force push.
