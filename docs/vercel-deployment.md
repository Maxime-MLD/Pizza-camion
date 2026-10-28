# FORNO — correction du déploiement Vercel

Le 28 octobre 2026, `https://pizza-two-bay.vercel.app/` répondait HTTP 404 avec `x-vercel-error: NOT_FOUND`. Le déploiement public était marqué READY, associé au dépôt `Maxime-MLD/Pizza-camion`, branche `main`, commit `b42ddbe28c72f071aee045e16b86307117f86b27`.

Le code de ce commit ciblait exclusivement Cloudflare : adapter `@astrojs/cloudflare`, script de build qui assemble un Worker Sites et imports `cloudflare:workers` dans les deux endpoints. Aucun adapter Vercel n’était installé et aucun `vercel.json` n’existait. Les pages `src/pages/index.astro` et `commander.astro` étaient bien présentes. Il n’y avait ni `base`, ni réécriture, ni redirection expliquant une disparition volontaire des pages.

La cause corrigée dans le code est l’incompatibilité de la cible de build et du runtime avec Vercel. Les logs distants ont ensuite confirmé `adapter: @astrojs/cloudflare`, un build dans `/vercel/path0/dist/` et le script Worker Sites. Le build réussissait, mais ne produisait pas la sortie de fonctions Vercel attendue. Les réglages du projet ont été remis au framework Astro, à `npm run build` et aux répertoires racine/sortie par défaut. Les protections d’accès Vercel n’ont pas été modifiées.

## Configuration corrigée

- `@astrojs/vercel` **11.0.16** installé et épinglé, compatible avec Astro **7.4.2** (peer `astro ^7.0.0`). Les dépendances transitives vulnérables ont reçu des overrides correctifs compatibles, sans changer de majeure.
- `npm run build` utilise désormais l’adapter Vercel par défaut et produit `.vercel/output/config.json`, les pages sous `.vercel/output/static` et la fonction Node `_render.func` pour `/api/orders` et `/api/pickup-slots`.
- `output: static` est conservé. Les pages publiques sont prérendues et les endpoints gardent `prerender=false`. Pas de conversion inutile des pages en SSR.
- Les images restent optimisées au build avec le service Astro existant (`imageService: false` pour ne pas activer le service Vercel d’images à la demande).
- `vercel.json` déclare seulement le framework `astro` et `npm run build`. Il n’impose aucun répertoire statique, aucune réécriture globale et aucun changement de domaine, d’accès ou de protection.
- Les secrets passent par `astro:env/server` / `getSecret`, fournis au runtime par l’adapter. Les endpoints n’importent plus un runtime Cloudflare dans Vercel.
- Un verrou serveur `FORNO_ORDERS_ENABLED` est fermé par défaut. Sans valeur explicite `true`, les API répondent HTTP 503 `ORDERS_DISABLED` avant tout appel Supabase. Garder cette variable absente ou `false` tant que les tests d’intégration réels ne sont pas validés. La config des secrets seule ne peut pas activer les commandes.
- La cible historique Sites est conservée via `npm run build:sites`. Elle sélectionne explicitement `FORNO_DEPLOY_TARGET=sites`, construit le Worker et prépare son manifeste Sites. Pour publier sur Sites à l’avenir, utiliser cette commande dédiée plutôt que le build Vercel par défaut.

Aucune migration Supabase, modification de base distante, création de commande ou suppression de fonctionnalité n’est nécessaire pour cette correction. Le design et le contenu des sections publiques restent identiques. L’URL canonique SEO historique a été conservée : elle ne constitue pas une redirection HTTP et n’est pas la cause de la 404.

## Réglages à vérifier sur le projet Vercel existant `pizza`

1. Framework Preset : **Astro**.
2. Root Directory : racine du dépôt contenant `package.json`, `astro.config.mjs` et `src/pages/index.astro`.
3. Build Command : **npm run build**.
4. Output Directory : **valeur par défaut du framework**, sans override `public`, `dist/client` ou `dist/server`. L’adapter fournit le Build Output API dans `.vercel/output`.
5. Node.js : **24.x**, déjà indiqué par le projet Vercel consulté ; le build local génère bien une fonction `nodejs24.x`.
6. Ne pas définir `FORNO_DEPLOY_TARGET=sites` dans Vercel. Garder `FORNO_ORDERS_ENABLED=false`.
7. Déployer le commit corrigé dans le projet existant, sans en créer un nouveau. Vérifier les logs de build et les URLs de production après déploiement. La 404 distante ne doit pas être considérée comme résolue tant que cette version n’est pas publiée et vérifiée.

Les clés Supabase et Turnstile restent dans les variables serveur Vercel, sans préfixe PUBLIC_. Les paramètres `.env` locaux sont ignorés par Git ; aucun fichier `.env` ou `.dev.vars` n’est inclus dans l’artifact vérifié. Aucun secret ne doit être ajouté à `vercel.json`.

## Vérifications reproductibles

```sh
npm run test:checkout
npm run test:orders
npm run check
npm run build
node scripts/verify-vercel-build.mjs
```

Le dernier script vérifie les deux pages statiques, les règles des API, le runtime Node et invoque **la fonction Vercel compilée**, avec commandes forcées hors service. Il exige une réponse JSON 503 `ORDERS_DISABLED` pour GET pickup-slots, GET orders et POST orders ; une origine étrangère reste refusée. Il recherche les fichiers d’environnement et les secrets connus dans l’artifact sans afficher leurs valeurs. Aucun appel à une base Supabase réelle n’est effectué.

Le build `npm run build:sites` a également été vérifié. Il n’a pas été publié à la place du site Vercel.

Sources : [adapter officiel Astro Vercel](https://docs.astro.build/en/guides/integrations-guide/vercel/), [secrets runtime indépendants de l’adapter](https://docs.astro.build/en/reference/modules/astro-env/), [diagnostic Vercel des déploiements en 404](https://vercel.com/kb/guide/why-is-my-deployed-project-giving-404).
