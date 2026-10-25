# MLD Signature Starter

Starter technique Astro pour la création de sites vitrines premium destinés aux artisans, PME et professions libérales.

## État actuel

Cette version inclut l'architecture technique, le socle générique du design system, la configuration centrale fortement typée, l'architecture multipage, les douze sections Signature composables, l'infrastructure SEO locale, le formulaire Web3Forms réutilisable, les templates de pages légales, un système d'animations GSAP opt-in et les fondations images/accessibilité. Les contenus remplaçables sont regroupés dans `src/config/` et `src/data/` avec des valeurs `TODO_`. Aucun design client ou animation de section n'est inclus.

## SEO technique

- Métadonnées globales et surcharges par page via `BaseLayout`
- Données structurées `WebSite`, `LocalBusiness` ou `Organization`, `WebPage` et breadcrumbs
- Exclusion automatique des valeurs vides ou `TODO_` du JSON-LD
- Sitemap XML via `@astrojs/sitemap`
- Routes statiques générées pour `robots.txt` et le manifest
- Images sociales et icônes placeholders valides à remplacer avant livraison

## Formulaire de contact

- Champs visibles et obligatoires configurables dans `src/config/form.config.ts`
- Envoi asynchrone vers Web3Forms avec états de chargement, succès et erreur
- Clé publique fournie par `PUBLIC_WEB3FORMS_ACCESS_KEY`
- hCaptcha optionnel contrôlé par `featuresConfig.captcha`
- Page `/merci/` prête pour un futur suivi de conversion, sans analytics installé

## Pages légales

- Mentions légales alimentées par `business.config.ts` et `legal.config.ts`
- Politique de confidentialité synchronisée avec les champs et fonctionnalités activés
- Marqueurs `TODO_LEGAL_REVIEW_BEFORE_PRODUCTION` obligatoires avant livraison
- Aucun bandeau cookie activé par défaut
- Ces templates techniques ne constituent pas un conseil juridique

## Prérequis

- Node.js 22.12.0 ou supérieur
- npm 9.6.5 ou supérieur

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm install` | Installe les dépendances à partir de `package.json` et `package-lock.json`. |
| `npm run dev` | Démarre le serveur Astro de développement. |
| `npm run start` | Alias de `npm run dev`. |
| `npm run check` | Exécute les diagnostics Astro et TypeScript stricts. |
| `npm run typecheck` | Alias explicite de `npm run check`. |
| `npm run build` | Génère le site statique dans `dist/`. |
| `npm run preview` | Sert localement le dernier build. |
| `npm run check:todo` | Bloque la livraison si un placeholder critique subsiste. |
| `npm run validate:production` | Enchaîne le contrôle des placeholders, Astro check et le build. |

`npm run build` reste utilisable pendant la création avec les placeholders. `npm run check:todo` et `npm run validate:production` sont volontairement en échec tant que le starter contient des valeurs ou fichiers de remplacement.

## Stack

- Astro en génération statique
- TypeScript strict
- Tailwind CSS 4 via le plugin Vite officiel
- GSAP et ScrollTrigger, enregistrés explicitement côté navigateur
- npm
- déploiement statique compatible Vercel sans adaptateur

## Conventions

Les règles de contribution se trouvent dans `AGENTS.md`. Toute donnée propre à un futur client doit être centralisée dans `src/config/` ou `src/data/` et identifiée par un préfixe `TODO_` tant qu'elle n'est pas renseignée.

## Animations GSAP

Le système est volontairement désactivé par défaut. Pour un client, activer `animations` dans `src/config/features.config.ts`, puis initialiser uniquement les groupes réellement utiles. Les primitives disponibles dans `src/scripts/motion-primitives.ts` sont `fadeReveal`, `revealVertical`, `staggerReveal`, `imageReveal`, `textReveal`, `parallax`, `horizontalScroll` et `pinSection`.

```astro
<section id="services">
  <!-- Le contenu reste visible tant que JavaScript ou les animations sont désactivés. -->
  <article data-motion="service-item">TODO_SERVICE</article>
</section>

