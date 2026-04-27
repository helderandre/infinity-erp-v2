-- ==================================================================
-- MIGRATION: neg_hooks_signed_received
-- ==================================================================
-- Hooks B + C — propagation triggers on `deal_payments`:
--
-- HOOK B (`propagate_deal_payment_signed`):
--   Quando `deal_payments.is_signed` flipa de false/null → true:
--     1. Garante `signed_date` preenchido (CURRENT_DATE se NULL).
--     2. Garante `date_type='confirmed'` (a default vem 'confirmed' mas
--        rows criadas ao submeter o deal entram como 'predicted' —
--        confirmar.).
--     3. Marca a row mais recente em `deal_events` (do mesmo deal +
--        event_type derivado do `payment_moment` + business_type) com
--        `occurred_at = signed_date` e `status='done'` (apenas se ainda
--        não estiver done/cancelled).
--     4. Denormaliza para `deals.cpcv_actual_date` ou
--        `escritura_actual_date` consoante o moment (apenas se ainda
--        NULL — preserva sobreposições manuais).
--
-- HOOK C (`propagate_deal_payment_received`):
--   Quando `deal_payments.is_received` flipa de false/null → true:
--     1. Garante `received_date` preenchido (CURRENT_DATE se NULL).
--     2. Cria UMA row em `company_transactions` (income, draft) com:
--          • `reference_type='deal_payment'`
--          • `reference_id=NEW.id`
--          • `category='Comissões Agência - <CPCV|Escritura|Contrato>'`
--          • `amount_net=COALESCE(agency_amount, amount, 0)`
--          • `description='Comissão recebida — <deal.reference> — <moment>'`
--          • `vat_pct=23` (default da tabela)
--     3. Idempotência via lookup `WHERE reference_type='deal_payment'
--        AND reference_id=NEW.id` — se já existir, skip silencioso.
--
-- Mapping `payment_moment → event_type`:
--   - 'cpcv'      → 'cpcv'
--   - 'escritura' → 'escritura'
--   - 'single'    → 'contrato_arrendamento' se business_type='arrendamento',
--                   senão 'escritura' (trespasse legal = escritura)
--
-- Os triggers são `BEFORE UPDATE` para permitir mutar NEW.signed_date /
-- NEW.received_date antes da row ser persistida (single transaction).
-- Writes a outras tabelas (deal_events, deals, company_transactions)
-- são seguros em BEFORE — funcionam como AFTER.
--
-- A reverse — flipar is_signed para false/null — é NO-OP: não desfaz a
-- propagação. Se um utilizador "des-assinar" por engano, tem de limpar
-- manualmente as denormalizações (decisão consciente: erro de input não
-- deve apagar histórico de eventos sem revisão humana).
--
-- ADITIVA. Revert no fim.
-- ==================================================================

-- ──────────────────────────────────────────────────────────────────
-- Hook B — signed → deal_events + deals
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.propagate_deal_payment_signed()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_event_type    text;
  v_business_type text;
  v_target_event  uuid;
BEGIN
  -- Só dispara quando is_signed flipa de false/null para true
  IF NOT (
    (COALESCE(OLD.is_signed, false) IS DISTINCT FROM COALESCE(NEW.is_signed, false))
    AND NEW.is_signed = true
  ) THEN
    RETURN NEW;
  END IF;

  -- 1. Garantir signed_date preenchido + date_type confirmado
  IF NEW.signed_date IS NULL THEN
    NEW.signed_date := CURRENT_DATE;
  END IF;

  IF NEW.date_type IS DISTINCT FROM 'confirmed' THEN
    NEW.date_type := 'confirmed';
  END IF;

  -- 2. Determinar event_type
  IF NEW.payment_moment = 'single' THEN
    SELECT business_type INTO v_business_type FROM public.deals WHERE id = NEW.deal_id;
    v_event_type := CASE WHEN v_business_type = 'arrendamento'
                         THEN 'contrato_arrendamento'
                         ELSE 'escritura' END;
  ELSIF NEW.payment_moment = 'cpcv' THEN
    v_event_type := 'cpcv';
  ELSIF NEW.payment_moment = 'escritura' THEN
    v_event_type := 'escritura';
  ELSE
    v_event_type := NULL;
  END IF;

  -- 3. Propagar para deal_events (a row mais recente por scheduled_at,
  --    ainda não concluída/cancelada)
  IF v_event_type IS NOT NULL THEN
    SELECT id INTO v_target_event
    FROM public.deal_events
    WHERE deal_id = NEW.deal_id
      AND event_type = v_event_type
      AND status NOT IN ('done', 'cancelled')
    ORDER BY scheduled_at DESC NULLS LAST, created_at DESC
    LIMIT 1;

    IF v_target_event IS NOT NULL THEN
      UPDATE public.deal_events
      SET occurred_at = COALESCE(occurred_at, NEW.signed_date::timestamptz),
          status      = 'done'
      WHERE id = v_target_event;
    END IF;
  END IF;

  -- 4. Denormalizar para deals (apenas se ainda NULL)
  IF NEW.payment_moment = 'cpcv' THEN
    UPDATE public.deals
    SET cpcv_actual_date = NEW.signed_date::timestamptz
    WHERE id = NEW.deal_id AND cpcv_actual_date IS NULL;
  ELSIF NEW.payment_moment IN ('escritura', 'single') THEN
    UPDATE public.deals
    SET escritura_actual_date = NEW.signed_date::timestamptz
    WHERE id = NEW.deal_id AND escritura_actual_date IS NULL;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_propagate_deal_payment_signed ON public.deal_payments;
