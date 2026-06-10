-- Soft-hide ("eliminar" do lado do consultor) para leads/oportunidades
-- referenciadas por um parceiro.
--
-- Substitui o antigo fluxo de "pedido de eliminação com aprovação do parceiro":
-- quando o consultor elimina uma lead/oportunidade que tem um parceiro como
-- referenciado, em vez de pedir aprovação, a linha é marcada como escondida do
-- lado do consultor (consultor_hidden_at = now()). Desaparece das vistas do
-- ERP (kanban/listas) mas mantém-se na base de dados e continua visível ao
-- parceiro no portal (vistas scoped por referrer_consultant_id / scope=referred).
--
-- Aditivo e NULL-safe. Revert:
--   ALTER TABLE public.negocios      DROP COLUMN IF EXISTS consultor_hidden_at;
--   ALTER TABLE public.leads         DROP COLUMN IF EXISTS consultor_hidden_at;
--   ALTER TABLE public.leads_entries DROP COLUMN IF EXISTS consultor_hidden_at;

ALTER TABLE public.negocios      ADD COLUMN IF NOT EXISTS consultor_hidden_at timestamptz;
ALTER TABLE public.leads         ADD COLUMN IF NOT EXISTS consultor_hidden_at timestamptz;
ALTER TABLE public.leads_entries ADD COLUMN IF NOT EXISTS consultor_hidden_at timestamptz;

-- Índices parciais — as queries de leitura filtram `consultor_hidden_at IS NULL`
-- no caminho do consultor; o índice parcial mantém-no barato.
CREATE INDEX IF NOT EXISTS idx_negocios_consultor_hidden
  ON public.negocios (id) WHERE consultor_hidden_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_consultor_hidden
  ON public.leads (id) WHERE consultor_hidden_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_entries_consultor_hidden
  ON public.leads_entries (id) WHERE consultor_hidden_at IS NOT NULL;
