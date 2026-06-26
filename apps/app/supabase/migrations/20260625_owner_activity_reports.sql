-- ════════════════════════════════════════════════════════════════════════
-- Relatório de Atividade ao Proprietário (owner activity report)
-- ════════════════════════════════════════════════════════════════════════
-- PDF customizável apresentado ao proprietário com a atividade de marketing e
-- vendas de UM imóvel: funil (leads → pedidos de visita → visitas → interesse),
-- feedback agregado das fichas de visita (k-anonimato, só consentidas), campanhas
-- Meta (pró-rata), dias em mercado e preço pedido vs. valor percebido.
--
-- Histórico VERSIONADO: cada geração guarda a config usada + um SNAPSHOT dos
-- dados agregados no momento (rigor histórico: visitas/fichas mudam ao longo do
-- tempo) + o URL do PDF arquivado em R2. A página SSR de render lê deste snapshot.
--
-- Aditiva. RLS ON sem policies = só service-role (admin client) lê/escreve,
-- igual à abordagem das outras tabelas de geração de documentos.
--
-- Revert:
--   drop table if exists public.owner_activity_reports;
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.owner_activity_reports (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.dev_properties(id) on delete cascade,
  -- token opaco para futuros links de partilha (o PDF é o entregável; render é por id)
  share_token   uuid not null default gen_random_uuid(),
  -- versão incremental por imóvel (calculada no endpoint: max(version)+1)
  version       int  not null default 1,
  title         text,
  -- blocos ligados/desligados + campos manuais (visualizações de portais),
  -- limiar de anonimato, modo do gasto Meta, nota do consultor, período
  config        jsonb not null default '{}'::jsonb,
  -- agregados calculados no momento da geração (fonte de verdade do render)
  data_snapshot jsonb not null default '{}'::jsonb,
  pdf_url       text,
  status        text not null default 'generating', -- generating | ready | error
  error         text,
  generated_by  uuid references public.dev_users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_owner_activity_reports_property
  on public.owner_activity_reports (property_id, created_at desc);

create unique index if not exists idx_owner_activity_reports_token
  on public.owner_activity_reports (share_token);

-- updated_at automático (reutiliza a função genérica do projeto se existir)
do $$
begin
  if exists (
    select 1 from pg_proc where proname = 'set_updated_at'
  ) then
    drop trigger if exists trg_owner_activity_reports_updated_at on public.owner_activity_reports;
    create trigger trg_owner_activity_reports_updated_at
      before update on public.owner_activity_reports
      for each row execute function public.set_updated_at();
  end if;
end$$;

alter table public.owner_activity_reports enable row level security;
-- Sem policies: acesso apenas via service-role (createAdminClient), como
-- property_presentations. A autorização é feita server-side em requirePermission.