<script>
  import { initMotion } from "../scripts/motion";
  import { staggerReveal } from "../scripts/motion-primitives";

  initMotion(
    "home-services",
    ({ scope, select }) => {
      staggerReveal(select('[data-motion="service-item"]'), {
        trigger: scope,
      });
    },
    { scope: "#services" },
  );
</script>
```

Principes d'utilisation :

- ne jamais masquer le contenu initialement en CSS ; les primitives posent leur état de départ après leur chargement ;
- utiliser un identifiant stable et unique par groupe ; une nouvelle initialisation avec le même identifiant nettoie l'ancienne ;
- garder les animations dans `initMotion()` afin que `gsap.context()` et `gsap.matchMedia()` puissent restaurer styles et ScrollTriggers via `destroy()` ;
- réserver `data-motion` aux éléments animés pour garantir leur remise en visibilité lorsque le mouvement est désactivé ;
- activer séparément `heavyAnimations` pour le parallax, le pin et le défilement horizontal ; ces primitives restent neutralisées sur mobile, pointeur grossier et `prefers-reduced-motion: reduce` ;
- appeler `controller.refresh()` seulement après un changement de géométrie réel, par exemple après le chargement tardif d'un média ;
- appeler `controller.destroy()`, `destroyMotion(id)` ou `destroyAllMotion()` avant de retirer le DOM concerné. Aucun listener de navigation global n'est ajouté automatiquement.

`textReveal` anime uniquement des fragments déjà balisés : aucune découpe automatique du texte et aucun plugin supplémentaire ne sont imposés. `externalSmoothScroll` est un point d'extension désactivé ; le starter n'installe ni Lenis ni moteur de scroll externe.

## Images

Les photos de contenu doivent être placées dans `src/assets/`, importées statiquement et rendues avec `ResponsiveImage.astro`. Ce composant s'appuie sur `Picture` d'Astro pour connaître les dimensions, préserver le ratio, générer des sources AVIF/WebP et produire des variantes responsive.

```astro
---
import ResponsiveImage from "../components/ui/ResponsiveImage.astro";
import heroImage from "../assets/TODO_REPLACE_CLIENT_HERO.jpg";
---

<ResponsiveImage
  src={heroImage}
  alt="TODO_HERO_IMAGE_ALT"
  layout="full-width"
  priority
