# Dados CAOP — Áreas Administrativas

Dataset usado para popular a tabela `admin_areas` (matching geográfico de
zonas de interesse de leads/negócios contra imóveis).

## Conteúdo

- `freguesias.geojson` (11 MB) — 2874 freguesias de Portugal continental
  - Sistema de coordenadas: WGS84 (EPSG:4326)
  - Formato: GeoJSON FeatureCollection, geometrias `Polygon`
  - Cada feature tem `Dicofre` (código INE), `Freguesia`, `Concelho`,
    `Distrito`, `AREA_T_Ha`

## Fonte

[cft-org/portugal_freguesias_geojson](https://github.com/cft-org/portugal_freguesias_geojson)
(commit `main` em 2026-04-25). Repo agrega CAOP da DGT (Direção-Geral do
Território), pós-reforma administrativa de 2013.

## Cobertura

✅ **Portugal continental**: 18 distritos, 278 concelhos, 2874 freguesias.

❌ **Madeira / Açores não incluídos** nesta fase. Para essas regiões,
o sistema cai em fallback (texto + código postal) ou modo
"desenhar polígono no mapa".

## Observações

- 1 Dicofre duplicado (`060120` — Cerdeira e Moura da Serra, Arganil):
  freguesia com duas áreas não-contíguas. Mergeado para MultiPolygon
  no seed.
- 6 geometrias com problemas de topologia foram corrigidas com
  `ST_MakeValid` durante o seed. Não afecta uso prático.

## Como re-popular a tabela

```bash
# Pré-requisitos:
# - .env.local com NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
# - Migration 20260425_create_admin_areas.sql aplicada
# - PostGIS + pg_trgm extensions activas

npx tsx scripts/seed-admin-areas.ts
```

O script é idempotente — `DELETE FROM admin_areas` antes de re-inserir.

## Actualização da fonte

A CAOP é actualizada anualmente pela DGT. Se quisermos uma versão
mais recente:

1. Verificar última release em https://github.com/cft-org/portugal_freguesias_geojson
2. Ou descarregar directamente da [DGT](https://www.dgterritorio.gov.pt/cartografia/cartografia-tematica/CAOP)
   (Shapefile, requer conversão Shapefile→GeoJSON e ETRS89→WGS84
   com `mapshaper` ou similar)
3. Substituir `freguesias.geojson` neste directório
4. Re-correr o seed
