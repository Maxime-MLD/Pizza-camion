# Vérification réelle à deux connexions — base jetable uniquement

Ce scénario n’a pas été exécuté sans accès à un projet Supabase. Les tests PGlite ne remplacent pas cette vérification.

1. Appliquer les migrations sur un projet de test et générer le service du jour avec le script du dépôt. Utiliser des coordonnées synthétiques. Configurer un créneau futur (plus de 30 minutes), `capacity=2`, service open et orders_enabled=true. Vérifier l’absence de commandes sur ce créneau.
2. Ouvrir deux sessions SQL indépendantes sous postgres, avec deux UUID v4 distincts. Chaque payload comporte serviceId, slotId, date réelle Paris, village exact, deux Capri, customer {firstName:"Test",lastName:"Essai",phone:"+33612345678",comment:"",privacyAcknowledged:true}, idempotencyKey.
3. Session A : `begin;` puis `select public.forno_create_order(PAYLOAD_A::jsonb, repeat('a',64), repeat('b',64));` Garder la transaction ouverte.
4. Session B : appeler la même fonction avec PAYLOAD_B et la même charge. Elle doit attendre le verrou de A.
5. Session A : `commit;`. Session B doit alors échouer avec `SLOT_FULL`. Vérifier : une seule commande, deux pizzas, deux lignes de capacité au maximum. Vérifier qu’aucune commande partielle n’existe.
6. Refaire avec le même UUID et le même fingerprint dans A et B. Après libération du verrou, les deux réponses doivent contenir la même référence et une seule commande.
7. Refaire en annulant (`rollback`) A. B doit alors réussir et être la seule commande enregistrée.
8. Activer un pending à expiration proche puis vérifier après expiration : créneau libre immédiatement, statut cancelled après passage du cron. Vérifier `cron.job_run_details` et l’horloge effective Europe/Paris.
9. Utiliser le véritable Data API avec la clé publishable/anon : SELECT orders/order_items, UPDATE pizzas/services et RPC forno_create_order/forno_pickup_slots doivent être refusés. Aucune coordonnée ne doit être révélée. Répéter avec une session authenticated sans privilège admin.
10. Effectuer un envoi via le navigateur sur le domaine de test et un véritable widget Turnstile ; actualiser pendant une réponse retardée et vérifier la récupération du même reçu, puis la conservation des autres ajouts au panier.

Les futures mutations admin doivent conserver l’ordre de verrouillage service → créneau → commande. Ne jamais changer un pending expiré en accepted sans revérifier sa capacité dans la même transaction.
