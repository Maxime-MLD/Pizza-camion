# Proposition d'intégration — brouillon local

Base : `main` ; branche proposée : `codex/production-preparation`.

Titre : Déployer le dashboard FORNO en gardant commandes et Push fermés

La Production utilise encore la version publique sans dashboard. Cette branche intègre les fonctionnalités validées de `codex/test-commandes` et les profils Production séparés : administration authentifiée, planning, capacités, PWA privée et infrastructure Push désactivée. Les routes publiques de commande restent fermées. Le design public est conservé ; aucun compte, abonnement ou commande Test n'est importé.

Les six migrations Admin/Push ont été appliquées et leurs empreintes vérifiées en Production ; un seul propriétaire confirmé a reçu l'autorisation explicite. Le build Vercel ne lance aucun SQL. Les cinq flags Production sont configurés : commandes=false, admin=true, validation=false, Push=false, Turnstile=real. Les crons restent en pause.

Validation de la candidature : 129 tests fonctionnels réussis, 11 régressions du décodeur MCP réussies, Astro/TypeScript sans diagnostic, build Production et handlers compilés vérifiés, scan de tout l'artefact sans ressource ni identité Test. La validité réelle des secrets serveur et la connexion du propriétaire seront contrôlées sur l'URL Production après accord ; les tests compilés utilisent un transport simulé. Le contrôle TODO échoue encore sur 240 occurrences, dont les contenus légaux/planning à finaliser avant ouverture commerciale.

L'intégration proposée est une avance rapide de `main` vers le commit exact approuvé, puis un nouveau build Production avec ses variables, sans promotion du Preview Test. Aucun déploiement ou publication de cette proposition n'a encore eu lieu. Le retour arrière cible le déploiement `dpl_2Vx6t2KCcLZDbE2rkok2TWfUBfDV` (commit `95a2b58`), sans retour arrière SQL.

Les contrôles réels de login, navigation, déconnexion et installation PWA restent à exécuter après déploiement. Ne pas déclarer le dashboard déployé avant validation de `https://pizza-two-bay.vercel.app/admin/login/`. L'accord préalable du propriétaire reste requis pour l'intégration et le déploiement ; il n'autorise aucune ouverture de commandes, de service, de cron ou de Push.
