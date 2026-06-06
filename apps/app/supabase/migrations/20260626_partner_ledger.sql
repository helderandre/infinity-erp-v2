-- ============================================================================
-- Partner ledger ("conta corrente" de parceiros)
--
-- Running account for referral partners (internal dev_users who are the
-- referrer_consultant_id on referred negocios). Management confirms each
-- commission (credit) and records payments (debit); balance = Σcredits −
-- Σdebits, computed dynamically in the API (no stored balance_after, so
-- out-of-order backfills stay correct). Isolated table (referral money kept
-- separate from agent conta_corrente_transactions).
--
-- Additive. RLS left disabled to match sibling CRM tables (negocios,
-- deal_clients) — authorization enforced in the API layer.
--
-- REVERT:
--   drop table if exists public.partner_ledger_entries;
-- ============================================================================

create table if not exists public.partner_ledger_entries (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid not null references public.dev_users(id) on delete cascade,
  kind        text not null check (kind in ('commission','payment','adjustment')),
  direction   text not null check (direction in ('credit','debit')),
  amount      numeric(12,2) not null check (amount > 0),
  status      text not null default 'completed' check (status in ('pending','paid','completed')),
  negocio_id  uuid references public.negocios(id) on delete set null,
  description text,
  entry_date  date not null default current_date,
  created_by  uuid references public.dev_users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_partner_ledger_partner
  on public.partner_ledger_entries(partner_id);
create index if not exists idx_partner_ledger_partner_status
  on public.partner_ledger_entries(partner_id, status);
-- One confirmed commission per deal — makes confirm-commission idempotent.
create unique index if not exists partner_ledger_commission_uniq
  on public.partner_ledger_entries(negocio_id)
  where kind = 'commission';

comment on table public.partner_ledger_entries is
  'Running account of referral commissions (credits) and payments (debits) per partner (referrer dev_users). Balance = Σcredits − Σdebits, computed in the API.';

-- Seed: the 3500€ advance paid to Digital Revolution to kickstart the project.
-- Guarded so re-running the migration does not duplicate it.
insert into public.partner_ledger_entries (partner_id, kind, direction, amount, status, description, entry_date)
select du.id, 'payment', 'debit', 3500, 'completed', 'Adiantamento — arranque do projeto', current_date
from public.dev_users du
where du.commercial_name ilike 'Digital Revolution'
  and not exists (
    select 1 from public.partner_ledger_entries e
    where e.partner_id = du.id
      and e.kind = 'payment'
      and e.description = 'Adiantamento — arranque do projeto'
  )
limit 1;