CREATE TRIGGER trg_propagate_deal_payment_signed
  BEFORE UPDATE ON public.deal_payments
  FOR EACH ROW
  WHEN (NEW.is_signed IS DISTINCT FROM OLD.is_signed)
  EXECUTE FUNCTION public.propagate_deal_payment_signed();

COMMENT ON FUNCTION public.propagate_deal_payment_signed() IS
  'Hook B: when deal_payments.is_signed flips to true, mirrors signed_date to deal_events.occurred_at + status=done, and denormalizes to deals.cpcv_actual_date / escritura_actual_date.';

-- ──────────────────────────────────────────────────────────────────
-- Hook C — received → company_transactions draft
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.propagate_deal_payment_received()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_deal_reference text;
  v_category       text;
  v_description    text;
  v_amount         numeric;
BEGIN
  IF NOT (
    (COALESCE(OLD.is_received, false) IS DISTINCT FROM COALESCE(NEW.is_received, false))
    AND NEW.is_received = true
  ) THEN
    RETURN NEW;
  END IF;

  -- 1. Garantir received_date preenchido
  IF NEW.received_date IS NULL THEN
    NEW.received_date := CURRENT_DATE;
  END IF;

  -- 2. Idempotência: se já existe transação para este payment, skip
  IF EXISTS (
    SELECT 1 FROM public.company_transactions
    WHERE reference_type = 'deal_payment' AND reference_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  -- 3. Fetch deal reference for description
  SELECT reference INTO v_deal_reference
  FROM public.deals WHERE id = NEW.deal_id;

  -- 4. Categorização por moment
  v_category := CASE NEW.payment_moment
    WHEN 'cpcv'      THEN 'Comissões Agência - CPCV'
    WHEN 'escritura' THEN 'Comissões Agência - Escritura'
    WHEN 'single'    THEN 'Comissões Agência - Contrato'
    ELSE                  'Comissões Agência'
  END;

  v_description := 'Comissão recebida — '
    || COALESCE(v_deal_reference, NEW.deal_id::text)
    || ' — ' || NEW.payment_moment;

  v_amount := COALESCE(NEW.agency_amount, NEW.amount, 0);

  -- 5. Criar row em company_transactions (draft, IVA 23% default da tabela)
  INSERT INTO public.company_transactions (
    date,
    type,
    category,
    description,
    amount_net,
    reference_type,
    reference_id,
    status
  ) VALUES (
    NEW.received_date,
    'income',
    v_category,
    v_description,
    v_amount,
    'deal_payment',
    NEW.id,
    'draft'
  );

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_propagate_deal_payment_received ON public.deal_payments;
CREATE TRIGGER trg_propagate_deal_payment_received
  BEFORE UPDATE ON public.deal_payments
  FOR EACH ROW
  WHEN (NEW.is_received IS DISTINCT FROM OLD.is_received)
  EXECUTE FUNCTION public.propagate_deal_payment_received();

COMMENT ON FUNCTION public.propagate_deal_payment_received() IS
  'Hook C: when deal_payments.is_received flips to true, creates a company_transactions row (income, draft) with reference_type=deal_payment for accounting reconciliation. Idempotent.';

-- ==================================================================
-- REVERT
-- ==================================================================
-- DROP TRIGGER IF EXISTS trg_propagate_deal_payment_signed ON public.deal_payments;
-- DROP TRIGGER IF EXISTS trg_propagate_deal_payment_received ON public.deal_payments;
-- DROP FUNCTION IF EXISTS public.propagate_deal_payment_signed();
-- DROP FUNCTION IF EXISTS public.propagate_deal_payment_received();
