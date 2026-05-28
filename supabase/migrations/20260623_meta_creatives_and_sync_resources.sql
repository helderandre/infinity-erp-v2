-- ============================================================================
-- Meta — criativos completos (creative.synced) + sync jobs por recurso/período
--
-- 1. meta.meta_creatives_raw — espelho local do criativo completo (imagem/vídeo,
--    copy, CTA, link) entregue pelo webhook `creative.synced`. Liga-se ao
--    anúncio por creative_id (que já vem em ad.synced → meta_ads_raw).
--
-- 2. ALTER public.meta_sync_jobs — o refresh deixa de ser por "kind" fixo
--    (campaigns|insights) e passa a carregar a lista de `resources` escolhida
--    pelo utilizador no diálogo geral + o `since_days` (período). `kind` fica
--    nullable (back-compat com código já em produção até ao próximo deploy).
--
-- Aditiva. Revert no fim do ficheiro.
-- ============================================================================

create schema if not exists meta;

-- ----------------------------------------------------------------------------
-- 1. meta.meta_creatives_raw — idempotente em creative_id
-- ----------------------------------------------------------------------------
create table meta.meta_creatives_raw (
  id                 uuid        primary key default gen_random_uuid(),
  payload            jsonb       not null,
  creative_id        text        unique,
  ad_account_id      text,
  mube_tenant_id     uuid,
  name               text,
  title              text,
  body               text,
  cta_type           text,
  link_url           text,
  image_url          text,
  thumbnail_url      text,
  video_id           text,
  object_story_spec  jsonb,
  signature_valid    boolean     not null default false,
  received_at        timestamptz not null default now(),
  processed          boolean     not null default false,
  processed_at       timestamptz
);

create index meta_creatives_raw_tenant_idx     on meta.meta_creatives_raw (mube_tenant_id);
create index meta_creatives_raw_ad_account_idx on meta.meta_creatives_raw (ad_account_id);

grant all on meta.meta_creatives_raw to service_role;

-- ----------------------------------------------------------------------------
-- 2. public.meta_sync_jobs — resources[] + since_days; kind passa a opcional
-- ----------------------------------------------------------------------------
alter table public.meta_sync_jobs
  add column if not exists resources  text[] not null default '{}',
  add column if not exists since_days int;

-- kind deixa de ser obrigatório/constrangido (jobs novos usam resources[])
alter table public.meta_sync_jobs drop constraint if exists meta_sync_jobs_kind_chk;
alter table public.meta_sync_jobs alter column kind drop not null;

-- ============================================================================
-- REVERT
-- ----------------------------------------------------------------------------
-- alter table public.meta_sync_jobs alter column kind set not null;          -- (só se não houver rows com kind null)
-- alter table public.meta_sync_jobs add constraint meta_sync_jobs_kind_chk
--   check (kind in ('campaigns','insights'));
-- alter table public.meta_sync_jobs drop column if exists since_days;
-- alter table public.meta_sync_jobs drop column if exists resources;
-- drop table if exists meta.meta_creatives_raw;
-- ============================================================================
