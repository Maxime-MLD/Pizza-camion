export const validationConfig={
 page:'/admin/verification/',slots:'/api/admin/validation/slots',orders:'/api/admin/validation/orders',turnstile:'/api/admin/validation/turnstile',
 title:'Validation privée',notice:'Les commandes publiques restent fermées. Ce parcours crée de vraies demandes réservées aux essais autorisés.',
 disabled:'La validation privée est désactivée. Son activation exige la vérification des migrations, des clés et du service du jour.',
} as const;
