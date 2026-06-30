-- ============================================================================
-- RLS LOCKDOWN — ROLLBACK (reverses 02-lockdown.sql)
-- Only undoes tables whose ONLY policies are the ones this lockdown created,
-- so tables that already had hand-designed RLS are left untouched.
-- ============================================================================

begin;

do $$
declare r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity = true
  loop
    -- skip tables that have any policy we did NOT create (pre-existing RLS designs)
    if not exists (
      select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = r.relname
        and p.policyname not in (
          'app_authenticated_all', 'website_anon_select', 'website_anon_insert')
    ) then
      execute format('drop policy if exists app_authenticated_all on public.%I;', r.relname);
      execute format('drop policy if exists website_anon_select on public.%I;', r.relname);
      execute format('drop policy if exists website_anon_insert on public.%I;', r.relname);
      execute format('alter table public.%I disable row level security;', r.relname);
      raise notice 'Rolled back: %', r.relname;
    end if;
  end loop;
end $$;

commit;
