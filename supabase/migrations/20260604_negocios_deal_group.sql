-- Linked opportunities ("compra depende da venda")
--
-- A single lead/form can spawn two related négocios: a sale (Vendedor) and a
-- dependent purchase (Comprador) — e.g. the Meta Ads form asks "a compra
-- depende da venda?". We group such deals with a shared `deal_group_id` and
-- record the dependency direction via `depends_on_negocio_id` (set on the
-- purchase, pointing to the sale it depends on).
--
-- Additive / NULL-safe: standalone deals keep both columns NULL.
-- Revert:
--   drop index if exists public.idx_negocios_deal_group;
--   alter table public.negocios drop column if exists depends_on_negocio_id;
--   alter table public.negocios drop column if exists deal_group_id;

alter table public.negocios
  add column if not exists deal_group_id uuid,
  add column if not exists depends_on_negocio_id uuid
    references public.negocios(id) on delete set null;

create index if not exists idx_negocios_deal_group
  on public.negocios(deal_group_id)
  where deal_group_id is not null;

comment on column public.negocios.deal_group_id is
  'Groups related négocios born from the same lead/form (e.g. compra depende da venda). Shared UUID across the cluster; NULL for standalone deals.';
comment on column public.negocios.depends_on_negocio_id is
  'For a purchase contingent on a sale: the sale négocio this deal depends on. NULL otherwise.';
