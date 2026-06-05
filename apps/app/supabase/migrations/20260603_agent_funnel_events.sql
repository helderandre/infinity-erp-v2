-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: agent_funnel_events
-- Date: 2026-06-03
--
-- Purpose: single source of truth for realized progress against an agent's
-- v2 goal. Each row = one activity at one funnel stage. Both manual entries
-- and automatic hooks (Postgres triggers + app-level inserts) write here.
--
-- Stages match the v2 funnel:
--   contacto, pre_angariacao, estudo, angariacao  (vendedor captação)
--   visita, proposta, cpcv, fecho                 (terminal/activity stages)
--   pesquisa                                      (comprador-only stage)
--
-- Idempotency: unique index on (source_ref_type, source_ref_id, stage)
-- prevents duplicate auto-hooks (e.g., re-firing the cpcv_signed trigger).
-- Manual entries don't have source_ref_* set, so they're never deduped.
--
-- Triggers that write to this table are added in subsequent migrations:
--   - on deal_payments.is_signed flip → log 'cpcv'
--   - on deals.status='completed'    → log 'fecho'
--   - on negocios insert              → log 'pesquisa' or 'estudo' by tipo
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agent_funnel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.dev_users(id) ON DELETE CASCADE,
  side TEXT NOT NULL CHECK (side IN ('vendedor', 'comprador')),
  stage TEXT NOT NULL CHECK (stage IN (
    'contacto',
    'pre_angariacao',
    'estudo',
    'angariacao',
    'pesquisa',
    'visita',
    'proposta',
    'cpcv',
    'fecho'
  )),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  count INT NOT NULL DEFAULT 1 CHECK (count > 0),
  source TEXT NOT NULL,
  source_ref_type TEXT,
  source_ref_id UUID,
  notes TEXT,
  created_by UUID REFERENCES public.dev_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_funnel_events_agent_period
  ON public.agent_funnel_events(agent_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_funnel_events_agent_side_stage
  ON public.agent_funnel_events(agent_id, side, stage, occurred_at DESC);

-- Idempotency for auto-hooks: same source row at same stage = one event only
CREATE UNIQUE INDEX IF NOT EXISTS idx_funnel_events_source_dedup
  ON public.agent_funnel_events(source_ref_type, source_ref_id, stage)
  WHERE source_ref_type IS NOT NULL AND source_ref_id IS NOT NULL;

ALTER TABLE public.agent_funnel_events DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.agent_funnel_events IS
  'Realized funnel activity per agent. Manual entries + auto-hooks. Aggregated to compare against agent_goals targets.';
