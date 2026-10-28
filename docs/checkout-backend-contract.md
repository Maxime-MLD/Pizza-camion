# Tunnel de préparation côté client

Le parcours `/commander/` fonctionne sans React, sans endpoint d'envoi et sans paiement. Le bouton final est toujours désactivé. Les services sont provisoires et issus du planning de maquette existant.

## État et données

- `cartStore` conserve uniquement les identifiants des pizzas et les quantités dans la clé existante `forno-pizza-cart-v1`. Les deux pages utilisent les mêmes utilitaires de total et le même catalogue.
- Les coordonnées et le commentaire restent dans la mémoire/les champs de la page. Retourner d'une étape à l'autre les préserve. Recharger la page conserve le panier, mais ne persiste pas les coordonnées.
- Seul le service du jour réel en Europe/Paris est autorisé. Date et village sont affichés en lecture seule ; il n'existe plus de fenêtre de précommande. Délai minimum : 30 minutes. Pas : 15 minutes. Aucun créneau dans les 15 dernières minutes avant fermeture. La préparation d'un retrait plus tard dans la journée est possible avant le début du service, si des créneaux du jour existent.
- Les fermetures exceptionnelles utilisent des dates `YYYY-MM-DD`. Les services ont des identifiants `forno-YYYY-MM-DD-jour`. Les créneaux ajoutent `@HH:mm` à cet identifiant.
- Les heures locales inexistantes ou ambiguës lors d'un changement d'heure sont exclues. Les créneaux habituels du soir ne sont pas ambigus.
- Les disponibilités sont recalculées à chaque navigation pertinente, au retour sur l'onglet et toutes les 30 secondes. Après minuit, le créneau est effacé et la poursuite est bloquée jusqu'à une actualisation explicite du tunnel. Aucun transfert vers le lendemain n'est effectué. Le panier est conservé.
- Si le jour est fermé, le service terminé ou les créneaux épuisés, le prochain village est indiqué uniquement à titre informatif (recherche dans les 14 jours suivants, sans identifiant ni créneau sélectionnable). Le lien de planning pointe vers le bandeau existant. La source hebdomadaire reste `truckSchedule`, partagée avec la Hero et le bandeau.
- `validateTodayPickupRequest` est une fonction préparatoire réutilisable : elle recalcule le service du jour, rejette les anciens/futurs services, vérifie tout village/date déclaré et recherche le créneau dans les disponibilités recalculées. Le navigateur l'utilise déjà ; la protection effective nécessitera son exécution dans le futur backend avec l'heure serveur et les données canoniques, jamais celles envoyées par le client.

## Étape Supabase : validations à implémenter avant tout envoi réel

1. Recevoir seulement `OrderSubmission` : identifiants des pizzas, quantités, service, créneau, coordonnées, prise de connaissance et clé d'idempotence. Aucun montant, village ou statut transmis par le navigateur ne doit faire autorité.
2. Valider le schéma, les longueurs, le téléphone et les quantités côté serveur. Relire le catalogue autorisé et recalculer intégralement prix unitaires, sous-totaux et total. Faire confirmer les tarifs encore marqués provisoires.
3. Résoudre le service daté dans une source canonique. Vérifier avec l'heure serveur : date réelle Europe/Paris, service du jour autorisé, village canonique, fermetures, créneau, délai minimum, préparation et capacité restante. Utiliser la logique de `validateTodayPickupRequest`, sans faire confiance à l'horloge ni au planning du navigateur. Rejeter tout autre jour/village, même si le client a modifié son interface ou son payload.
4. Créer la demande avec statut `pending`, réservation de capacité et clé d'idempotence unique dans une transaction atomique. Verrouiller ou utiliser des écritures conditionnelles pour éviter les dépassements de capacité. Un double clic ou une nouvelle tentative avec la même clé ne doit pas créer une seconde commande.
5. Protéger les coordonnées : politiques d'accès Supabase/RLS, clés privilégiées uniquement côté serveur, accès métier authentifié, aucune donnée client dans les logs publics, conservation définie. Prévoir limitation de débit et protection contre les demandes abusives.
6. N'afficher un accusé de réception qu'après succès réel du serveur. Différencier la réception `pending` de l'acceptation par le pizzaiolo. Ne vider le panier qu'après ce succès réel, selon le comportement validé.
7. Implémenter les transitions autorisées entre `pending`, `accepted`, `rejected`, `preparing`, `ready`, `completed`, `cancelled`, les notifications et les règles d'annulation. Ces garanties ne sont pas opérationnelles dans cette étape.

Les pages de confidentialité et mentions légales restent les modèles provisoires existants. Leur contenu doit être adapté aux traitements réellement mis en service avant le lancement public.

## Vérification

`npm run test:checkout` couvre le panier, le téléphone, la validation, mardi/Vougy, mercredi/Mably, dimanche fermé, service terminé, changement de date pendant le tunnel, payloads altérés, délai minimum, fermetures, créneaux indisponibles et les deux transitions d'heure Paris. Compléter par `npm run check`, `npm run build` et le parcours navigateur.
