# Checklist de livraison — MLD Signature Starter

Cette checklist technique ne remplace pas une validation juridique, métier ou éditoriale. La livraison est bloquée tant que `npm run validate:production` échoue.

## Identité et marque

- [ ] Nom commercial définitif renseigné.
- [ ] Raison sociale et forme juridique vérifiées.
- [ ] Nom du dirigeant ou responsable validé.
- [ ] Activité et description courte adaptées au client.
- [ ] Logo définitif installé dans tous ses usages.
- [ ] Favicon définitif vérifié dans le navigateur.
- [ ] Couleurs de marque remplacées dans les tokens et contrôlées en contraste.
- [ ] Polices définitives licenciées, limitées aux graisses utiles et testées avec leurs fallbacks.
- [ ] Aucun nom, logo, slogan ou asset provenant d'un ancien client.

## Contact et entreprise

- [ ] Téléphone affiché correct.
- [ ] Téléphone normalisé testé avec le lien `tel:`.
- [ ] E-mail vérifié et lien `mailto:` testé.
- [ ] Adresse, code postal, ville, région et pays vérifiés.
- [ ] Coordonnées GPS vérifiées si utilisées.
- [ ] Horaires vérifiés si affichés.
- [ ] Zone principale, rayon et villes d'intervention validés.
- [ ] Formulaire configuré avec les champs réellement nécessaires.
- [ ] `PUBLIC_WEB3FORMS_ACCESS_KEY` configurée dans Vercel, sans secret privé dans le frontend.
- [ ] hCaptcha configuré et activé uniquement s'il est requis.

## SEO

- [ ] Title unique et pertinent sur chaque page indexable.
- [ ] Meta description unique sur chaque page indexable.
- [ ] Domaine et URL canonique définitifs.
- [ ] Canonical de chaque page vérifiée dans le HTML généré.
- [ ] Open Graph : titre, description, URL, type et image définitifs.
- [ ] Twitter/social card : titre, description et image définitifs.
- [ ] Sitemap généré, accessible et limité aux URL indexables.
- [ ] `robots.txt` accessible et lié au bon sitemap.
- [ ] Robots `index/follow` ou `noindex/nofollow` vérifiés page par page.
- [ ] JSON-LD valide : WebSite, WebPage et Organization/LocalBusiness selon le projet.
- [ ] Nom, téléphone, adresse, ville, région, activité et zone d'intervention cohérents dans le Schema.
- [ ] Breadcrumbs structurés vérifiés sur les pages internes.
- [ ] Test Google Rich Results effectué lorsque le type de données structurées est éligible.

## Assets sociaux et icônes

- [ ] Image OG définitive en 1200 × 630 px.
- [ ] Image Twitter/sociale définitive en 1200 × 630 px.
- [ ] Aperçu réel testé sur au moins une plateforme de partage.
- [ ] Apple touch icon définitive en 180 × 180 px.
- [ ] Icône manifest 192 × 192 px valide.
- [ ] Icône manifest 512 × 512 px valide.
- [ ] Favicon SVG et fallback PNG valides.
- [ ] Aucun asset placeholder ou mauvais visuel client dans `public/` et `src/assets/`.

## Légal et confidentialité

- [ ] Mentions légales relues et validées pour le statut réel du client.
- [ ] Politique de confidentialité relue et adaptée aux traitements réels.
- [ ] SIREN et SIRET vérifiés.
- [ ] Numéro de TVA vérifié ou retiré s'il n'est pas applicable.
- [ ] Responsable de publication vérifié.
- [ ] Coordonnées et mentions de l'hébergeur vérifiées à la date de livraison.
- [ ] Web3Forms, Vercel, captcha, analytics et autres prestataires tiers déclarés si utilisés.
- [ ] Durées de conservation, base légale et contact d'exercice des droits validés.
- [ ] Bandeau cookies activé uniquement si des traceurs non essentiels l'exigent.
- [ ] Date de dernière mise à jour renseignée.

## Responsive

- [ ] Test à 320 px.
- [ ] Test à 375 px.
- [ ] Test à 768 px.
- [ ] Test à 1024 px.
- [ ] Test à 1440 px.
- [ ] Test sur écran ultrawide.
- [ ] Aucun overflow horizontal, texte coupé ou contrôle inaccessible.
- [ ] Images, grilles, tableaux et formulaires restent utilisables à chaque largeur.

