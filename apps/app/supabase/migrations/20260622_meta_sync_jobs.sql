-- ============================================================================
-- meta sync jobs — refresh assíncrono de campanhas/anúncios e insights
--
-- O sync da meta-api pode ser muito demorado (contas com muitos dados). Em vez
-- de bloquear o botão à espera da resposta, criamos um "job" e disparamos o
-- trabalho fire-and-forget no servidor (Coolify = Node de longa duração, sem
-- timeout de serverless). Quando termina:
--   1. o job passa a status='done'/'error' → Realtime avisa a página (auto-refresh)
--   2. é inserida uma notification (sino + web push) para QUEM clicou — chega
--      mesmo que o utilizador saia da página.
--
-- Tabela em `public` (NÃO em `meta`) precisamente para o browser conseguir
-- subscrever via Realtime sob RLS (o schema `meta` é service_role-only e não
-- exposto). RLS: cada utilizador só vê os seus próprios jobs.
--
-- Aditiva. Revert no fim do ficheiro.
-- ============================================================================

create table public.meta_sync_jobs (
  id            uuid        primary key default gen_random_uuid(),
  kind          text        not null,
  status        text        not null default 'running',
  requested_by  uuid        not null,
  counters      jsonb       not null default '{}'::jsonb,
  error         text,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  constraint meta_sync_jobs_kind_chk   check (kind in ('campaigns','insights')),
  constraint meta_sync_jobs_status_chk check (status in ('running','done','error'))
);

create index meta_sync_jobs_requester_idx
  on public.meta_sync_jobs (requested_by, started_at desc);

alter table public.meta_sync_jobs enable row level security;

-- O requester vê (e subscreve via Realtime) só os seus próprios jobs.
-- INSERT/UPDATE são feitos server-side via service_role (bypassa RLS).
create policy meta_sync_jobs_select_own on public.meta_sync_jobs
  for select to authenticated
  using (requested_by = auth.uid());

grant select on public.meta_sync_jobs to authenticated;
grant all    on public.meta_sync_jobs to service_role;

-- Realtime (postgres_changes) para o browser receber o flip de status.
alter publication supabase_realtime add table public.meta_sync_jobs;

-- ============================================================================
-- REVERT
-- ----------------------------------------------------------------------------
-- alter publication supabase_realtime drop table public.meta_sync_jobs;
-- drop table if exists public.meta_sync_jobs;
-- ============================================================================
