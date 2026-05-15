-- ============================================================================
-- 20260615_backfill_negocios_expected_value.sql
--
-- Backfill `negocios.expected_value` para reflectir o estado actual dos
-- campos de preço por `tipo`. O `expected_value` é uma coluna denormalizada
-- usada pelos cards do kanban + totais de comissão (possível / prevista) +
-- drill-downs financeiros; ficou dessincronizada porque o PUT handler nunca
-- a recalculava ao actualizar `preco_venda`, `orcamento`, `renda_*`. O fix
-- ao endpoint passa a recomputá-la em cada PUT/POST a partir desta data.
--
-- Bug original: consultor altera "Preço pretendido" no detalhe → sheet mostra
-- o valor novo, mas o card no kanban e a comissão possível continuam a
-- mostrar o valor antigo (porque `expected_value` ficou parado).
--
-- Esta migration é puramente DML (sem alterações de schema). Idempotente:
-- correr de novo é no-op porque os predicados `IS DISTINCT FROM` filtram
-- rows já em sync.
--
-- Revert:
--   Não há revert canónico — é repor uma coluna denormalizada cuja
--   "verdade" estava fora de sync. Pré-backfill snapshot disponível em
--   audit logs da Supabase se necessário.
-- ============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1 (Data healing): negócios `Vendedor/Venda/Senhorio/Arrendador` cujo
-- preço foi gravado por engano no campo `orcamento` (campo de comprador).
-- Identificados em 2026-06-15: 4 rows. Move o valor para o campo correcto
-- (`preco_venda` para venda, `renda_pretendida` para arrendamento), apaga
-- o `orcamento` que não fazia sentido no tipo de origem. Faz isto antes do
-- Step 2 para evitar perda de dados quando o derivador olha para o campo
-- certo e encontra NULL.
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE negocios
SET preco_venda = orcamento,
    orcamento = NULL,
    orcamento_max = NULL
WHERE tipo IN ('Vendedor', 'Venda')
  AND preco_venda IS NULL
  AND orcamento IS NOT NULL;

UPDATE negocios
SET renda_pretendida = orcamento,
    orcamento = NULL,
    orcamento_max = NULL
WHERE tipo IN ('Senhorio', 'Arrendador')
  AND renda_pretendida IS NULL
  AND orcamento IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2 (Backfill): recomputa `expected_value` para todas as rows out-of-sync.
-- Mirror exacto de `deriveExpectedValue()` em [lib/crm/derive-expected-value.ts].
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE negocios
SET expected_value = CASE
    WHEN tipo = 'Arrendatário' THEN renda_max_mensal
    WHEN tipo IN ('Senhorio', 'Arrendador') THEN renda_pretendida
    WHEN tipo IN ('Comprador', 'Compra') THEN COALESCE(orcamento_max, orcamento)
    ELSE preco_venda
  END
WHERE expected_value IS DISTINCT FROM (
  CASE
    WHEN tipo = 'Arrendatário' THEN renda_max_mensal
    WHEN tipo IN ('Senhorio', 'Arrendador') THEN renda_pretendida
    WHEN tipo IN ('Comprador', 'Compra') THEN COALESCE(orcamento_max, orcamento)
    ELSE preco_venda
  END
);

COMMIT;