## Navigateurs et appareils

- [ ] Chrome desktop.
- [ ] Safari desktop.
- [ ] Firefox desktop.
- [ ] Mobile Safari sur iPhone/iPad réel ou émulation fiable.
- [ ] Chrome Android sur appareil réel ou émulation fiable.
- [ ] Navigation clavier vérifiée dans chaque navigateur desktop pris en charge.

## UX et parcours

- [ ] Navbar indépendante du Hero sur toutes les pages.
- [ ] Menu desktop et menu mobile fonctionnels.
- [ ] Ouverture, fermeture, Échap et restitution du focus du menu mobile testés.
- [ ] Tous les liens internes, externes, téléphone et e-mail testés.
- [ ] Les liens externes ouverts dans un nouvel onglet utilisent une relation sécurisée.
- [ ] Boutons et états désactivés cohérents.
- [ ] Ancres accessibles et non masquées par une navigation sticky.
- [ ] Formulaire testé avec validation invalide, chargement, succès et erreur réseau.
- [ ] Double envoi impossible.
- [ ] Message de succès et page `/merci/` testés.
- [ ] Page 404 testée avec une URL inexistante.

## Performance

- [ ] Images de contenu importées depuis `src/assets/` et optimisées par Astro lorsque pertinent.
- [ ] Dimensions, `srcset`, `sizes`, formats et textes alternatifs vérifiés.
- [ ] Image LCP non lazy-loadée et seule image réellement prioritaire.
- [ ] Images hors écran en lazy loading natif.
- [ ] Poids des images contrôlé, notamment Hero, projets et témoignages.
- [ ] Polices locales compressées, graisses limitées et preload justifié.
- [ ] LCP, CLS et INP contrôlés sur mobile.
- [ ] Aucun JavaScript ou composant hydraté sans nécessité.
- [ ] Animations lourdes réduites ou désactivées sur mobile.
- [ ] `prefers-reduced-motion` testé.
- [ ] Lighthouse exécuté en production ou preview représentative.

## Accessibilité

- [ ] Parcours complet réalisable au clavier.
- [ ] Focus toujours visible et ordre de tabulation logique.
- [ ] Skip-link testé.
- [ ] Chaque image informative possède un `alt` utile ; chaque image décorative utilise `alt=""`.
- [ ] Un seul H1 logique par page.
- [ ] Hiérarchie des headings cohérente sans niveau utilisé uniquement pour le style.
- [ ] Landmarks, labels, noms accessibles et attributs ARIA vérifiés.
- [ ] Contrastes texte, contrôles et focus vérifiés.
- [ ] Erreurs du formulaire annoncées et associées aux champs.
- [ ] Zoom à 200 % et mouvement réduit testés.

## Vercel et domaine

- [ ] Projet Vercel relié au bon repository et au bon compte.
- [ ] Variables d'environnement configurées dans le bon environnement.
- [ ] Build command et dossier de sortie vérifiés.
- [ ] Build de production réussi sur Vercel.
- [ ] Domaine définitif relié au bon projet.
- [ ] HTTPS actif sans erreur de certificat.
- [ ] Domaine principal et variante `www` cohérents.
- [ ] Redirections HTTP/HTTPS, `www`/non-`www` et anciennes URL configurées si nécessaire.
- [ ] Canonical, sitemap, robots et manifest utilisent le domaine final.

## Contrôle final

- [ ] Rechercher l'ancien nom client dans tout le repository.
- [ ] Rechercher l'ancien domaine et toutes ses variantes.
- [ ] Rechercher l'ancien téléphone, avec et sans espaces.
- [ ] Rechercher l'ancienne ville et l'ancienne adresse.
- [ ] Exécuter `npm run check:todo`.
- [ ] Exécuter `npm run validate:production` avec succès.
- [ ] Tester un envoi réel du formulaire vers le bon destinataire.
- [ ] Tester le partage social avec les assets de production.
- [ ] Vérifier les données structurées avec Google Rich Results lorsque applicable.
- [ ] Vérifier qu'aucune donnée privée ni clé secrète n'est versionnée.
- [ ] Effectuer une dernière relecture humaine avant déploiement.
