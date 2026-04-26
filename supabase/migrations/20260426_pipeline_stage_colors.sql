-- =============================================================================
-- Pipeline stage colors — paleta com hues distintos, saturação madura.
--
-- Princípio: cada estágio adjacente muda de FAMÍLIA de hue (não só shade),
-- de forma a que o olho identifique a etapa por cor sem ler o label.
--   slate (gray-blue) → blue → violet → amber → orange → emerald → emerald-dark → gray
--
-- Não-girly (sem rosa/fuchsia brilhante; fuchsia-700 só usado em vendedor/
-- arrendador entre violet e amber, em tom burgundy maduro).
-- Idempotente.
-- =============================================================================

BEGIN;

-- ─── Comprador (8 stages) ─────────────────────────────────────────────
UPDATE leads_pipeline_stages SET color = '#64748b' WHERE pipeline_type = 'comprador' AND name = 'Contactado';
UPDATE leads_pipeline_stages SET color = '#2563eb' WHERE pipeline_type = 'comprador' AND name = 'Pesquisa de Imóveis';
UPDATE leads_pipeline_stages SET color = '#7c3aed' WHERE pipeline_type = 'comprador' AND name = 'Visitas';
UPDATE leads_pipeline_stages SET color = '#d97706' WHERE pipeline_type = 'comprador' AND name = 'Proposta';
UPDATE leads_pipeline_stages SET color = '#ea580c' WHERE pipeline_type = 'comprador' AND name = 'CPCV';
UPDATE leads_pipeline_stages SET color = '#059669' WHERE pipeline_type = 'comprador' AND name = 'Escritura';
UPDATE leads_pipeline_stages SET color = '#047857' WHERE pipeline_type = 'comprador' AND name = 'Fecho';
UPDATE leads_pipeline_stages SET color = '#9ca3af' WHERE pipeline_type = 'comprador' AND name = 'Perdido';

-- ─── Vendedor (10 stages) ────────────────────────────────────────────
UPDATE leads_pipeline_stages SET color = '#64748b' WHERE pipeline_type = 'vendedor' AND name = 'Contactado';
UPDATE leads_pipeline_stages SET color = '#0891b2' WHERE pipeline_type = 'vendedor' AND name = 'Pré-Angariação';
UPDATE leads_pipeline_stages SET color = '#2563eb' WHERE pipeline_type = 'vendedor' AND name = 'Estudo de Mercado';
UPDATE leads_pipeline_stages SET color = '#7c3aed' WHERE pipeline_type = 'vendedor' AND name = 'Angariação';
UPDATE leads_pipeline_stages SET color = '#a21caf' WHERE pipeline_type = 'vendedor' AND name = 'Promoção';
UPDATE leads_pipeline_stages SET color = '#d97706' WHERE pipeline_type = 'vendedor' AND name = 'Proposta Aceite';
UPDATE leads_pipeline_stages SET color = '#ea580c' WHERE pipeline_type = 'vendedor' AND name = 'CPCV';
UPDATE leads_pipeline_stages SET color = '#059669' WHERE pipeline_type = 'vendedor' AND name = 'Escritura';
UPDATE leads_pipeline_stages SET color = '#047857' WHERE pipeline_type = 'vendedor' AND name = 'Fecho';
UPDATE leads_pipeline_stages SET color = '#9ca3af' WHERE pipeline_type = 'vendedor' AND name = 'Perdido';

-- ─── Arrendatário (7 stages) ─────────────────────────────────────────
UPDATE leads_pipeline_stages SET color = '#64748b' WHERE pipeline_type = 'arrendatario' AND name = 'Contactado';
UPDATE leads_pipeline_stages SET color = '#2563eb' WHERE pipeline_type = 'arrendatario' AND name = 'Pesquisa de Imóveis';
UPDATE leads_pipeline_stages SET color = '#7c3aed' WHERE pipeline_type = 'arrendatario' AND name = 'Visitas';
UPDATE leads_pipeline_stages SET color = '#d97706' WHERE pipeline_type = 'arrendatario' AND name = 'Proposta';
UPDATE leads_pipeline_stages SET color = '#059669' WHERE pipeline_type = 'arrendatario' AND name = 'Contrato';
UPDATE leads_pipeline_stages SET color = '#047857' WHERE pipeline_type = 'arrendatario' AND name = 'Fecho';
UPDATE leads_pipeline_stages SET color = '#9ca3af' WHERE pipeline_type = 'arrendatario' AND name = 'Perdido';

-- ─── Arrendador / Senhorio (9 stages) ────────────────────────────────
UPDATE leads_pipeline_stages SET color = '#64748b' WHERE pipeline_type = 'arrendador' AND name = 'Contactado';
UPDATE leads_pipeline_stages SET color = '#0891b2' WHERE pipeline_type = 'arrendador' AND name = 'Pré-Angariação';
UPDATE leads_pipeline_stages SET color = '#2563eb' WHERE pipeline_type = 'arrendador' AND name = 'Estudo de Mercado';
UPDATE leads_pipeline_stages SET color = '#7c3aed' WHERE pipeline_type = 'arrendador' AND name = 'Angariação';
UPDATE leads_pipeline_stages SET color = '#a21caf' WHERE pipeline_type = 'arrendador' AND name = 'Promoção';
UPDATE leads_pipeline_stages SET color = '#d97706' WHERE pipeline_type = 'arrendador' AND name = 'Proposta Aceite';
UPDATE leads_pipeline_stages SET color = '#059669' WHERE pipeline_type = 'arrendador' AND name = 'Contrato';
UPDATE leads_pipeline_stages SET color = '#047857' WHERE pipeline_type = 'arrendador' AND name = 'Fecho';
UPDATE leads_pipeline_stages SET color = '#9ca3af' WHERE pipeline_type = 'arrendador' AND name = 'Perdido';

COMMIT;
