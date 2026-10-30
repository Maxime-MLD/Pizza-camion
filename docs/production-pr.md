# Proposition de PR — brouillon local

Base : `main` ; branche proposée : `codex/production-preparation`.

Titre : Préparer l'administration, la PWA et les commandes FORNO pour la Production fermée

La Production utilise encore la version publique sans administration. Cette branche intègre les fonctionnalités validées de `codex/test-commandes` et prépare leur configuration Production : profils de déploiement séparés, dashboard privé, PWA, outbox Push et recette administrateur utilisant les validations de commande existantes. Les commandes publiques restent désactivées ; aucun service, cron, abonnement ou compte Test n'est transféré.

Les six migrations supplémentaires sont livrées dans un bundle transactionnel avec contrôle des migrations déjà appliquées. Leur application, la création du propriétaire Auth Production, le déploiement et les activations nécessitent les accords distincts prévus dans `production-readiness.md`. Les fichiers historiques de migration ne sont pas modifiés.

Validation : 129 tests réussis, Astro/TypeScript sans diagnostic, Deno check, builds Preview et Production, contrôles des handlers compilés et scan complet de l'artefact Production. Lecture seule Production : pages accessibles, API de commande fermée, zéro commande, cron en pause. Le hostname Cloudflare est confirmé ; le vrai jeton, le Push et le circuit complet Production restent à tester après accord. Le contrôle `check:todo` échoue encore et identifie notamment des contenus légaux/planning à compléter. Android reste non testé.

Ne pas fusionner ou promouvoir sans approbation explicite. Le plan de retour arrière conserve le schéma additif et les données, ferme les flags/services et permet de restaurer le déploiement public précédent. Cette proposition n'a pas été publiée et ne déclenche aucun déploiement distant.
