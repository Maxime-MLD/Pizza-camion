import {orderEnvironments} from './order-environments.config.ts';
export const pushConfig={
 name:'FORNO. Admin',shortName:'FORNO.',scope:'/admin/',startUrl:'/admin/',manifest:'/admin/manifest.webmanifest',worker:'/admin/sw.js',offline:'/admin/offline/',
 testOrigin:'https://pizza-git-codex-test-commandes-maxime-mlds-projects.vercel.app',
 subject:'https://pizza-two-bay.vercel.app/',testProjectRef:orderEnvironments.testSupabaseRef,
 workerName:'forno-push-worker',cacheName:'forno-admin-static-v1',
 providerHosts:['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'],
 icons:{small:'/admin/icons/icon-192.png',large:'/admin/icons/icon-512.png',maskable:'/admin/icons/maskable-512.png',apple:'/admin/icons/apple-touch-icon.png'},
 errors:{PUSH_DISABLED:'Les notifications ne sont pas activées sur cet environnement.',PUSH_NOT_READY:'Le serveur prépare les notifications. Réessayez dans un instant.',PUSH_INVALID:'Cet abonnement n’est pas valide.',PUSH_DEVICE_LIMIT:'Dix appareils sont déjà actifs. Retirez un appareil avant d’en ajouter un.',PUSH_CONFLICT:'Cet abonnement doit être recréé sur cet appareil.',PUSH_RATE_LIMITED:'Attendez une minute avant un nouveau test.',UNAVAILABLE:'Le service de notifications est momentanément indisponible.'},
} as const;
