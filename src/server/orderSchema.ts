import { z } from 'astro/zod';
import { normalizeFrenchPhone } from '../utils/orderValidation';
const name = z.string().trim().min(1).max(80).regex(/^[\p{L}\p{M}][\p{L}\p{M} .’'-]*$/u);
export const orderRequestSchema = z.object({
  idempotencyKey: z.uuid({version:"v4"}),
  serviceId: z.string().min(1).max(100), slotId: z.string().min(1).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), village: z.string().min(1).max(120),
  lines: z.array(z.object({ pizzaId: z.string().regex(/^[a-z0-9-]{1,60}$/), quantity: z.number().int().min(1).max(20) }).strict()).min(1).max(13),
  customer: z.object({ firstName: name, lastName: name,
    phone: z.string().max(30).transform(normalizeFrenchPhone).refine((value) => value !== null),
    comment: z.string().trim().max(500).refine((value) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)),
    privacyAcknowledged: z.literal(true),
  }).strict(),
  turnstileToken: z.string().min(1).max(2048),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.lines.map((line) => line.pizzaId)).size !== value.lines.length || value.lines.reduce((n,line) => n+line.quantity,0)>20)
    ctx.addIssue({code:'custom',message:'Invalid cart'});
});
export type ValidatedOrderRequest = z.infer<typeof orderRequestSchema>;
