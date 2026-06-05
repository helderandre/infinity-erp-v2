-- ============================================================================
-- Meta Ads — Insights de desempenho + alertas de ad objects + custo por lead
--
-- Extensão aditiva do schema `meta` (20260616_meta_ads_integration.sql) para
-- consumir as novidades da meta-api:
--   1. Insights (gasto, impressões, cliques, CPL) — espelho local de GET /api/insights,
--      alimentado pelo ping `insights.synced` (fetch HMAC server-side) ou pelo
--      botão "Atualizar desempenho agora".
--   2. Alertas de estado/problema de ad objects — webhook `ad_object.issue`
--      (log de eventos, uma linha por entrega).
--   3. Custo por lead anexado ao `lead.created` (chega null em leads novos,
--      preenchido depois pelo sync de insights).
--
-- Tudo no schema `meta`, lido server-side via service_role (admin client).
-- Aditiva. Revert no fim do ficheiro.
-- ============================================================================

create schema if not exists meta;

-- ----------------------------------------------------------------------------
-- meta.meta_insights_raw — uma linha por (level, object_id, date_start)
--
-- Espelho do tipo `Insight` de GET /api/insights. Grão diário: o Meta devolve
-- 1 linha por objecto por dia. Chave natural de idempotência:
-- (level, object_id, date_start) — usada como onConflict no upsert. external_id
-- (o `id` da meta-api) fica indexado mas NÃO único, porque pode ser regenerado
-- em re-syncs/backfills.
--
-- NOTA: reach/frequency NÃO são somáveis entre dias/níveis — usar sempre o
-- valor por linha. spend/clicks/leads/impressions são somáveis.
-- ----------------------------------------------------------------------------
create table meta.meta_insights_raw (
  id                    uuid        primary key default gen_random_uuid(),
  external_id           text,
  payload               jsonb       not null,
  mube_tenant_id        uuid,
  ad_account_id         text,
  level                 text        not null,
  object_id             text        not null,
  campaign_id           text,
  adset_id              text,
  ad_id                 text,
  date_start            date        not null,
  date_stop             date,
  spend                 numeric,
  impressions           bigint,
  reach                 bigint,
  frequency             numeric,
  clicks                bigint,
  inline_link_clicks    bigint,
  cpc                   numeric,
  cpm                   numeric,
  ctr                   numeric,
  leads                 integer,
  cost_per_lead         numeric,
  actions               jsonb,
  action_values         jsonb,
  cost_per_action_type  jsonb,
  purchase_roas         jsonb,
  account_currency      text,
  fetched_at            timestamptz,
  received_at           timestamptz not null default now(),
  constraint meta_insights_raw_level_chk
    check (level in ('account','campaign','adset','ad')),
  constraint meta_insights_raw_grain_uniq
    unique (level, object_id, date_start)
);

create index meta_insights_raw_tenant_idx      on meta.meta_insights_raw (mube_tenant_id);
create index meta_insights_raw_ad_account_idx  on meta.meta_insights_raw (ad_account_id);
create index meta_insights_raw_campaign_idx    on meta.meta_insights_raw (campaign_id) where campaign_id is not null;
create index meta_insights_raw_ad_idx          on meta.meta_insights_raw (ad_id) where ad_id is not null;
create index meta_insights_raw_external_idx    on meta.meta_insights_raw (external_id) where external_id is not null;
create index meta_insights_raw_date_idx        on meta.meta_insights_raw (date_start desc);
create index meta_insights_raw_level_object_idx on meta.meta_insights_raw (level, object_id);

-- ----------------------------------------------------------------------------
-- meta.meta_ad_object_issues — webhook `ad_object.issue` (log de eventos)
--
-- Uma linha por entrega (insert, não upsert) — histórico completo de alertas de
-- estado/problema de campanhas/anúncios ao longo do tempo. `value` é o payload
-- bruto da Meta para o campo (`with_issues_ad_objects` ou `in_process_ad_objects`).
-- `acknowledged_at`/`acknowledged_by` permitem dispensar o alerta na UI sem
-- apagar o histórico.
-- ----------------------------------------------------------------------------
create table meta.meta_ad_object_issues (
  id               uuid        primary key default gen_random_uuid(),
  payload          jsonb       not null,
  mube_tenant_id   uuid,
  ad_account_id    text,
  field            text,
  value            jsonb,
  delivery_id      text,
  signature_valid  boolean     not null default false,
  received_at      timestamptz not null default now(),
  acknowledged_at  timestamptz,
  acknowledged_by  uuid,
  constraint meta_ad_object_issues_field_chk
    check (field is null or field in ('with_issues_ad_objects','in_process_ad_objects'))
);

create index meta_ad_object_issues_tenant_idx     on meta.meta_ad_object_issues (mube_tenant_id);
create index meta_ad_object_issues_ad_account_idx on meta.meta_ad_object_issues (ad_account_id);
create index meta_ad_object_issues_unack_idx
  on meta.meta_ad_object_issues (received_at desc) where acknowledged_at is null;

-- ----------------------------------------------------------------------------
-- meta.meta_leads_raw — custo por lead (chega via lead.cost no lead.created)
-- ----------------------------------------------------------------------------
alter table meta.meta_leads_raw
  add column if not exists cost_per_lead numeric,
  add column if not exists cost_currency text,
  add column if not exists cost_basis    text;

-- ----------------------------------------------------------------------------
-- Grants — service_role tem acesso total (webhook + UI usam admin client).
-- alter default privileges já cobre tabelas futuras, mas explicitamos.
-- ----------------------------------------------------------------------------
grant all on meta.meta_insights_raw     to service_role;
grant all on meta.meta_ad_object_issues to service_role;

-- ============================================================================
-- REVERT
-- ----------------------------------------------------------------------------
-- alter table meta.meta_leads_raw
--   drop column if exists cost_basis,
--   drop column if exists cost_currency,
--   drop column if exists cost_per_lead;
-- drop table if exists meta.meta_ad_object_issues;
-- drop table if exists meta.meta_insights_raw;
-- ============================================================================
