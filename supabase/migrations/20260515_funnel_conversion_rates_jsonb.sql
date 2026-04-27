-- ============================================================================
-- 20260515_funnel_conversion_rates_jsonb.sql
--
-- Adds a single JSONB column to `temp_consultant_goals` that stores per-stage
-- conversion rates aligned with the new 6/8-stage funnel structure:
--
--   {
--     "buyer": {
--       "contactos": 0.5,            // contactos → pesquisa
--       "pesquisa":  0.4,            // pesquisa  → visita
--       "visita":    0.3,            // visita    → proposta
--       "proposta":  0.6,            // proposta  → cpcv
--       "cpcv":      1.0             // cpcv      → escritura
--     },
--     "seller": {
--       "contactos":      0.4,       // contactos        → pré-angariação
--       "pre_angariacao": 0.7,       // pré-angariação   → estudo de mercado
--       "estudo_mercado": 0.8,       // estudo de mercado → angariação
--       "angariacao":     0.5,       // angariação       → visita
--       "visita":         0.25,      // visita           → proposta
--       "proposta":       0.7,       // proposta         → cpcv
--       "cpcv":           1.0        // cpcv             → escritura
--     }
--   }
--
-- The legacy fields (sellers_avg_sale_value, ..., buyers_close_rate, ...) are
-- kept untouched for now; the new funnel API reads from this JSONB first and
-- falls back to the hardcoded defaults in lib/goals/funnel/stages.ts when
-- empty/missing.
--
-- Revert:
--   ALTER TABLE public.temp_consultant_goals DROP COLUMN IF EXISTS funnel_conversion_rates;
-- ============================================================================

ALTER TABLE public.temp_consultant_goals
  ADD COLUMN IF NOT EXISTS funnel_conversion_rates jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.temp_consultant_goals.funnel_conversion_rates IS
  'Taxas de conversão por etapa, alinhadas com a estrutura nova de 6 etapas (compradores) e 8 etapas (vendedores). Forma: {"buyer": {"<stage_key>": <rate 0-1>}, "seller": {"<stage_key>": <rate 0-1>}}. Cada rate representa a transição da etapa para a SEGUINTE. Valores ausentes caem nos defaults em lib/goals/funnel/stages.ts.';
