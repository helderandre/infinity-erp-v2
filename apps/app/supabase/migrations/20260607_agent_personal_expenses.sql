-- Despesas pessoais do consultor — versão simples (sem arquivo digital
-- substitutivo de papel; o consultor mantém os recibos físicos).
--
-- Objectivo: dar ao consultor um sítio para registar despesas de actividade
-- comercial (combustível, almoços, brindes, etc.) com upload de foto/PDF de
-- recibo e extracção automática por IA, isolado da contabilidade da empresa.
--
-- Privacidade: RLS self-only. Gestão NÃO vê via API normal. Acesso só via
-- service_role para investigações pontuais.
--
-- Upgrade path: as colunas de arquivo certificável (receipt_hash,
-- archive_chain_hash, archive_status, etc.) podem ser adicionadas
-- aditivamente numa migration futura quando quisermos transformar isto em
-- arquivo substitutivo conforme art. 19.º DL 28/2019. Ver
-- openspec/changes/add-agent-personal-expenses/ para a versão compliant.

CREATE TABLE IF NOT EXISTS public.agent_personal_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.dev_users(id) ON DELETE CASCADE,

  expense_date date NOT NULL,
  category text NOT NULL,
  description text,

  vendor_name text,
  vendor_nif text,

  amount_gross numeric(12,2) NOT NULL CHECK (amount_gross >= 0),
  amount_net numeric(12,2) CHECK (amount_net IS NULL OR amount_net >= 0),
  vat_amount numeric(12,2) CHECK (vat_amount IS NULL OR vat_amount >= 0),
  vat_pct numeric(5,2) CHECK (vat_pct IS NULL OR (vat_pct >= 0 AND vat_pct <= 100)),
  invoice_number text,

  receipt_url text,
  receipt_mimetype text,
  receipt_size_bytes bigint,

  ocr_confidence numeric(3,2) CHECK (ocr_confidence IS NULL OR (ocr_confidence >= 0 AND ocr_confidence <= 1)),
  ocr_field_confidences jsonb,

  notes text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_personal_expenses_agent_date
  ON public.agent_personal_expenses(agent_id, expense_date DESC);

-- Trigger updated_at (reusa padrão existente se presente; caso contrário cria)
CREATE OR REPLACE FUNCTION public.set_updated_at_agent_personal_expenses()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_updated_at_agent_personal_expenses
  ON public.agent_personal_expenses;
CREATE TRIGGER trg_set_updated_at_agent_personal_expenses
BEFORE UPDATE ON public.agent_personal_expenses
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_agent_personal_expenses();

-- RLS self-only — gestão não vê
ALTER TABLE public.agent_personal_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agent_personal_expenses_self_rw
  ON public.agent_personal_expenses;
CREATE POLICY agent_personal_expenses_self_rw
  ON public.agent_personal_expenses
  FOR ALL
  TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

COMMENT ON TABLE public.agent_personal_expenses IS
  'Despesas pessoais do consultor. RLS self-only. Isolada da contabilidade da empresa (não toca em company_transactions / conta_corrente_transactions).';
