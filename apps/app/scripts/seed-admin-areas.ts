/**
 * scripts/seed-admin-areas.ts
 *
 * Popula a tabela `admin_areas` (distritos + concelhos + freguesias) a
 * partir de `data/caop/freguesias.geojson`. Continental apenas
 * (Madeira/Açores não incluídos nesta fase).
 *
 * Fonte: https://github.com/cft-org/portugal_freguesias_geojson
 *
 * ══════════════════════════════════════════════════════════════════
 * RUN-BOOK
 * ══════════════════════════════════════════════════════════════════
 *
 * 1. `.env.local` deve ter NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
 * 2. Migration `20260425_create_admin_areas.sql` aplicada.
 * 3. Tabela `_staging_freguesias` e funções
 *    `_seed_admin_freguesias_batch`, `_truncate_staging_freguesias`,
 *    `_finalize_admin_areas_from_staging` existentes (criadas via SQL one-shot).
 *
 * Correr:
 *
 *   npx tsx scripts/seed-admin-areas.ts
 *
 * Idempotente — TRUNCATE-then-INSERT em ambas as tabelas.
 */

import { config as loadEnv } from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

loadEnv({ path: path.resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[seed] Falta NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const GEOJSON_PATH = path.resolve(process.cwd(), 'data/caop/freguesias.geojson')
const BATCH_SIZE = 100

// PT-PT title-case: artigos minúsculos no meio
const PT_ARTICLES = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])

function ptTitleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((word, i) => {
      if (i > 0 && PT_ARTICLES.has(word)) return word
      return word.charAt(0).toLocaleUpperCase('pt-PT') + word.slice(1)
    })
    .join(' ')
}

interface FreguesiaFeature {
  type: 'Feature'
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: unknown
  }
  properties: {
    Dicofre: string
    Freguesia: string
    Concelho: string
    Distrito: string
  }
}

async function main() {
  console.log('[seed] A carregar GeoJSON de', GEOJSON_PATH)
  const raw = fs.readFileSync(GEOJSON_PATH, 'utf-8')
  const data = JSON.parse(raw) as { type: string; features: FreguesiaFeature[] }
  const features = data.features
  console.log(`[seed] ${features.length} features carregadas.`)

  // Normalização de capitalização para Concelho e Distrito (Freguesia já vem certo)
  for (const f of features) {
    f.properties.Concelho = ptTitleCase(f.properties.Concelho)
    f.properties.Distrito = ptTitleCase(f.properties.Distrito)
  }

  // Limpar staging
  console.log('[seed] A limpar staging...')
  const { error: truncErr } = await admin.rpc('_truncate_staging_freguesias')
  if (truncErr) {
    console.error('[seed] Erro a truncar staging:', truncErr.message)
    process.exit(1)
  }

  // Batch insert no staging
  console.log(`[seed] A inserir em batches de ${BATCH_SIZE}...`)
  const startStage = Date.now()
  let inserted = 0
  for (let i = 0; i < features.length; i += BATCH_SIZE) {
    const batch = features.slice(i, i + BATCH_SIZE)
    const { data: count, error } = await admin.rpc('_seed_admin_freguesias_batch', {
      p_batch: batch as unknown as Record<string, unknown>[],
    })
    if (error) {
      console.error(`\n[seed] Erro no batch ${i}-${i + batch.length}:`, error.message)
      process.exit(1)
    }
    inserted += (count as number) ?? batch.length
    process.stdout.write(`\r[seed] staging: ${inserted}/${features.length}`)
  }
  process.stdout.write('\n')
  const stagingMs = Date.now() - startStage
  console.log(`[seed] Staging concluído em ${(stagingMs / 1000).toFixed(1)}s.`)

  // Finalização: distritos → concelhos → freguesias via ST_Union
  console.log('[seed] A correr finalização (ST_Union pode demorar alguns segundos)...')
  const startFinal = Date.now()
  const { data: result, error: finalErr } = await admin.rpc('_finalize_admin_areas_from_staging')
  if (finalErr) {
    console.error('[seed] Erro na finalização:', finalErr.message)
    process.exit(1)
  }
  const finalMs = Date.now() - startFinal
  console.log(
    `[seed] Finalização concluída em ${(finalMs / 1000).toFixed(1)}s:`,
    JSON.stringify(result)
  )

  // Sanity check
  const { data: counts, error: countErr } = await admin
    .from('admin_areas')
    .select('type', { count: 'exact', head: false })
  if (countErr) {
    console.warn('[seed] Aviso a contar:', countErr.message)
  } else {
    const breakdown = (counts ?? []).reduce<Record<string, number>>((acc, row: any) => {
      acc[row.type] = (acc[row.type] ?? 0) + 1
      return acc
    }, {})
    console.log('[seed] Verificação final:', breakdown)
  }

  console.log('[seed] ✅ Concluído.')
}

main().catch((err) => {
  console.error('[seed] Erro fatal:', err)
  process.exit(1)
})
