-- Recorrências de despesas pessoais — pagamentos mensais.
--
-- Modelo: o consultor cria uma "regra" com snapshot dos campos da despesa
-- (categoria, vendor, montantes, IVA, etc.) + dia do mês. Um cron diário
-- gera uma nova entrada em agent_personal_expenses sempre que o dia bate
-- e ainda não houve geração no mês corrente.
--
-- Edge cases:
--   - Mês com menos dias que day_of_month (ex: 31 em Fev) → usa último dia
--     do mês (a função do cron é responsável por isto).
--   - last_generated_at é a data efectiva da última despesa criada; serve
--     para evitar duplicação se o cron correr múltiplas vezes no mesmo dia.
--
-- Privacidade: RLS self-only, alinhada com agent_personal_expenses.

CREATE TABLE IF NOT EXISTS public.agent_personal_expense_recurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.dev_users(id) ON DELETE CASCADE,

  -- Snapshot dos dados da despesa
  category text NOT NULL,
  description text,
  vendor_name text,
  vendor_nif text,
  amount_gross numeric(12,2) NOT NULL CHECK (amount_gross >= 0),
  amount_net numeric(12,2),
  vat_amount numeric(12,2),
  vat_pct numeric(5,2),
  invoice_number text,
  notes text,

  -- Regra de recorrência (mensal por agora; deixa porta aberta a yearly/weekly)
  frequency text NOT NULL DEFAULT 'monthly'
    CHECK (frequency IN ('monthly')),
  day_of_month int NOT NULL CHECK (day_of_month >= 1 AND day_of_month <= 31),
  start_date date NOT NULL,
  end_date date,

  is_active boolean NOT NULL DEFAULT true,
  last_generated_at date,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_personal_expense_recurrences_agent_active
  ON public.agent_personal_expense_recurrences(agent_id, is_active);

CREATE INDEX IF NOT EXISTS idx_agent_personal_expense_recurrences_due
  ON public.agent_personal_expense_recurrences(is_active, day_of_month)
  WHERE is_active = true;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at_recurrences()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_updated_at_recurrences
  ON public.agent_personal_expense_recurrences;
CREATE TRIGGER trg_set_updated_at_recurrences
BEFORE UPDATE ON public.agent_personal_expense_recurrences
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_recurrences();

-- RLS self-only
ALTER TABLE public.agent_personal_expense_recurrences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recurrences_self_rw
  ON public.agent_personal_expense_recurrences;
CREATE POLICY recurrences_self_rw
  ON public.agent_personal_expense_recurrences
  FOR ALL
  TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

-- Coluna em agent_personal_expenses para ligar uma despesa à regra que a gerou
ALTER TABLE public.agent_personal_expenses
  ADD COLUMN IF NOT EXISTS recurrence_id uuid
    REFERENCES public.agent_personal_expense_recurrences(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agent_personal_expenses_recurrence
  ON public.agent_personal_expenses(recurrence_id)
  WHERE recurrence_id IS NOT NULL;

COMMENT ON TABLE public.agent_personal_expense_recurrences IS
  'Regras de recorrência de despesas pessoais (pagamentos mensais). Cron diário gera entradas em agent_personal_expenses.';
