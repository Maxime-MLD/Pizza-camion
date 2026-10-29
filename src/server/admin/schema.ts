import {z} from 'astro/zod';
const service={id:z.string().min(1).max(100),expectedUpdatedAt:z.iso.datetime({offset:true})};
const time=z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/);
export const adminChangeSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('transition'),id:z.uuid(),expected:z.enum(['pending','accepted','preparing','ready','completed','rejected','cancelled']),status:z.enum(['accepted','rejected','preparing','ready','completed'])}).strict(),
 ...(['open','close','cancel'] as const).map(action=>z.object({action:z.literal(action),...service}).strict()),
 z.object({action:z.literal('hours'),...service,openingTime:time,closingTime:time}).strict(),
 z.object({action:z.literal('capacity'),...service,slotId:z.string().min(1).max(120),expectedCapacity:z.number().int().min(1).max(200),capacity:z.number().int().min(1).max(200)}).strict(),
 z.object({action:z.literal('settings'),revision:z.number().int().min(0),minimumLeadMinutes:z.number().int().min(0).max(240),defaultSlotCapacity:z.number().int().min(1).max(200),slotIntervalMinutes:z.number().int().min(5).max(60)}).strict(),
]);
export const loginSchema=z.object({email:z.email().max(254),password:z.string().min(1).max(256)}).strict();
