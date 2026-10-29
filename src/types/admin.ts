export type OrderStatus='pending'|'accepted'|'rejected'|'preparing'|'ready'|'completed'|'cancelled';
export interface AdminIdentity { userId:string; sessionId:string; email:string; }
export interface AdminOrder { id:string;reference:string;status:OrderStatus;expired:boolean;pickupTime:string;receivedAt:string;expiresAt:string;firstName:string|null;lastName:string|null;phone:string|null;note:string|null;totalCents:number;lines:{name:string;quantity:number}[]; }
export interface AdminService {id:string;date:string;village:string;openingTime:string;closingTime:string;status:string;ordersEnabled:boolean;updatedAt:string;slots:{id:string;time:string;capacity:number;enabled:boolean;used:number}[];}
export interface AdminOrders {date:string;serverNow:string;service:AdminService|null;orders:AdminOrder[];}
export interface AdminSettings {minimumLeadMinutes:number;defaultSlotCapacity:number;slotIntervalMinutes:number;revision:number;}
