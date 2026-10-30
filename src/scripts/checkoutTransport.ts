import {validationConfig} from '../config/validation.config';
export function checkoutTransport(validation:boolean,csrf:string){
 const headers:Record<string,string>=validation?{'X-CSRF-Token':csrf}:{};
 return {slots:validation?validationConfig.slots:'/api/pickup-slots',orders:validation?validationConfig.orders:'/api/orders',
  headers,storagePrefix:validation?'forno-private-validation:':''};
}