/>
```

Règles :

- utiliser `priority` uniquement pour l'image LCP principale ; Astro génère alors `loading="eager"`, `decoding="sync"` et `fetchpriority="high"` ;
- ne jamais utiliser `priority` pour les images hors écran, qui restent en lazy loading natif ;
- fournir un `alt` descriptif, ou utiliser ensemble `decorative` et `alt=""` ; le composant bloque le build en cas de combinaison incohérente ;
- choisir `layout="full-width"` pour un visuel pleine largeur, `constrained` pour une image de contenu et `fixed` uniquement pour une dimension réellement fixe ;
- préciser `sizes` lorsque la largeur visuelle diffère fortement du comportement du layout, notamment dans une grille ;
- réserver `public/images/` aux fichiers déjà optimisés devant être servis sans transformation. Une image publique utilisée avec un élément HTML natif doit toujours avoir `width`, `height`, `alt`, `loading` et `decoding` explicites ;
- viser moins de 200 Ko pour un Hero, 100 Ko pour une image de contenu et 50 Ko pour une miniature lorsque la qualité visuelle le permet.

`src/data/projects.ts` attend un import d'image Astro à la place de `TODO_PROJECT_IMAGE_IMPORT`. Aucun faux fichier image n'est fourni.

## Polices

Le starter utilise uniquement des fallbacks système. Le fichier `src/styles/fonts.css` contient un exemple inactif pour une police locale WOFF2 avec `font-display: swap`.

- placer uniquement les polices possédant une licence adaptée dans `public/fonts/` ;
- préférer une police variable ou un nombre réduit de graisses ;
- mettre à jour les tokens `--font-display` et `--font-body` ;
- ne précharger qu'un fichier réellement critique et visible immédiatement, via le slot `head` de `BaseLayout` ; aucun preload n'est imposé par le starter.

## Accessibilité et liens

Les layouts fournissent les landmarks, le skip-link et le focus visible. Chaque page template possède un seul H1 logique. Le menu mobile repose sur l'élément natif `dialog`, le formulaire expose ses erreurs aux technologies d'assistance et le mode mouvement réduit neutralise les effets non essentiels.

Les helpers `createTelHref()` et `createMailtoHref()` de `src/utils/links.ts` nettoient les valeurs configurées et n'émettent aucun lien tant qu'un `TODO_` subsiste. Tout lien ouvert dans un nouvel onglet doit conserver `rel="noopener noreferrer"` ; le composant `Button` l'ajoute automatiquement lorsque `target="_blank"`.

## Création d'un nouveau client

1. Dupliquer ce template dans un nouveau repository sans conserver l'historique ou les données d'un autre client.
2. Renommer le repository, le dossier et la propriété `name` de `package.json`.
3. Installer les dépendances avec `npm install`.
4. Renseigner l'identité, les coordonnées, la zone d'intervention, les horaires et les informations légales dans `src/config/business.config.ts`.
5. Renseigner le domaine canonique, la langue, les icônes, les images sociales et le manifest dans `src/config/site.config.ts`.
6. Régler les titres, descriptions, robots, Open Graph, Twitter et le type Schema.org dans `src/config/seo.config.ts`.
7. Choisir la navigation dans `src/config/navigation.config.ts` et activer uniquement les options nécessaires dans `src/config/features.config.ts`.
8. Remplacer les couleurs, dimensions, rayons et familles génériques dans `src/styles/tokens.css`.
9. Installer uniquement les fichiers de police locaux licenciés nécessaires, les déclarer dans `src/styles/fonts.css` et limiter les graisses.
10. Remplacer tous les favicons, icônes de manifest et visuels sociaux de `public/icons/` et `public/social/`.
11. Remplir les collections de `src/data/` avec des contenus réels et autorisés, puis retirer les entrées ou sections inutiles.
12. Créer le design client dans les composants Astro existants sans réunir Navbar, Hero ou Footer.
13. Ajouter seulement les animations spécifiques validées, via `initMotion()` et ses primitives nettoyables.
14. Copier `.env.example` vers `.env`, renseigner la clé publique Web3Forms et tester réellement tous les états du formulaire.
15. Adapter `src/config/legal.config.ts`, les mentions légales et la politique de confidentialité, puis obtenir la validation juridique appropriée.
16. Tester les routes, le responsive, les navigateurs, le partage social, les données structurées, la performance et l'accessibilité selon `PRODUCTION_CHECKLIST.md`.
17. Définir `PRODUCTION_FORBIDDEN_TERMS` avec les anciennes données sensibles à rechercher, puis exécuter `npm run validate:production` jusqu'à succès.
18. Déployer sur Vercel, configurer les variables d'environnement et le domaine, puis refaire les contrôles sur l'URL publique en HTTPS.

## Contrôle de livraison

`npm run check:todo` inspecte les fichiers sources, les configurations, les variables locales et les noms de fichiers publics. Il recherche les marqueurs critiques ainsi que les domaines réservés `.example`, `example.com`, `example.org` et `example.net`, mais ignore `node_modules`, `dist`, `.git`, les documents Markdown, `.env.example`, le lockfile et son propre code.

Pour rechercher aussi les données d'un ancien client, fournir une liste séparée par des points-virgules dans `PRODUCTION_FORBIDDEN_TERMS`. Les valeurs elles-mêmes ne sont jamais affichées dans le rapport :

```powershell
$env:PRODUCTION_FORBIDDEN_TERMS="Ancien nom;ancien-domaine.fr;0102030405"
npm run validate:production
```

La validation de production s'exécute dans cet ordre : contrôle des placeholders, `astro check`, puis build statique. La checklist finale détaillée se trouve dans `PRODUCTION_CHECKLIST.md`.

## Déploiement Vercel

Le rendu statique Astro est directement détecté par Vercel. La commande de build est `npm run build` et le dossier de sortie est `dist/`. Aucun adaptateur serveur n'est nécessaire à ce stade.
