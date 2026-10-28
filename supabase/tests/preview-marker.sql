-- Apply only to the approved, empty forno-pizza-test project.
-- This marker is NOT a Production migration and grants no application capability.
create table forno_private.test_environment (
  singleton boolean primary key default true check(singleton),
  project_ref text not null check(project_ref='brzcvncsycdpsrvulqss'),
  run_id uuid not null default gen_random_uuid(),
  fixtures jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table forno_private.test_environment enable row level security;
revoke all on forno_private.test_environment from public,anon,authenticated,service_role;
insert into forno_private.test_environment(project_ref) values('brzcvncsycdpsrvulqss');
