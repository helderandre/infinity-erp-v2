-- ============================================================================
-- RLS LOCKDOWN — STEP 1: VERIFY current state (READ-ONLY, run this first)
-- Project: umlndumjfamfsswwjgoo (shared by the ERP + the public website)
-- ============================================================================

-- 1a) RLS status of every table in public (off = currently unprotected)
select c.relname                                   as table_name,
       c.relrowsecurity                            as rls_enabled,
       (select count(*) from pg_policies p
         where p.schemaname = 'public' and p.tablename = c.relname) as policy_count
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relrowsecurity, c.relname;

-- 1b) The website lead RPC MUST be SECURITY DEFINER (so anon can write a lead
--     into the now-protected destination table). Owner should bypass RLS.
select p.proname,
       p.prosecdef                                  as security_definer,
       pg_get_function_identity_arguments(p.oid)    as args,
       r.rolname                                    as owner,
       r.rolbypassrls                               as owner_bypasses_rls
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_roles r on r.oid = p.proowner
where n.nspname = 'public' and p.proname = 'create_website_lead';

-- 1c) Current table grants to anon/authenticated (context; RLS is the real gate)
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated')
group by table_name, grantee
order by table_name, grantee;
