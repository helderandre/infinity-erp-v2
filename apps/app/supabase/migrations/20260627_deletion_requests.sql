-- ============================================================================
-- Deletion requests (partner-approved deletion gate)
--
-- When an internal user tries to delete a lead (contacto) or negócio
-- (oportunidade) that originated from a PARCEIRO with app access (a dev_users
-- account holding the 'Parceiro' role, referenced via
-- negocios.referrer_consultant_id or leads_referrals.from_consultant_id), the
-- delete is intercepted: instead of removing the row we create a pending
-- deletion_request and notify the parceiro. The actual cascade delete only
-- runs once the parceiro approves (or a manager with the `users` permission
-- overrides — that path skips this table entirely).
--
-- entity_id has NO foreign key on purpose: it points to either `leads` or
-- `negocios` depending on entity_type, and the underlying row must survive
-- while the request is pending (so the parceiro can still see what they are
-- approving).
--
-- Additive. RLS left disabled to match sibling CRM tables (negocios,
-- partner_ledger_entries, deal_clients) — authorization is enforced in the API
-- layer (only the requester, the target partner, or a `users`-permission
-- manager can act on a request).
--
-- REVERT:
--   drop table if exists public.deletion_requests;
-- ============================================================================

create table if not exists public.deletion_requests (
  id             uuid primary key default gen_random_uuid(),
  entity_type    text not null check (entity_type in ('lead', 'negocio')),
  entity_id      uuid not null,
  -- The parceiro (dev_users id) whose approval is required.
  partner_id     uuid not null references public.dev_users(id) on delete cascade,
  -- Who asked for the deletion.
  requested_by   uuid not null references public.dev_users(id) on delete cascade,
  reason         text,
  status         text not null default 'pending'
                   check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  -- Denormalized display data so the partner sees what they're approving even
  -- though the underlying lead/negócio row still exists (e.g. name, value).
  snapshot       jsonb not null default '{}'::jsonb,
  decided_by     uuid references public.dev_users(id) on delete set null,
  decided_at     timestamptz,
  decision_notes text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_deletion_requests_partner_status
  on public.deletion_requests(partner_id, status);
create index if not exists idx_deletion_requests_requested_by
  on public.deletion_requests(requested_by);
create index if not exists idx_deletion_requests_entity
  on public.deletion_requests(entity_type, entity_id);

-- At most one pending request per entity — makes the intercept idempotent
-- (a second delete attempt returns the existing pending request).
create unique index if not exists deletion_requests_pending_uniq
  on public.deletion_requests(entity_type, entity_id)
  where status = 'pending';

-- keep updated_at fresh on decision
create or replace function public.touch_deletion_requests_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_deletion_requests_updated_at on public.deletion_requests;
create trigger trg_deletion_requests_updated_at
  before update on public.deletion_requests
  for each row execute function public.touch_deletion_requests_updated_at();
