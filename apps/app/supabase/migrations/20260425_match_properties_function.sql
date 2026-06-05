-- Função `match_properties_for_negocio(uuid)` — aplica os filtros bloqueantes
-- e devolve a lista de imóveis candidatos.
--
-- Bloqueantes (cortam):
--   • status                       → 'active' ou 'reserved'
--   • business_type                → mapeado a partir de negocios.tipo
--   • property_type                → strict match case-insensitive
--   • bedrooms ≥ quartos_min       → se quartos_min definido
--   • bathrooms ≥ wc_min           → se wc_min definido
--   • orcamento ≤ listing_price    → piso (se orcamento definido)
--   • listing_price ≤ orcamento_max × 1.15  → tecto (se orcamento_max definido)
--   • geografia                    → zonas_geom OR fallback texto/CP OR localizacao legacy
--
-- Flexíveis (área, amenities, estado) ficam para a camada TS.
--
-- Apenas suporta tipo='Compra' e 'Arrendatário' (lado buyer/tenant).
-- Os fluxos 'Venda' e 'Arrendador' usam outra função (negocio→negocios).

-- ───────────────────────────────────────────────────────────────────
-- Helper: extrair int de tipologia ("T3" → 3, "T6+" → 6, "T3+1" → 3)
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION typology_to_int(t text) RETURNS int
LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(substring(coalesce(t, '') from '[0-9]+'), '')::int;
$$;

-- ───────────────────────────────────────────────────────────────────
-- Helper: limpar tipologia do texto livre tipo_imovel
-- "Apartamento T2" → "Apartamento", "T2" → "" (vazio)
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION strip_typology(s text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT TRIM(REGEXP_REPLACE(coalesce(s, ''), '\s*T[0-9]+\+?[0-9]*', '', 'gi'));
$$;

-- ───────────────────────────────────────────────────────────────────
-- Helper: fallback geográfico via texto (admin areas only — polígonos
-- desenhados não têm nome útil para text match)
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION match_zonas_via_text(
  p_zonas jsonb,
  p_zone text,
  p_address_parish text,
  p_city text
) RETURNS boolean
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_item jsonb;
  v_admin_name text;
BEGIN
  IF p_zonas IS NULL OR jsonb_array_length(p_zonas) = 0 THEN
    RETURN false;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_zonas) LOOP
    IF v_item->>'kind' <> 'admin' THEN
      CONTINUE;
    END IF;

    SELECT name INTO v_admin_name
    FROM admin_areas
    WHERE id = (v_item->>'area_id')::uuid;

    IF v_admin_name IS NULL THEN
      CONTINUE;
    END IF;

    -- Só compara se o campo do imóvel não é vazio (evita '%' || '' || '%' = '%%' que matcha tudo)
    IF (coalesce(p_zone, '') <> ''           AND p_zone           ILIKE '%' || v_admin_name || '%')
       OR (coalesce(p_address_parish, '') <> '' AND p_address_parish ILIKE '%' || v_admin_name || '%')
       OR (coalesce(p_city, '') <> ''           AND p_city           ILIKE '%' || v_admin_name || '%')
       OR (coalesce(p_zone, '') <> ''           AND v_admin_name ILIKE '%' || p_zone || '%')
       OR (coalesce(p_city, '') <> ''           AND v_admin_name ILIKE '%' || p_city || '%')
    THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END $$;

