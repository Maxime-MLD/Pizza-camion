-- Target: forno-pizza / fqjkkjvrklpzhwmswlsy. No writes, maintenance calls or PII.
-- Keep all counts in one repeatable-read snapshot; do not count a tool response wrapper.
begin transaction isolation level repeatable read read only;
select jsonb_build_object(
  'observedAt',clock_timestamp(),
  'parisNow',clock_timestamp() at time zone 'Europe/Paris',
  'counts',jsonb_build_object(
    'pizzas',(select count(*) from public.pizzas),
    'services',(select count(*) from public.services),
    'slots',(select count(*) from public.pickup_slots),
    'orders',(select count(*) from public.orders),
    'orderItems',(select count(*) from public.order_items)),
  'orderStatuses',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (
    select status,count(*) as orders,sum(pizza_count) as pizza_units from public.orders group by status
  ) x),
  'orderNumberSequence',(select jsonb_build_object('lastValue',last_value,'isCalled',is_called) from forno_private.order_number_seq),
  'enabledServices',(select count(*) from public.services where orders_enabled),
  'today',public.forno_pickup_slots(1),
  'settings',(select to_jsonb(s) from forno_private.settings s),
  'maintenanceImpact',jsonb_build_object(
    'pendingToExpire',(select count(*) from public.orders where status='pending' and pending_expires_at<=clock_timestamp()),
    'personalRecordsToPurge',(select count(*) from public.orders where personal_data_purged_at is null
      and created_at<now()-make_interval(days=>(select retention_days from forno_private.settings))),
    'rateBucketsToDelete',(select count(*) from forno_private.request_limits where bucket<now()-interval '1 day')),
  'cron',(select jsonb_agg(x) from (
    select jobid,jobname,schedule,active,username,command from cron.job where jobname='forno-order-maintenance'
  ) x),
  'cronRuns',(select coalesce(jsonb_agg(x),'[]'::jsonb) from (
    select d.status,count(*) as runs,max(d.end_time) as last_run
    from cron.job_run_details d join cron.job j using(jobid)
    where j.jobname='forno-order-maintenance' group by d.status
  ) x)
) as audit;
commit;
