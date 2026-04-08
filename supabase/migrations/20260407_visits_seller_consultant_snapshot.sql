-- Snapshot do consultor vendedor (seller agent) na tabela `visits`.
--
-- Motivação:
-- ----------
-- Antes desta migration, o "consultor vendedor" de uma visita era derivado em
-- runtime de `dev_properties.consultant_id`. Isto significava que se uma
-- angariação fosse reatribuída a outro consultor, o histórico das visitas
-- passadas mudava retroactivamente — uma visita feita pelo António em Janeiro
-- aparecia, depois da reatribuição, como tendo sido feita pela Cláudia.
-- Os relatórios de objectivos por consultor passavam a estar errados.
--
-- Solução: gravar o `seller_consultant_id` na linha da `visits` no momento da
-- criação. Mesmo que a `dev_properties.consultant_id` mude depois, o histórico
-- da visita mantém-se intacto.
--
-- Política de reatribuição (snapshot rígido):
-- -------------------------------------------
-- - Visitas existentes (passadas, presentes E futuras) NÃO são afectadas por
--   reatribuições posteriores da angariação.
-- - Apenas visitas marcadas DEPOIS de uma reatribuição apanham o novo consultor.
-- - Se quiseres transferir explicitamente visitas pendentes para o novo
--   consultor, isso fica como acção manual / feature futura.
--
-- Casos especiais:
-- ----------------
-- - Se a `property_id` da visita for alterada (PUT /api/visits/[id]), o trigger
--   re-snapshota o seller a partir da nova angariação — porque é efectivamente
--   uma visita a outra coisa.
-- - Se a propriedade não tem `consultant_id` no momento da criação, o snapshot
--   fica NULL. O aggregator do calendário lida com isso (não mostra seller).

-- 1. Coluna nova
ALTER TABLE visits
  ADD COLUMN IF NOT EXISTS seller_consultant_id UUID
    REFERENCES dev_users(id) ON DELETE SET NULL;

-- 2. Backfill de visitas existentes
--    (snapshot tirado a partir do estado actual de dev_properties)
UPDATE visits v
SET seller_consultant_id = p.consultant_id
FROM dev_properties p
WHERE p.id = v.property_id
  AND v.seller_consultant_id IS NULL;

-- 3. Índice para queries de Goals (count by seller_consultant_id por período)
CREATE INDEX IF NOT EXISTS idx_visits_seller_consultant_id
  ON visits(seller_consultant_id)
  WHERE seller_consultant_id IS NOT NULL;

-- 4. Trigger function: snapshot automático no INSERT, e re-snapshot no UPDATE
--    quando `property_id` muda. Garantia de que nenhum caminho de criação
--    de visitas pode escapar à regra, presente ou futuro.
CREATE OR REPLACE FUNCTION fn_visits_snapshot_seller_consultant()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    -- Só popular se o caller não definiu explicitamente um valor
    -- (permite override em casos muito específicos, e.g. data fixtures)
    IF NEW.seller_consultant_id IS NULL THEN
      SELECT consultant_id INTO NEW.seller_consultant_id
      FROM dev_properties WHERE id = NEW.property_id;
    END IF;
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Re-snapshot apenas se a property_id mudou
    IF NEW.property_id IS DISTINCT FROM OLD.property_id THEN
      SELECT consultant_id INTO NEW.seller_consultant_id
      FROM dev_properties WHERE id = NEW.property_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_visits_snapshot_seller_consultant ON visits;
CREATE TRIGGER trg_visits_snapshot_seller_consultant
  BEFORE INSERT OR UPDATE ON visits
  FOR EACH ROW
  EXECUTE FUNCTION fn_visits_snapshot_seller_consultant();
