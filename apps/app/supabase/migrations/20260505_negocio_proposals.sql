-- ─────────────────────────────────────────────────────────────────────────────
-- 20260505 — negocio_proposals
--
-- Propostas feitas no contexto de um negócio (lado comprador / arrendatário).
-- Cada proposta ata um valor a um imóvel (do dossier ou externo). Quando
-- aceite, dispara o formulário de fecho que cria um row em `deals`. O link
-- bidireccional fica em `negocio_proposals.deal_id`.
--
-- Aditivo. Tabela nova; não toca em nada existente.
--
-- Revert:
--   DROP TABLE IF EXISTS public.negocio_proposals;
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.negocio_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id uuid NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,

  -- Imóvel: pode ser do dossier (negocio_property_id) ou directo via property_id
  -- (links externos não suportam proposta nesta primeira versão).
  negocio_property_id uuid REFERENCES public.negocio_properties(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.dev_properties(id) ON DELETE SET NULL,

  amount numeric(12,2),
  currency text NOT NULL DEFAULT 'EUR',

  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),

  -- Direcção da proposta:
  -- 'outbound' = nós (consultor) fizemos a proposta em nome do cliente
  -- 'inbound'  = recebemos uma contra-proposta do vendedor
  direction text NOT NULL DEFAULT 'outbound'
    CHECK (direction IN ('outbound', 'inbound')),

  notes text,
  rejected_reason text,
  rejected_at timestamptz,
  withdrawn_at timestamptz,
  accepted_at timestamptz,

  -- Quando aceite, link para o deal criado pelo DealForm.
  deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL,

  created_by uuid REFERENCES public.dev_users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_negocio_proposals_negocio
  ON public.negocio_proposals (negocio_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_negocio_proposals_status
  ON public.negocio_proposals (status);

CREATE INDEX IF NOT EXISTS idx_negocio_proposals_deal
  ON public.negocio_proposals (deal_id)
  WHERE deal_id IS NOT NULL;

-- updated_at auto via trigger
CREATE OR REPLACE FUNCTION public.tg_negocio_proposals_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_negocio_proposals_updated_at ON public.negocio_proposals;
CREATE TRIGGER trg_negocio_proposals_updated_at
  BEFORE UPDATE ON public.negocio_proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_negocio_proposals_set_updated_at();

-- RLS permissiva para authenticated (segue padrão de negocio_properties)
ALTER TABLE public.negocio_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS negocio_proposals_select ON public.negocio_proposals;
CREATE POLICY negocio_proposals_select
  ON public.negocio_proposals
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS negocio_proposals_insert ON public.negocio_proposals;
CREATE POLICY negocio_proposals_insert
  ON public.negocio_proposals
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS negocio_proposals_update ON public.negocio_proposals;
CREATE POLICY negocio_proposals_update
  ON public.negocio_proposals
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS negocio_proposals_delete ON public.negocio_proposals;
CREATE POLICY negocio_proposals_delete
  ON public.negocio_proposals
  FOR DELETE
  TO authenticated
  USING (true);

COMMENT ON TABLE public.negocio_proposals IS
  'Propostas feitas no contexto de um negócio (compra/arrendamento). Aceitar dispara o DealForm que cria um row em deals.';
