-- ============================================================================
-- RLS LOCKDOWN — STEP 2: apply (TEST ON A SUPABASE BRANCH FIRST)
-- Project: umlndumjfamfsswwjgoo (shared by the ERP + the public website)
--
-- Model:
--   * service_role bypasses RLS  -> all ERP admin-client endpoints keep working.
--   * authenticated gets full access (USING true) -> logged-in ERP users keep
--     exactly today's access; only ANONYMOUS access is removed.
--   * anon gets a narrow, row-scoped allowlist -> only what the public website needs.
--
-- Behaviour changes (intended, confirmed):
--   * Public property listings show ONLY show_on_website = true.
--   * /property/add (anon insert/update/delete on dev_properties) STOPS working
--     anonymously — it must become a logged-in/ERP action.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) PUBLIC ALLOWLIST — anon read (row-scoped) + authenticated full access
-- ---------------------------------------------------------------------------

-- dev_properties: anon reads only published listings
alter table public.dev_properties enable row level security;
drop policy if exists website_anon_select on public.dev_properties;
create policy website_anon_select on public.dev_properties
  for select to anon using (show_on_website = true);
drop policy if exists app_authenticated_all on public.dev_properties;
create policy app_authenticated_all on public.dev_properties
  for all to authenticated using (true) with check (true);

-- dev_property_media: anon reads media belonging to published listings
alter table public.dev_property_media enable row level security;
drop policy if exists website_anon_select on public.dev_property_media;
create policy website_anon_select on public.dev_property_media
  for select to anon using (
    exists (select 1 from public.dev_properties p
            where p.id = dev_property_media.property_id and p.show_on_website = true));
drop policy if exists app_authenticated_all on public.dev_property_media;
create policy app_authenticated_all on public.dev_property_media
  for all to authenticated using (true) with check (true);

-- dev_property_specifications: anon reads specs of published listings
alter table public.dev_property_specifications enable row level security;
drop policy if exists website_anon_select on public.dev_property_specifications;
create policy website_anon_select on public.dev_property_specifications
  for select to anon using (
    exists (select 1 from public.dev_properties p
            where p.id = dev_property_specifications.property_id and p.show_on_website = true));
drop policy if exists app_authenticated_all on public.dev_property_specifications;
create policy app_authenticated_all on public.dev_property_specifications
  for all to authenticated using (true) with check (true);

-- property_type / property_status: public reference lookups
alter table public.property_type enable row level security;
drop policy if exists website_anon_select on public.property_type;
create policy website_anon_select on public.property_type for select to anon using (true);
drop policy if exists app_authenticated_all on public.property_type;
create policy app_authenticated_all on public.property_type for all to authenticated using (true) with check (true);

alter table public.property_status enable row level security;
drop policy if exists website_anon_select on public.property_status;
create policy website_anon_select on public.property_status for select to anon using (true);
drop policy if exists app_authenticated_all on public.property_status;
create policy app_authenticated_all on public.property_status for all to authenticated using (true) with check (true);

-- dev_users: anon reads only active + published consultants
--   (only commercial_name / professional_email / flags live here; salary/NIF/IBAN
--    are in dev_consultant_private_data, which stays fully private.)
alter table public.dev_users enable row level security;
drop policy if exists website_anon_select on public.dev_users;
create policy website_anon_select on public.dev_users
  for select to anon using (is_active = true and display_website = true);
drop policy if exists app_authenticated_all on public.dev_users;
create policy app_authenticated_all on public.dev_users for all to authenticated using (true) with check (true);

-- dev_consultant_profiles: anon reads profiles of published consultants
alter table public.dev_consultant_profiles enable row level security;
drop policy if exists website_anon_select on public.dev_consultant_profiles;
create policy website_anon_select on public.dev_consultant_profiles
  for select to anon using (
    exists (select 1 from public.dev_users u
            where u.id = dev_consultant_profiles.user_id
              and u.is_active = true and u.display_website = true));
drop policy if exists app_authenticated_all on public.dev_consultant_profiles;
create policy app_authenticated_all on public.dev_consultant_profiles for all to authenticated using (true) with check (true);

-- user_roles: anon reads role links for published consultants
alter table public.user_roles enable row level security;
drop policy if exists website_anon_select on public.user_roles;
create policy website_anon_select on public.user_roles
  for select to anon using (
    exists (select 1 from public.dev_users u
            where u.id = user_roles.user_id
              and u.is_active = true and u.display_website = true));
drop policy if exists app_authenticated_all on public.user_roles;
create policy app_authenticated_all on public.user_roles for all to authenticated using (true) with check (true);

-- roles: small public lookup (used only for the consultant's title on the site).
-- NOTE: this exposes the roles.permissions json structure to anon — mild info
-- disclosure (not credentials). Harden later via a column-limited view if desired.
alter table public.roles enable row level security;
drop policy if exists website_anon_select on public.roles;
create policy website_anon_select on public.roles for select to anon using (true);
drop policy if exists app_authenticated_all on public.roles;
create policy app_authenticated_all on public.roles for all to authenticated using (true) with check (true);

-- contact_form_submissions: anon INSERT only (no read/update/delete)
alter table public.contact_form_submissions enable row level security;
drop policy if exists website_anon_insert on public.contact_form_submissions;
create policy website_anon_insert on public.contact_form_submissions
  for insert to anon with check (true);
drop policy if exists app_authenticated_all on public.contact_form_submissions;
create policy app_authenticated_all on public.contact_form_submissions for all to authenticated using (true) with check (true);

-- create_website_lead RPC: anon EXECUTE is normally already granted by Supabase
-- default privileges; the CRITICAL requirement is SECURITY DEFINER + an owner that
-- bypasses RLS, so it can insert the lead into the now-protected table.
-- Confirm via 01-verify.sql (security_definer = true). If false, uncomment and set
-- the exact signature reported by 01b:
--   alter function public.create_website_lead(<args from 01b>) security definer;
--   grant execute on function public.create_website_lead(<args from 01b>) to anon;

-- ---------------------------------------------------------------------------
-- 2) PRIVATE LOCKDOWN — every other currently-RLS-OFF public table gets RLS +
--    an authenticated-only policy. Skips tables that ALREADY have RLS (preserves
--    their existing, hand-designed policies) and the allowlist above.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  allowlist text[] := array[
    'dev_properties','dev_property_media','dev_property_specifications',
    'property_type','property_status','dev_users','dev_consultant_profiles',
    'user_roles','roles','contact_form_submissions'
  ];
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity = false           -- only tables currently unprotected
      and c.relname <> all(allowlist)
  loop
    execute format('alter table public.%I enable row level security;', r.relname);
    execute format('drop policy if exists app_authenticated_all on public.%I;', r.relname);
    execute format(
      'create policy app_authenticated_all on public.%I for all to authenticated using (true) with check (true);',
      r.relname);
    raise notice 'Locked down (authenticated-only): %', r.relname;
  end loop;
end $$;

commit;