-- ───────────────────────────────────────────────────────────────────
-- Função principal
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION match_properties_for_negocio(p_negocio_id uuid)
RETURNS TABLE (
  property_id uuid,
  geo_source text  -- 'spatial' | 'text_fallback' | 'localizacao_legacy' | 'no_filter'
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_neg negocios%ROWTYPE;
  v_business_type text;
  v_tipo_imovel_clean text;
  v_has_zones boolean;
  v_has_localizacao boolean;
BEGIN
  SELECT * INTO v_neg FROM negocios WHERE id = p_negocio_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Mapeia tipo→business_type (lado buyer/tenant)
  v_business_type := CASE LOWER(coalesce(v_neg.tipo, ''))
    WHEN 'compra' THEN 'venda'
    WHEN 'arrendatário' THEN 'arrendamento'
    WHEN 'arrendatario' THEN 'arrendamento'
    ELSE NULL
  END;

  IF v_business_type IS NULL THEN
    -- Outros tipos (Venda, Arrendador, Compra e Venda) usam outro fluxo
    RETURN;
  END IF;

  v_tipo_imovel_clean := LOWER(strip_typology(v_neg.tipo_imovel));
  IF v_tipo_imovel_clean = '' THEN v_tipo_imovel_clean := NULL; END IF;

  v_has_zones := v_neg.zonas_geom IS NOT NULL;
  v_has_localizacao := coalesce(v_neg.localizacao, '') <> '';

  RETURN QUERY
  SELECT
    p.id,
    (CASE
      WHEN NOT v_has_zones AND NOT v_has_localizacao THEN 'no_filter'
      WHEN v_has_zones AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
           AND ST_Contains(v_neg.zonas_geom,
                           ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326))
        THEN 'spatial'
      WHEN v_has_zones THEN 'text_fallback'
      ELSE 'localizacao_legacy'
    END)::text AS geo_source
  FROM dev_properties p
  LEFT JOIN dev_property_specifications ps ON ps.property_id = p.id
  WHERE
    -- Status: imóveis vendáveis/arrendáveis
    p.status IN ('active', 'reserved')

    -- Tipo de negócio (case-insensitive)
    AND LOWER(coalesce(p.business_type, '')) = v_business_type

    -- Tipo de imóvel (strict + case-insensitive, ignora "T2" embebido)
    AND (
      v_tipo_imovel_clean IS NULL
      OR LOWER(coalesce(p.property_type, '')) = v_tipo_imovel_clean
    )

    -- Quartos mínimos: usa bedrooms, fallback a parsing de typology
    AND (
      v_neg.quartos_min IS NULL
      OR coalesce(ps.bedrooms, typology_to_int(ps.typology)) >= v_neg.quartos_min
    )

    -- Casas de banho mínimas
    AND (
      v_neg.casas_banho IS NULL
      OR ps.bathrooms >= v_neg.casas_banho
    )

    -- Preço (piso fixo, tecto com 15% de margem)
    AND (v_neg.orcamento IS NULL OR p.listing_price >= v_neg.orcamento)
    AND (v_neg.orcamento_max IS NULL OR p.listing_price <= v_neg.orcamento_max * 1.15)

    -- Geografia (compõe os 4 cenários)
    AND (
      -- Sem filtro
      (NOT v_has_zones AND NOT v_has_localizacao)

      -- Spatial: zonas + coords
      OR (
        v_has_zones
        AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
        AND ST_Contains(v_neg.zonas_geom,
                        ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326))
      )

      -- Text fallback: zonas mas property sem coords
      OR (
        v_has_zones
        AND (p.latitude IS NULL OR p.longitude IS NULL)
        AND match_zonas_via_text(v_neg.zonas, p.zone, p.address_parish, p.city)
      )

      -- Legacy: localizacao text contra zone/parish/city (bidireccional)
      OR (
        NOT v_has_zones
        AND v_has_localizacao
        AND (
          (coalesce(p.zone, '') <> ''           AND p.zone           ILIKE '%' || v_neg.localizacao || '%')
          OR (coalesce(p.address_parish, '') <> '' AND p.address_parish ILIKE '%' || v_neg.localizacao || '%')
          OR (coalesce(p.city, '') <> ''           AND p.city           ILIKE '%' || v_neg.localizacao || '%')
          OR (coalesce(p.zone, '') <> ''           AND v_neg.localizacao ILIKE '%' || p.zone || '%')
          OR (coalesce(p.city, '') <> ''           AND v_neg.localizacao ILIKE '%' || p.city || '%')
        )
      )
    );
END $$;

COMMENT ON FUNCTION match_properties_for_negocio(uuid) IS
  'Devolve property_ids candidatos para um negocio (lado buyer/tenant).
   Aplica bloqueantes: status, business_type, property_type, quartos, WC,
   preço, geografia. Flexíveis (área, amenities, estado) ficam para TS.';
