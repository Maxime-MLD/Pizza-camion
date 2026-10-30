import {z} from 'astro/zod';
import {allowedPushEndpoint} from '../../../supabase/functions/_shared/push-worker';
export const pushRequestSchema=z.discriminatedUnion('action',[
 z.object({action:z.literal('subscribe'),endpoint:z.url().max(2048).refine(allowedPushEndpoint),p256dh:z.string().regex(/^[A-Za-z0-9_-]{87}$/),auth:z.string().regex(/^[A-Za-z0-9_-]{22}$/),label:z.string().trim().min(1).max(80)}).strict(),
 z.object({action:z.literal('revoke'),deviceId:z.uuid()}).strict(),
 z.object({action:z.literal('test'),deviceId:z.uuid()}).strict(),
]);
export const pushCookie='__Host-forno-push-device';
