-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: agent_goals + agent_goal_targets (v2 goal-setting model)
-- Date: 2026-06-01
--
-- Purpose: New goal-setting model based on absolute step counts ("how many X
-- do I need to get 1 Y") instead of percentages. Lives ALONGSIDE the existing
-- temp_consultant_goals table — does NOT replace or migrate it.
--
-- Spec:
--   - One row per (agent_id, period_year)
--   - Backward-chained funnel: Escritura → CPCV → Proposta → … → Contacto
--   - CPCV→Escritura is a constant 0.95 (NOT a user input)
--   - agent_goal_targets is a recomputed cache (one row per goal_id)
--
-- Note on naming: spec says "agents(id)" but this codebase uses dev_users(id).
-- We keep the spec's column name "agent_id" but FK to dev_users.
--
-- Revert:
--   DROP TABLE IF EXISTS public.agent_goal_targets CASCADE;
--   DROP TABLE IF EXISTS public.agent_goals CASCADE;
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agent_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.dev_users(id) ON DELETE CASCADE,
  period_year INT NOT NULL,
  annual_revenue_target_eur NUMERIC NOT NULL CHECK (annual_revenue_target_eur > 0),
  pct_vendedores NUMERIC NOT NULL CHECK (pct_vendedores BETWEEN 0 AND 100),
  pct_compradores NUMERIC NOT NULL CHECK (pct_compradores BETWEEN 0 AND 100),
  working_weeks_per_year INT NOT NULL DEFAULT 48 CHECK (working_weeks_per_year BETWEEN 1 AND 52),
  working_days_per_week INT NOT NULL DEFAULT 5 CHECK (working_days_per_week BETWEEN 1 AND 7),

  -- Vendedor economics
  vendedor_avg_sale_value_eur NUMERIC NOT NULL CHECK (vendedor_avg_sale_value_eur > 0),
  vendedor_commission_pct NUMERIC NOT NULL CHECK (vendedor_commission_pct >= 0 AND vendedor_commission_pct <= 100),

  -- Vendedor Card A: Captação (3 ratios — "para cada 1 X, preciso de N Y")
  vend_contactos_per_pre_angariacao NUMERIC NOT NULL CHECK (vend_contactos_per_pre_angariacao > 0),
  vend_pre_angariacoes_per_estudo NUMERIC NOT NULL CHECK (vend_pre_angariacoes_per_estudo > 0),
  vend_estudos_per_angariacao NUMERIC NOT NULL CHECK (vend_estudos_per_angariacao > 0),

  -- Vendedor Card B: Angariação ao Fecho (3 ratios)
  vend_angariacoes_per_escritura NUMERIC NOT NULL CHECK (vend_angariacoes_per_escritura > 0),
  vend_visitas_per_proposta NUMERIC NOT NULL CHECK (vend_visitas_per_proposta > 0),
  vend_propostas_per_cpcv NUMERIC NOT NULL CHECK (vend_propostas_per_cpcv > 0),

  -- Comprador economics
  comp_avg_purchase_value_eur NUMERIC NOT NULL CHECK (comp_avg_purchase_value_eur > 0),
  comp_commission_pct NUMERIC NOT NULL CHECK (comp_commission_pct >= 0 AND comp_commission_pct <= 100),

  -- Comprador funnel (4 ratios)
  comp_contactos_per_pesquisa NUMERIC NOT NULL CHECK (comp_contactos_per_pesquisa > 0),
  comp_pesquisas_per_visita NUMERIC NOT NULL CHECK (comp_pesquisas_per_visita > 0),
  comp_visitas_per_proposta NUMERIC NOT NULL CHECK (comp_visitas_per_proposta > 0),
  comp_propostas_per_cpcv NUMERIC NOT NULL CHECK (comp_propostas_per_cpcv > 0),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT agent_goals_agent_year_unique UNIQUE (agent_id, period_year),
  CONSTRAINT agent_goals_pct_sum_100 CHECK (
    ABS((pct_vendedores + pct_compradores) - 100) < 0.01
  )
);

CREATE INDEX IF NOT EXISTS idx_agent_goals_agent_year
  ON public.agent_goals(agent_id, period_year DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- agent_goal_targets — recomputed cache. One row per goal.
-- Recomputed app-side after every upsert of agent_goals.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agent_goal_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_goal_id UUID NOT NULL REFERENCES public.agent_goals(id) ON DELETE CASCADE,

  -- Vendedor annual targets
  vend_target_escrituras NUMERIC NOT NULL,
  vend_target_cpcvs NUMERIC NOT NULL,
  vend_target_propostas NUMERIC NOT NULL,
  vend_target_visitas NUMERIC NOT NULL,
  vend_target_angariacoes NUMERIC NOT NULL,
  vend_target_estudos NUMERIC NOT NULL,
  vend_target_pre_angariacoes NUMERIC NOT NULL,
  vend_target_contactos NUMERIC NOT NULL,
  vend_projected_revenue_eur NUMERIC NOT NULL,

  -- Comprador annual targets
  comp_target_escrituras NUMERIC NOT NULL,
  comp_target_cpcvs NUMERIC NOT NULL,
  comp_target_propostas NUMERIC NOT NULL,
  comp_target_visitas NUMERIC NOT NULL,
  comp_target_pesquisas NUMERIC NOT NULL,
  comp_target_contactos NUMERIC NOT NULL,
  comp_projected_revenue_eur NUMERIC NOT NULL,

  -- Weekly breakdown
  vend_contactos_per_week NUMERIC NOT NULL,
  vend_visitas_per_week NUMERIC NOT NULL,
  comp_contactos_per_week NUMERIC NOT NULL,
  comp_visitas_per_week NUMERIC NOT NULL,

  total_projected_revenue_eur NUMERIC NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT agent_goal_targets_goal_unique UNIQUE (agent_goal_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_goal_targets_goal
  ON public.agent_goal_targets(agent_goal_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at trigger on agent_goals
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_agent_goals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agent_goals_updated_at ON public.agent_goals;
CREATE TRIGGER trg_agent_goals_updated_at
  BEFORE UPDATE ON public.agent_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_agent_goals_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS: permissive for authenticated. Authorization is enforced server-side
-- (matching the pattern used by temp_consultant_goals which has RLS disabled).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.agent_goals DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_goal_targets DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.agent_goals IS
  'v2 goal-setting model. Backward-chained funnel ratios (absolute step counts). Coexists with temp_consultant_goals (legacy).';
COMMENT ON TABLE public.agent_goal_targets IS
  'Recomputed cache of derived annual + weekly targets for agent_goals. Populated app-side after every upsert.';
