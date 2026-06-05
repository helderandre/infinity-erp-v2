-- ============================================================================
-- Meta Ads Integration — schema meta
-- Webhooks federados Mube/Meta Ads (HMAC-signed) recebidos de meta-api.mubesystems.com
-- Todas as tabelas no schema `meta` (isolado de public).
--
-- NOTA: Para o supabase-js conseguir queryar via .schema('meta').from('...'),
-- adicionar 'meta' a Project Settings → API → "Exposed schemas" no Dashboard.
-- A webhook route usa service_role e isso já está garantido pelos grants abaixo.
-- ============================================================================

create extension if not exists pgcrypto;
create schema if not exists meta;

-- ----------------------------------------------------------------------------
-- meta.meta_integration — estado single-row da conexão OAuth federada
-- ----------------------------------------------------------------------------
create table meta.meta_integration (
  id                      uuid        primary key default gen_random_uuid(),
  mube_tenant_id          uuid        not null unique,
  status                  text        not null default 'disconnected',
  connected_by            uuid,
  connected_at            timestamptz,
  last_error              text,
  pages_cache             jsonb       not null default '[]'::jsonb,
  pages_cache_updated_at  timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  constraint meta_integration_status_chk
    check (status in ('disconnected','connecting','connected','error'))
);

-- ----------------------------------------------------------------------------
-- meta.meta_campaigns_raw — idempotente em campaign_id
-- daily_budget/lifetime_budget em text (cents como string, wire format do Meta)
-- ----------------------------------------------------------------------------
create table meta.meta_campaigns_raw (
  id               uuid        primary key default gen_random_uuid(),
  payload          jsonb       not null,
  campaign_id      text        unique,
  ad_account_id    text,
  mube_tenant_id   uuid,
  name             text,
  status           text,
  objective        text,
  daily_budget     text,
  lifetime_budget  text,
  start_time       timestamptz,
  stop_time        timestamptz,
  fb_created_time  timestamptz,
  signature_valid  boolean     not null default false,
  received_at      timestamptz not null default now(),
  processed        boolean     not null default false,
  processed_at     timestamptz
);

create index meta_campaigns_raw_tenant_idx     on meta.meta_campaigns_raw (mube_tenant_id);
create index meta_campaigns_raw_ad_account_idx on meta.meta_campaigns_raw (ad_account_id);
create index meta_campaigns_raw_unprocessed_idx
  on meta.meta_campaigns_raw (received_at) where processed = false;

-- ----------------------------------------------------------------------------
-- meta.meta_ads_raw — campaign_id é FK lógica (sem constraint, ad pode chegar antes)
-- ----------------------------------------------------------------------------
create table meta.meta_ads_raw (
  id               uuid        primary key default gen_random_uuid(),
  payload          jsonb       not null,
  ad_id            text        unique,
  campaign_id      text,
  adset_id         text,
  mube_tenant_id   uuid,
  name             text,
  status           text,
  creative_id      text,
  creative_name    text,
  fb_created_time  timestamptz,
  signature_valid  boolean     not null default false,
  received_at      timestamptz not null default now(),
  processed        boolean     not null default false,
  processed_at     timestamptz
);

create index meta_ads_raw_tenant_idx    on meta.meta_ads_raw (mube_tenant_id);
create index meta_ads_raw_campaign_idx  on meta.meta_ads_raw (campaign_id);
create index meta_ads_raw_adset_idx     on meta.meta_ads_raw (adset_id);
create index meta_ads_raw_unprocessed_idx
  on meta.meta_ads_raw (received_at) where processed = false;

-- ----------------------------------------------------------------------------
-- meta.meta_forms_raw — source of truth em payload jsonb; colunas espelhadas para query
-- ----------------------------------------------------------------------------
create table meta.meta_forms_raw (
  id               uuid        primary key default gen_random_uuid(),
  payload          jsonb       not null,
  form_id          text        unique,
  page_id          text,
  mube_tenant_id   uuid,
  form_name        text,
  status           text,
  locale           text,
  fb_created_time  timestamptz,
  signature_valid  boolean     not null default false,
  received_at      timestamptz not null default now(),
  processed        boolean     not null default false,
  processed_at     timestamptz
);

