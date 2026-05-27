-- ============================================================================
-- 20260616_sync_property_status_with_deals.sql
--
-- Sincroniza `dev_properties.status` automaticamente com o estado dos
-- `deals` associados à property:
--   • >=1 deal submitted/active e sem completed   → 'reserved'
--   • deal completed com business_type ∈ {venda,trespasse} → 'sold'
--   • deal completed com business_type = arrendamento     → 'rented'
--   • caso contrário (todos draft/cancelled ou nenhum)     → 'active'
--
-- O recompute corre em AFTER INSERT/UPDATE OF status,property_id ON deals
-- e AFTER DELETE ON deals. Cobre transferências de property entre deals
-- (recompute em old + new) e ignora deals sem property_id (angariação
-- externa — não temos imóvel interno para mudar).
--
-- Estados administrativos preservados (não tocamos): 'pending_approval',
-- 'draft', 'suspended', 'cancelled'. Apenas auto-gerimos os estados
-- comerciais 'active', 'reserved', 'sold', 'rented'.
--
-- Idempotente: skip-UPDATE quando o status calculado iguala o actual.
--
-- Revert:
--   DROP TRIGGER IF EXISTS trg_deals_sync_property_status_iud ON public.deals;
--   DROP TRIGGER IF EXISTS trg_deals_sync_property_status_del ON public.deals;
--   DROP FUNCTION IF EXISTS public.sync_property_status_from_deals(uuid);
--   DROP FUNCTION IF EXISTS public.trg_deals_sync_property_status();
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_property_status_from_deals(p_property_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status text;
  v_next_status text;
  v_has_completed_venda boolean;
  v_has_completed_arrend boolean;
  v_has_active boolean;
BEGIN
  IF p_property_id IS NULL THEN
    RETURN;
  END IF;

  SELECT status INTO v_current_status
  FROM public.dev_properties
  WHERE id = p_property_id;

  -- Property foi eliminada entretanto ou nunca existiu — nada a fazer.
  IF v_current_status IS NULL THEN
    RETURN;
  END IF;

  -- Estados administrativos: não sobrepor com sync automática. O broker
  -- pode mover manualmente para qualquer destes e o trigger deixa-os em paz.
  IF v_current_status IN ('pending_approval', 'draft', 'suspended', 'cancelled') THEN
    RETURN;
  END IF;

  -- Inspecciona os deals associados à property para escolher o melhor estado.
  -- Prioridade: sold > rented > reserved > active.
  SELECT
    bool_or(d.status = 'completed' AND COALESCE(d.business_type, 'venda') IN ('venda', 'trespasse')),
    bool_or(d.status = 'completed' AND d.business_type = 'arrendamento'),
    bool_or(d.status IN ('submitted', 'active'))
  INTO
    v_has_completed_venda,
    v_has_completed_arrend,
    v_has_active
  FROM public.deals d
  WHERE d.property_id = p_property_id;

  IF COALESCE(v_has_completed_venda, false) THEN
    v_next_status := 'sold';
  ELSIF COALESCE(v_has_completed_arrend, false) THEN
    v_next_status := 'rented';
  ELSIF COALESCE(v_has_active, false) THEN
    v_next_status := 'reserved';
  ELSE
    v_next_status := 'active';
  END IF;

  IF v_next_status IS DISTINCT FROM v_current_status THEN
    UPDATE public.dev_properties
    SET status = v_next_status,
        updated_at = now()
    WHERE id = p_property_id;
  END IF;
END;
$$;


CREATE OR REPLACE FUNCTION public.trg_deals_sync_property_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.property_id IS NOT NULL THEN
      PERFORM public.sync_property_status_from_deals(OLD.property_id);
    END IF;
    RETURN OLD;
  END IF;

  -- INSERT/UPDATE: recompute new property. Em UPDATE com property_id
  -- transferido entre imóveis, recompute também o antigo.
  IF NEW.property_id IS NOT NULL THEN
    PERFORM public.sync_property_status_from_deals(NEW.property_id);
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.property_id IS NOT NULL
     AND OLD.property_id IS DISTINCT FROM NEW.property_id
  THEN
    PERFORM public.sync_property_status_from_deals(OLD.property_id);
  END IF;

  RETURN NEW;
END;
$$;


-- INSERT + UPDATE de status/property_id chamam o handler.
DROP TRIGGER IF EXISTS trg_deals_sync_property_status_iud ON public.deals;
CREATE TRIGGER trg_deals_sync_property_status_iud
AFTER INSERT OR UPDATE OF status, property_id
ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.trg_deals_sync_property_status();

-- DELETE precisa de trigger separado (FOR EACH ROW sem OF).
DROP TRIGGER IF EXISTS trg_deals_sync_property_status_del ON public.deals;
CREATE TRIGGER trg_deals_sync_property_status_del
AFTER DELETE
ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.trg_deals_sync_property_status();


-- ── Backfill: imóveis com deals existentes ficam alinhados imediatamente.
-- Lista distinct de property_ids de deals e re-evaluate cada um.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT property_id
    FROM public.deals
    WHERE property_id IS NOT NULL
  LOOP
    PERFORM public.sync_property_status_from_deals(r.property_id);
  END LOOP;
END;
$$;
