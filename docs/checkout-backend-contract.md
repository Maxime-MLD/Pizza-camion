# Tunnel de préparation côté client

Le parcours `/commander/` fonctionne sans React, sans endpoint d'envoi et sans paiement. Le bouton final est toujours désactivé. Les services sont provisoires et issus du planning de maquette existant.

## État et données

- `cartStore` conserve uniquement les identifiants des pizzas et les quantités dans la clé existante `forno-pizza-cart-v1`. Les deux pages utilisent les mêmes utilitaires de total et le même catalogue.
- Les coordonnées et le commentaire restent dans la mémoire/les champs de la page. Retourner d'une étape à l'autre les préserve. Recharger la page conserve le panier, mais ne persiste pas les coordonnées.
- La fenêtre par défaut couvre aujourd'hui et les six jours suivants, selon Europe/Paris. Délai minimum : 30 minutes. Pas : 15 minutes. Aucun créneau dans les 15 dernières minutes avant fermeture.
- Les fermetures exceptionnelles utilisent des dates `YYYY-MM-DD`. Les services ont des identifiants `forno-YYYY-MM-DD-jour`. Les créneaux ajoutent `@HH:mm` à cet identifiant.
- Les heures locales inexistantes ou ambiguës lors d'un changement d'heure sont exclues. Les créneaux habituels du soir ne sont pas ambigus.
- Les disponibilités sont recalculées à chaque navigation pertinente, au retour sur l'onglet et toutes les 30 secondes. L'horloge du navigateur reste provisoire ; le futur serveur devra imposer sa propre horloge.

## Étape Supabase : validations à implémenter avant tout envoi réel

1. Recevoir seulement `OrderSubmission` : identifiants des pizzas, quantités, service, créneau, coordonnées, prise de connaissance et clé d'idempotence. Aucun montant, village ou statut transmis par le navigateur ne doit faire autorité.
2. Valider le schéma, les longueurs, le téléphone et les quantités côté serveur. Relire le catalogue autorisé et recalculer intégralement prix unitaires, sous-totaux et total. Faire confirmer les tarifs encore marqués provisoires.
3. Résoudre le service daté dans une source canonique. Vérifier avec l'heure serveur : ouverture des précommandes, fermetures, créneau, délai minimum, préparation et capacité restante.
4. Créer la demande avec statut `pending`, réservation de capacité et clé d'idempotence unique dans une transaction atomique. Verrouiller ou utiliser des écritures conditionnelles pour éviter les dépassements de capacité. Un double clic ou une nouvelle tentative avec la même clé ne doit pas créer une seconde commande.
5. Protéger les coordonnées : politiques d'accès Supabase/RLS, clés privilégiées uniquement côté serveur, accès métier authentifié, aucune donnée client dans les logs publics, conservation définie. Prévoir limitation de débit et protection contre les demandes abusives.
6. N'afficher un accusé de réception qu'après succès réel du serveur. Différencier la réception `pending` de l'acceptation par le pizzaiolo. Ne vider le panier qu'après ce succès réel, selon le comportement validé.
7. Implémenter les transitions autorisées entre `pending`, `accepted`, `rejected`, `preparing`, `ready`, `completed`, `cancelled`, les notifications et les règles d'annulation. Ces garanties ne sont pas opérationnelles dans cette étape.

Les pages de confidentialité et mentions légales restent les modèles provisoires existants. Leur contenu doit être adapté aux traitements réellement mis en service avant le lancement public.

## Vérification

`npm run test:checkout` couvre le panier, le téléphone, la validation, les fenêtres datées, le délai minimum, les fermetures, les créneaux indisponibles et les deux transitions d'heure Paris. Compléter par `npm run check`, `npm run build` et le parcours navigateur.
