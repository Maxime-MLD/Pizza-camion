// Outputs SQL from the existing central catalogue / weekly schedule. No database credentials.
import { build } from 'esbuild';
const {outputFiles}=await build({stdin:{contents:'export {pizzas} from "./src/data/pizzas"; export {truckSchedule} from "./src/data/truckSchedule"; export {pickupAvailabilityConfig} from "./src/config/checkout.config";',resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false,
 plugins:[{name:'asset-stub',setup(b){b.onLoad({filter:/\.(jpg|webp)$/},()=>({contents:'export default null',loader:'js'}));}}]});
const {pizzas,truckSchedule,pickupAvailabilityConfig:rules}=await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
const quote=(v)=>v==null?'null':`'${String(v).replaceAll("'","''")}'`;
if(process.argv[2]==='catalogue'){
 console.log('-- Generated from src/data/pizzas.ts. Unconfirmed prices are unavailable until verified.');
 console.log('insert into public.pizzas(id,name,description,price_cents,available) values\n'+pizzas.map(p=>`(${quote(p.id)},${quote(p.name)},${quote(p.ingredients)},${p.priceCents},${p.priceConfirmed})`).join(',\n')+'\non conflict(id) do nothing;');
}else if(process.argv[2]==='services'){
 const start=process.argv[3], days=Number(process.argv[4]??35);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start??'')||!Number.isInteger(days)||days<1||days>90)throw Error('Usage: node scripts/prepare-order-data.mjs services YYYY-MM-DD [1..90]');
 console.log('-- Weekly template only. Existing dated exceptions are NEVER overwritten.\nbegin;');
 for(let i=0;i<days;i++){
  const date=new Date(`${start}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+i);const key=date.toISOString().slice(0,10);
  const stop=truckSchedule.find(s=>s.day===date.getUTCDay());
  if(!stop||stop.status==='closed')continue;
  const id=`forno-${key}-${stop.day}`;const closed=rules.exceptionalClosures.includes(key)||rules.unavailableServiceIds.includes(id);
  const address=stop.address?.startsWith('TODO_')?null:stop.address;
  console.log(`insert into public.services(id,service_date,village,address,opening_time,closing_time,status,orders_enabled) values(${quote(id)},${quote(key)},${quote(stop.village)},${quote(address)},${quote(stop.opens)},${quote(stop.closes)},${quote(closed?'cancelled':'scheduled')},false) on conflict(service_date) do nothing;`);
  console.log(`insert into public.pickup_slots(id,service_id,pickup_time,capacity,enabled) select s.id||'@'||to_char(t,'HH24:MI'),s.id,t::time,cfg.default_slot_capacity,true from public.services s cross join forno_private.settings cfg cross join lateral generate_series((s.service_date+s.opening_time)::timestamp,(s.service_date+s.closing_time)::timestamp-make_interval(mins=>cfg.closing_margin_minutes),make_interval(mins=>cfg.slot_interval_minutes)) t where s.id=${quote(id)} on conflict(service_id,pickup_time) do nothing;`);
  for(const slot of rules.unavailableSlotIds.filter(x=>x.startsWith(id+'@')))console.log(`update public.pickup_slots set enabled=false where id=${quote(slot)};`);
 }
 console.log('commit;');
}else throw Error('Choose catalogue or services');
