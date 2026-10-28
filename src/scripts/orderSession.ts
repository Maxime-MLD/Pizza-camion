import type { OrderLine } from '../types/order';
export interface OrderAttempt { key: string; lines: OrderLine[]; consumed: boolean; }
const STORAGE_KEY='forno-order-attempt-v1';
export function readAttempt(storage: Pick<Storage,'getItem'>): OrderAttempt|null {
  try {
    const value=JSON.parse(storage.getItem(STORAGE_KEY)??'null') as OrderAttempt|null;
    if(!value||!/^\w{8}-\w{4}-4\w{3}-[89ab]\w{3}-\w{12}$/i.test(value.key)||!Array.isArray(value.lines))return null;
    if(!value.lines.every(line=>typeof line.pizzaId==='string'&&Number.isInteger(line.quantity)&&line.quantity>0&&line.quantity<=20))return null;
    return value;
  }catch{return null;}
}
export function saveAttempt(storage: Pick<Storage,'setItem'>,attempt:OrderAttempt): void {
  storage.setItem(STORAGE_KEY,JSON.stringify(attempt));
}
export function forgetAttempt(storage: Pick<Storage,'removeItem'>): void {storage.removeItem(STORAGE_KEY);}