create index meta_forms_raw_tenant_idx on meta.meta_forms_raw (mube_tenant_id);
create index meta_forms_raw_page_idx   on meta.meta_forms_raw (page_id);
create index meta_forms_raw_unprocessed_idx
  on meta.meta_forms_raw (received_at) where processed = false;

-- ----------------------------------------------------------------------------
-- meta.meta_form_groups — soft-delete via archived_at
-- ----------------------------------------------------------------------------
create table meta.meta_form_groups (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  description text,
  color       text,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  created_by  uuid
);

create index meta_form_groups_active_idx
  on meta.meta_form_groups (created_at desc) where archived_at is null;

-- ----------------------------------------------------------------------------
-- meta.meta_form_settings — 1:1 com meta.meta_forms_raw, auto-criado via trigger
-- ----------------------------------------------------------------------------
create table meta.meta_form_settings (
  form_id                 text        primary key
    references meta.meta_forms_raw (form_id) on delete cascade,
  display_name            text,
  language                text        not null default 'pt',
  language_auto_detected  boolean     not null default true,
  group_id                uuid        references meta.meta_form_groups (id) on delete set null,
  variant_label           text,
  notes                   text,
  updated_at              timestamptz not null default now(),
  updated_by              uuid
);

create index meta_form_settings_group_idx
  on meta.meta_form_settings (group_id) where group_id is not null;

create or replace function meta.tg_meta_forms_raw_create_settings()
returns trigger
language plpgsql
as $$
begin
  if new.form_id is not null then
    insert into meta.meta_form_settings (form_id, language, language_auto_detected)
    values (
      new.form_id,
      coalesce(nullif(split_part(new.locale, '_', 1), ''), 'pt'),
      true
    )
    on conflict (form_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger trg_meta_forms_raw_create_settings
after insert on meta.meta_forms_raw
for each row
execute function meta.tg_meta_forms_raw_create_settings();

-- ----------------------------------------------------------------------------
-- meta.meta_leads_raw — lead_id aponta para o lead canónico (public.leads) após processamento
-- ----------------------------------------------------------------------------
create table meta.meta_leads_raw (
  id               uuid        primary key default gen_random_uuid(),
  payload          jsonb       not null,
  leadgen_id       text        unique,
  mube_tenant_id   uuid,
  page_id          text,
  form_id          text,
  email            text,
  full_name        text,
  phone            text,
  signature_valid  boolean     not null default false,
  received_at      timestamptz not null default now(),
  processed        boolean     not null default false,
  processed_at     timestamptz,
  ad_id            text,
  campaign_id      text,
  lead_id          uuid,
  fb_created_time  timestamptz
);

create index meta_leads_raw_tenant_idx   on meta.meta_leads_raw (mube_tenant_id);
create index meta_leads_raw_form_idx     on meta.meta_leads_raw (form_id);
create index meta_leads_raw_ad_idx       on meta.meta_leads_raw (ad_id);
create index meta_leads_raw_campaign_idx on meta.meta_leads_raw (campaign_id);
create index meta_leads_raw_email_idx    on meta.meta_leads_raw (email) where email is not null;
create index meta_leads_raw_lead_idx     on meta.meta_leads_raw (lead_id) where lead_id is not null;
create index meta_leads_raw_unprocessed_idx
  on meta.meta_leads_raw (received_at) where processed = false;

-- ----------------------------------------------------------------------------
-- updated_at automático
-- ----------------------------------------------------------------------------
create or replace function meta.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_meta_integration_updated_at
before update on meta.meta_integration
for each row execute function meta.tg_set_updated_at();

create trigger trg_meta_form_settings_updated_at
before update on meta.meta_form_settings
for each row execute function meta.tg_set_updated_at();

-- ----------------------------------------------------------------------------
-- Grants — service_role tem acesso total (webhook usa admin client)
-- authenticated/anon ficam de fora; acesso é server-side via service_role
-- ----------------------------------------------------------------------------
grant usage on schema meta to service_role;
grant all on all tables in schema meta to service_role;
grant all on all sequences in schema meta to service_role;
grant execute on all functions in schema meta to service_role;

alter default privileges in schema meta grant all on tables to service_role;
alter default privileges in schema meta grant all on sequences to service_role;
alter default privileges in schema meta grant execute on functions to service_role;
