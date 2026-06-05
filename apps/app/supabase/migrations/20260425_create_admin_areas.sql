-- Hierarquia administrativa portuguesa para matching geográfico de zonas
-- de interesse de leads/negócios contra imóveis.
--
-- Continental apenas (post-reforma 2013):
--   18 distritos + 278 concelhos + 2874 freguesias = 3170 linhas
-- Ilhas (Madeira / Açores) ficam para fase posterior.
-- Fonte: cft-org/portugal_freguesias_geojson (CAOP-derivado).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS admin_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('distrito','concelho','freguesia')),
  name text NOT NULL,
  dicofre text,
  parent_id uuid REFERENCES admin_areas(id) ON DELETE CASCADE,
  geom geometry(MultiPolygon, 4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_areas_geom_idx ON admin_areas USING GIST (geom);
CREATE INDEX IF NOT EXISTS admin_areas_type_idx ON admin_areas (type);
CREATE INDEX IF NOT EXISTS admin_areas_parent_idx ON admin_areas (parent_id);
CREATE INDEX IF NOT EXISTS admin_areas_name_trgm_idx ON admin_areas USING GIN (name gin_trgm_ops);

CREATE UNIQUE INDEX IF NOT EXISTS admin_areas_dicofre_unique
  ON admin_areas (dicofre) WHERE dicofre IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS admin_areas_child_name_unique
  ON admin_areas (type, name, parent_id) WHERE parent_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS admin_areas_distrito_unique
  ON admin_areas (name) WHERE type = 'distrito';

COMMENT ON TABLE admin_areas IS
  'Hierarquia administrativa PT (continental) — distritos, concelhos, freguesias. SRID 4326 WGS84.';
COMMENT ON COLUMN admin_areas.dicofre IS
  'Código INE Dicofre (6 dígitos). Apenas freguesias.';
COMMENT ON COLUMN admin_areas.parent_id IS
  'Concelho para freguesias, distrito para concelhos, NULL para distritos.';
