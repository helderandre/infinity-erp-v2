-- Integração Marketing/Loja → Despesas pessoais
--
-- Quando uma encomenda da loja institucional é paga com NIF próprio do
-- consultor (`payment_method='invoice'`) e é aceite pelo backoffice,
-- queremos que apareça automaticamente nas Despesas pessoais do consultor
-- (`agent_personal_expenses`) com a categoria "Loja institucional".
--
-- Razões:
-- - Compras via conta corrente já aparecem no timeline via
--   conta_corrente_transactions (category='marketing_purchase').
-- - Compras via invoice ficavam invisíveis para o consultor — buraco UX.
--
-- Este trigger faz o espelhamento. Reverte (DELETE) se a encomenda for
-- rejeitada/cancelada após aceitação. Idempotente.

-- ─── 1. Coluna de rastreabilidade em agent_personal_expenses ──────────────
ALTER TABLE public.agent_personal_expenses
  ADD COLUMN IF NOT EXISTS source_marketing_order_id uuid
    REFERENCES public.marketing_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agent_personal_expenses_marketing_order
  ON public.agent_personal_expenses(source_marketing_order_id)
  WHERE source_marketing_order_id IS NOT NULL;

-- ─── 2. Função que cria a despesa pessoal a partir da encomenda ──────────
CREATE OR REPLACE FUNCTION public.create_personal_expense_from_marketing_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_items_summary text;
  v_amount_net numeric;
  v_vat_amount numeric;
BEGIN
  -- Snapshot dos items (até 5 nomes). Ordena por id para estabilidade
  -- (marketing_order_items tem apenas updated_at, sem created_at).
  SELECT string_agg(name, ', ')
  INTO v_items_summary
  FROM (
    SELECT name FROM public.marketing_order_items
    WHERE order_id = NEW.id
    ORDER BY id
    LIMIT 5
  ) t;

  IF v_items_summary IS NULL THEN
    v_items_summary := 'Loja institucional';
  END IF;

  -- IVA implícita 23% — taxa standard da maioria dos serviços de marketing.
  -- O backoffice pode editar manualmente no detail sheet se for diferente.
  v_amount_net := round(NEW.total_amount / 1.23, 2);
  v_vat_amount := NEW.total_amount - v_amount_net;

  -- INSERT idempotente — se já existir, não recria.
  INSERT INTO public.agent_personal_expenses (
    agent_id,
    expense_date,
    category,
    description,
    vendor_name,
    vendor_nif,
    amount_gross,
    amount_net,
    vat_amount,
    vat_pct,
    notes,
    source_marketing_order_id
  )
  SELECT
    NEW.agent_id,
    CURRENT_DATE,
    'Loja institucional',
    v_items_summary,
    'Infinity Group — Loja',
    NULL, -- NIF da empresa pode ser preenchido depois se necessário
    NEW.total_amount,
    v_amount_net,
    v_vat_amount,
    23,
    'Encomenda da loja institucional · pago com NIF próprio',
    NEW.id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.agent_personal_expenses
    WHERE source_marketing_order_id = NEW.id
  );

  RETURN NEW;
END $$;

-- ─── 3. Função que reverte a despesa pessoal se a encomenda for rejeitada ─
CREATE OR REPLACE FUNCTION public.delete_personal_expense_from_marketing_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.agent_personal_expenses
  WHERE source_marketing_order_id = NEW.id;
  RETURN NEW;
END $$;

-- ─── 4. Trigger AFTER INSERT — para encomendas criadas directamente
-- com status='accepted' (cron de renovação de subscrições) ─────────────────
DROP TRIGGER IF EXISTS trg_marketing_order_invoice_to_expense_insert
  ON public.marketing_orders;

CREATE TRIGGER trg_marketing_order_invoice_to_expense_insert
AFTER INSERT ON public.marketing_orders
FOR EACH ROW
WHEN (NEW.payment_method = 'invoice' AND NEW.status = 'accepted')
EXECUTE FUNCTION public.create_personal_expense_from_marketing_order();

-- ─── 5. Trigger AFTER UPDATE — para encomendas que transitam para accepted
-- depois de criadas (admin aceita via UI) ─────────────────────────────────
DROP TRIGGER IF EXISTS trg_marketing_order_invoice_to_expense_update
  ON public.marketing_orders;

CREATE TRIGGER trg_marketing_order_invoice_to_expense_update
AFTER UPDATE OF status ON public.marketing_orders
FOR EACH ROW
WHEN (
  NEW.payment_method = 'invoice'
  AND OLD.status IS DISTINCT FROM NEW.status
  AND NEW.status = 'accepted'
)
EXECUTE FUNCTION public.create_personal_expense_from_marketing_order();

-- ─── 6. Trigger AFTER UPDATE — reverter quando rejected/cancelled ────────
DROP TRIGGER IF EXISTS trg_marketing_order_revert_expense
  ON public.marketing_orders;

CREATE TRIGGER trg_marketing_order_revert_expense
AFTER UPDATE OF status ON public.marketing_orders
FOR EACH ROW
WHEN (
  NEW.payment_method = 'invoice'
  AND OLD.status IS DISTINCT FROM NEW.status
  AND NEW.status IN ('rejected', 'cancelled')
)
EXECUTE FUNCTION public.delete_personal_expense_from_marketing_order();

COMMENT ON COLUMN public.agent_personal_expenses.source_marketing_order_id IS
  'FK para marketing_orders. Quando NOT NULL, esta despesa foi criada automaticamente pelo trigger trg_marketing_order_invoice_to_expense_insert quando a encomenda foi paga com NIF próprio (payment_method=invoice) e aceite. Editável pelo consultor — categoria/notas/etc. — mas a chave de rastreabilidade fica.';
