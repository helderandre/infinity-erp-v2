-- Função inversa de `match_properties_for_negocio`:
-- dado um imóvel, devolve a lista de negócios cujos critérios casam com ele.
--
-- Bloqueantes (cortam):
--   • negocio em estado terminal (Fechado/Cancelado/Perdido)
--   • tipo do negócio compatível com business_type do imóvel
--     (Compra ↔ venda, Arrendatário ↔ arrendamento)
--   • property_type vs tipo_imovel — case-insensitive strict
--   • property.bedrooms ≥ negocio.quartos_min
--   • property.bathrooms ≥ negocio.casas_banho
--   • property.listing_price ∈ [negocio.orcamento, negocio.orcamento_max × 1.15]
--   • geografia: spatial / text_fallback / localizacao_legacy / no_filter
--
-- Devolve `(negocio_id, geo_source)`. Hidratação + badges flexíveis ficam em TS.

CREATE OR REPLACE FUNCTION match_negocios_for_property(p_property_id uuid)
RETURNS TABLE (negocio_id uuid, geo_source text)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_prop dev_properties%ROWTYPE;
  v_specs dev_property_specifications%ROWTYPE;
  v_business_type text;
  v_prop_type text;
  v_prop_lat numeric;
  v_prop_lng numeric;
  v_has_coords boolean;
BEGIN
  SELECT * INTO v_prop FROM dev_properties WHERE id = p_property_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Imóveis em estados não-comercializáveis: zero matches
  IF v_prop.status NOT IN ('active', 'reserved') THEN
    RETURN;
  END IF;

  SELECT * INTO v_specs FROM dev_property_specifications WHERE property_id = p_property_id;

  v_business_type := LOWER(coalesce(v_prop.business_type, ''));
  v_prop_type := LOWER(coalesce(v_prop.property_type, ''));
  v_prop_lat := v_prop.latitude;
  v_prop_lng := v_prop.longitude;
  v_has_coords := v_prop_lat IS NOT NULL AND v_prop_lng IS NOT NULL;

  RETURN QUERY
  SELECT
    n.id,
    (CASE
      WHEN n.zonas_geom IS NULL AND coalesce(n.localizacao, '') = '' THEN 'no_filter'
      WHEN n.zonas_geom IS NOT NULL AND v_has_coords
           AND ST_Contains(n.zonas_geom,
                           ST_SetSRID(ST_MakePoint(v_prop_lng, v_prop_lat), 4326))
        THEN 'spatial'
      WHEN n.zonas_geom IS NOT NULL THEN 'text_fallback'
      ELSE 'localizacao_legacy'
    END)::text AS geo_source
  FROM negocios n
  LEFT JOIN leads_pipeline_stages s ON s.id = n.pipeline_stage_id
  WHERE
    -- Só lados buyer/tenant deste fluxo
    LOWER(coalesce(n.tipo, '')) IN ('compra', 'arrendatário', 'arrendatario')

    -- Tipo do negócio compatível com o business_type do imóvel
    AND CASE LOWER(coalesce(n.tipo, ''))
          WHEN 'compra' THEN v_business_type = 'venda'
          WHEN 'arrendatário' THEN v_business_type = 'arrendamento'
          WHEN 'arrendatario' THEN v_business_type = 'arrendamento'
          ELSE FALSE
        END

    -- Excluir estados terminais (Fechado / Cancelado / Perdido)
    AND coalesce(s.is_terminal, false) = false

    -- Tipo de imóvel: strict case-insensitive (após remover "T2" embebido)
    AND (
      LOWER(strip_typology(n.tipo_imovel)) = ''
      OR LOWER(strip_typology(n.tipo_imovel)) IS NULL
      OR LOWER(strip_typology(n.tipo_imovel)) = v_prop_type
    )

    -- Quartos mínimos
    AND (
      n.quartos_min IS NULL
      OR coalesce(v_specs.bedrooms, typology_to_int(v_specs.typology)) >= n.quartos_min
    )

    -- Casas de banho mínimas
    AND (
      n.casas_banho IS NULL
      OR v_specs.bathrooms >= n.casas_banho
    )

    -- Orçamento (piso)
    AND (n.orcamento IS NULL OR v_prop.listing_price >= n.orcamento)

    -- Orçamento máximo (com 15% margem)
    AND (n.orcamento_max IS NULL OR v_prop.listing_price <= n.orcamento_max * 1.15)

    -- Geografia
    AND (
      -- Sem filtro
      (n.zonas_geom IS NULL AND coalesce(n.localizacao, '') = '')

      -- Spatial
      OR (
        n.zonas_geom IS NOT NULL
        AND v_has_coords
        AND ST_Contains(n.zonas_geom,
                        ST_SetSRID(ST_MakePoint(v_prop_lng, v_prop_lat), 4326))
      )

      -- Text fallback (zonas presentes mas property sem coords)
      OR (
        n.zonas_geom IS NOT NULL
        AND NOT v_has_coords
        AND match_zonas_via_text(n.zonas, v_prop.zone, v_prop.address_parish, v_prop.city)
      )

      -- Legacy: localizacao text bidireccional
      OR (
        n.zonas_geom IS NULL
        AND coalesce(n.localizacao, '') <> ''
        AND (
          (coalesce(v_prop.zone, '') <> ''            AND v_prop.zone            ILIKE '%' || n.localizacao || '%')
          OR (coalesce(v_prop.address_parish, '') <> '' AND v_prop.address_parish ILIKE '%' || n.localizacao || '%')
          OR (coalesce(v_prop.city, '') <> ''            AND v_prop.city            ILIKE '%' || n.localizacao || '%')
          OR (coalesce(v_prop.zone, '') <> ''            AND n.localizacao ILIKE '%' || v_prop.zone || '%')
          OR (coalesce(v_prop.city, '') <> ''            AND n.localizacao ILIKE '%' || v_prop.city || '%')
        )
      )
    );
END $$;

COMMENT ON FUNCTION match_negocios_for_property(uuid) IS
  'Devolve negocio_ids candidatos para um imóvel (lado buyer/tenant).
   Aplica bloqueantes inversos ao match_properties_for_negocio.
   Flexíveis (área, amenities, estado) ficam para TS.';
