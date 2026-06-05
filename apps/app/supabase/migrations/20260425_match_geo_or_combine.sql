-- Fix: ramos geográficos passam a ser OR-combinados aditivamente.
--
-- Antes: o ramo de `localizacao` text só disparava quando NÃO havia
-- zonas, o que fazia com que adicionar texto a um negócio com zonas
-- pudesse colapsar para 0 matches em cenários onde os imóveis na
-- polygon não tinham o termo no `zone`/`city`/`address_parish`.
--
-- Agora: cada ramo é independente — uma propriedade passa se cumprir
-- QUALQUER um dos critérios (spatial, text fallback de zonas ou texto
-- de localizacao). Semântica UNION/aditiva.

CREATE OR REPLACE FUNCTION match_properties_for_negocio(p_negocio_id uuid)
RETURNS TABLE (property_id uuid, geo_source text)
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
  v_business_type := CASE LOWER(coalesce(v_neg.tipo, ''))
    WHEN 'compra' THEN 'venda'
    WHEN 'arrendatário' THEN 'arrendamento'
    WHEN 'arrendatario' THEN 'arrendamento'
    ELSE NULL
  END;
  IF v_business_type IS NULL THEN RETURN; END IF;
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
    p.status IN ('active', 'reserved')
    AND LOWER(coalesce(p.business_type, '')) = v_business_type
    AND (
      v_tipo_imovel_clean IS NULL
      OR LOWER(coalesce(p.property_type, '')) = v_tipo_imovel_clean
    )
    AND (
      v_neg.quartos_min IS NULL
      OR coalesce(ps.bedrooms, typology_to_int(ps.typology)) >= v_neg.quartos_min
    )
    AND (v_neg.casas_banho IS NULL OR ps.bathrooms >= v_neg.casas_banho)
    AND (v_neg.orcamento IS NULL OR p.listing_price >= v_neg.orcamento)
    AND (v_neg.orcamento_max IS NULL OR p.listing_price <= v_neg.orcamento_max * 1.15)
    AND (
      (NOT v_has_zones AND NOT v_has_localizacao)
      OR (
        v_has_zones
        AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
        AND ST_Contains(v_neg.zonas_geom,
                        ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326))
      )
      OR (
        v_has_zones
        AND (p.latitude IS NULL OR p.longitude IS NULL)
        AND match_zonas_via_text(v_neg.zonas, p.zone, p.address_parish, p.city)
      )
      OR (
        v_has_localizacao
        AND (
          (coalesce(p.zone, '') <> ''            AND p.zone            ILIKE '%' || v_neg.localizacao || '%')
          OR (coalesce(p.address_parish, '') <> '' AND p.address_parish ILIKE '%' || v_neg.localizacao || '%')
          OR (coalesce(p.city, '') <> ''            AND p.city            ILIKE '%' || v_neg.localizacao || '%')
          OR (coalesce(p.zone, '') <> ''            AND v_neg.localizacao ILIKE '%' || p.zone || '%')
          OR (coalesce(p.city, '') <> ''            AND v_neg.localizacao ILIKE '%' || p.city || '%')
        )
      )
    );
END $$;

CREATE OR REPLACE FUNCTION match_properties_preview(
  p_negocio_id uuid,
  p_zonas jsonb
) RETURNS TABLE (property_id uuid, geo_source text)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_neg negocios%ROWTYPE;
  v_zones_geom geometry(MultiPolygon, 4326);
  v_business_type text;
  v_tipo_imovel_clean text;
  v_has_zones boolean;
  v_has_localizacao boolean;
  v_collection geometry[] := ARRAY[]::geometry[];
  v_item jsonb;
  v_admin_geom geometry;
  v_geom geometry;
