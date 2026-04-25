-- Adiciona zonas de interesse geográficas a `negocios` para matching
-- contra `dev_properties` por localização.
--
-- `zonas` (JSONB): array de itens, cada um:
--   {kind: 'admin', area_id: uuid, label: text}     -> referência a admin_areas
--   {kind: 'polygon', id: uuid, label: text,
--    geometry: <GeoJSON Polygon>}                   -> polígono custom desenhado
--
-- `zonas_geom` (MultiPolygon): união espacial de todas as zonas, mantida
-- por trigger BEFORE INSERT/UPDATE. Indexado com GiST para queries
-- ST_Contains(zonas_geom, point) rápidas no matching.

ALTER TABLE negocios
  ADD COLUMN IF NOT EXISTS zonas jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS zonas_geom geometry(MultiPolygon, 4326);

CREATE INDEX IF NOT EXISTS negocios_zonas_geom_idx
  ON negocios USING GIST (zonas_geom);

-- Trigger function: recalcula zonas_geom a partir de zonas
CREATE OR REPLACE FUNCTION negocios_recompute_zonas_geom()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_geom geometry;
  v_collection geometry[] := ARRAY[]::geometry[];
  v_item jsonb;
  v_admin_geom geometry;
BEGIN
  -- Sem zonas → sem geometria
  IF NEW.zonas IS NULL OR jsonb_array_length(NEW.zonas) = 0 THEN
    NEW.zonas_geom := NULL;
    RETURN NEW;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(NEW.zonas) LOOP
    CASE v_item->>'kind'
      WHEN 'admin' THEN
        BEGIN
          SELECT geom INTO v_admin_geom
          FROM admin_areas
          WHERE id = (v_item->>'area_id')::uuid;
          IF v_admin_geom IS NOT NULL THEN
            v_collection := array_append(v_collection, v_admin_geom);
          END IF;
        EXCEPTION WHEN OTHERS THEN
          -- area_id inválido ou não-uuid: ignora
          NULL;
        END;
      WHEN 'polygon' THEN
        BEGIN
          v_geom := ST_SetSRID(
            ST_GeomFromGeoJSON((v_item->'geometry')::text),
            4326
          );
          IF v_geom IS NOT NULL AND ST_IsValid(v_geom) THEN
            v_collection := array_append(v_collection, ST_Multi(v_geom));
          ELSIF v_geom IS NOT NULL THEN
            -- Tenta corrigir topologia
            v_geom := ST_CollectionExtract(ST_MakeValid(v_geom), 3);
            IF v_geom IS NOT NULL AND NOT ST_IsEmpty(v_geom) THEN
              v_collection := array_append(v_collection, ST_Multi(v_geom));
            END IF;
          END IF;
        EXCEPTION WHEN OTHERS THEN
          -- GeoJSON inválido: ignora
          NULL;
        END;
      ELSE
        -- kind desconhecido: ignora
        NULL;
    END CASE;
  END LOOP;

  IF array_length(v_collection, 1) IS NULL THEN
    NEW.zonas_geom := NULL;
  ELSE
    NEW.zonas_geom := ST_Multi(ST_UnaryUnion(ST_Collect(v_collection)));
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_negocios_recompute_zonas_geom ON negocios;

CREATE TRIGGER trg_negocios_recompute_zonas_geom
  BEFORE INSERT OR UPDATE OF zonas ON negocios
  FOR EACH ROW
  EXECUTE FUNCTION negocios_recompute_zonas_geom();

COMMENT ON COLUMN negocios.zonas IS
  'Array JSONB de zonas de interesse: {kind:''admin''|''polygon'', ...}';
COMMENT ON COLUMN negocios.zonas_geom IS
  'União espacial das zonas, mantida por trigger. SRID 4326. Indexado com GiST.';