BEGIN
  SELECT * INTO v_neg FROM negocios WHERE id = p_negocio_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF p_zonas IS NOT NULL AND jsonb_array_length(p_zonas) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_zonas) LOOP
      CASE v_item->>'kind'
        WHEN 'admin' THEN
          BEGIN
            SELECT geom INTO v_admin_geom FROM admin_areas WHERE id = (v_item->>'area_id')::uuid;
            IF v_admin_geom IS NOT NULL THEN
              v_collection := array_append(v_collection, v_admin_geom);
            END IF;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
        WHEN 'polygon' THEN
          BEGIN
            v_geom := ST_SetSRID(ST_GeomFromGeoJSON((v_item->'geometry')::text), 4326);
            IF v_geom IS NOT NULL THEN
              IF NOT ST_IsValid(v_geom) THEN
                v_geom := ST_CollectionExtract(ST_MakeValid(v_geom), 3);
              END IF;
              IF v_geom IS NOT NULL AND NOT ST_IsEmpty(v_geom) THEN
                v_collection := array_append(v_collection, ST_Multi(v_geom));
              END IF;
            END IF;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
        ELSE NULL;
      END CASE;
    END LOOP;
    IF array_length(v_collection, 1) IS NOT NULL THEN
      v_zones_geom := ST_Multi(ST_UnaryUnion(ST_Collect(v_collection)));
    END IF;
  END IF;

  v_business_type := CASE LOWER(coalesce(v_neg.tipo, ''))
    WHEN 'compra' THEN 'venda'
    WHEN 'arrendatário' THEN 'arrendamento'
    WHEN 'arrendatario' THEN 'arrendamento'
    ELSE NULL
  END;
  IF v_business_type IS NULL THEN RETURN; END IF;
  v_tipo_imovel_clean := LOWER(strip_typology(v_neg.tipo_imovel));
  IF v_tipo_imovel_clean = '' THEN v_tipo_imovel_clean := NULL; END IF;
  v_has_zones := v_zones_geom IS NOT NULL;
  v_has_localizacao := coalesce(v_neg.localizacao, '') <> '';

  RETURN QUERY
  SELECT
    p.id,
    (CASE
      WHEN NOT v_has_zones AND NOT v_has_localizacao THEN 'no_filter'
      WHEN v_has_zones AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
           AND ST_Contains(v_zones_geom, ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326))
        THEN 'spatial'
      WHEN v_has_zones THEN 'text_fallback'
      ELSE 'localizacao_legacy'
    END)::text AS geo_source
  FROM dev_properties p
  LEFT JOIN dev_property_specifications ps ON ps.property_id = p.id
  WHERE
    p.status IN ('active', 'reserved')
    AND LOWER(coalesce(p.business_type, '')) = v_business_type
    AND (
      v_tipo_imovel_clean IS NULL
      OR LOWER(coalesce(p.property_type, '')) = v_tipo_imovel_clean
    )
    AND (
      v_neg.quartos_min IS NULL
      OR coalesce(ps.bedrooms, typology_to_int(ps.typology)) >= v_neg.quartos_min
    )
    AND (v_neg.casas_banho IS NULL OR ps.bathrooms >= v_neg.casas_banho)
    AND (v_neg.orcamento IS NULL OR p.listing_price >= v_neg.orcamento)
    AND (v_neg.orcamento_max IS NULL OR p.listing_price <= v_neg.orcamento_max * 1.15)
    AND (
      (NOT v_has_zones AND NOT v_has_localizacao)
      OR (
        v_has_zones
        AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
        AND ST_Contains(v_zones_geom, ST_SetSRID(ST_MakePoint(p.longitude, p.latitude), 4326))
      )
      OR (
        v_has_zones
        AND (p.latitude IS NULL OR p.longitude IS NULL)
        AND match_zonas_via_text(p_zonas, p.zone, p.address_parish, p.city)
      )
      OR (
        v_has_localizacao
        AND (
          (coalesce(p.zone, '') <> ''            AND p.zone            ILIKE '%' || v_neg.localizacao || '%')
          OR (coalesce(p.address_parish, '') <> '' AND p.address_parish ILIKE '%' || v_neg.localizacao || '%')
          OR (coalesce(p.city, '') <> ''            AND p.city            ILIKE '%' || v_neg.localizacao || '%')
          OR (coalesce(p.zone, '') <> ''            AND v_neg.localizacao ILIKE '%' || p.zone || '%')
          OR (coalesce(p.city, '') <> ''            AND v_neg.localizacao ILIKE '%' || p.city || '%')
        )
      )
    );
END $$;
