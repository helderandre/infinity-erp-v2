/**
 * scripts/backfill-property-coords.ts
 *
 * Geocodifica os imóveis que estão sem `latitude`/`longitude` mas têm
 * morada/CP. Usa Mapbox Geocoding API (limite 100k req/mês, free tier).
 *
 * Idempotente — re-correr só toca em rows que ainda não têm coords.
 *
 * RUN:
 *   npx tsx scripts/backfill-property-coords.ts
 *
 * Pré-requisitos:
 *   - .env.local com NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *     NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
 */

import { config as loadEnv } from 'dotenv'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

loadEnv({ path: path.resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[backfill] Falta NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!MAPBOX_TOKEN) {
  console.error('[backfill] Falta NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const MIN_RELEVANCE = 0.5
const RATE_LIMIT_DELAY_MS = 100 // gentle Mapbox rate-limit (10 req/s)

interface Property {
  id: string
  title: string | null
  address_street: string | null
  postal_code: string | null
  city: string | null
  zone: string | null
}

function buildQuery(p: Property): string | null {
  const parts: string[] = []
  if (p.address_street?.trim()) parts.push(p.address_street.trim())
  if (p.postal_code?.trim()) parts.push(p.postal_code.trim())
  if (p.city?.trim()) parts.push(p.city.trim())
  if (parts.length === 0 && p.zone?.trim()) parts.push(p.zone.trim())
  if (parts.length === 0) return null
  return parts.join(', ')
}

async function geocode(query: string): Promise<{ lat: number; lng: number; relevance: number; place_name: string } | null> {
  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN!,
    country: 'PT',
    language: 'pt',
    limit: '1',
    types: 'address,postcode,place,locality,neighborhood',
  })
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = (await res.json()) as {
    features?: Array<{ center?: [number, number]; relevance?: number; place_name?: string }>
  }
  const feature = data.features?.[0]
  if (!feature?.center || feature.center.length !== 2) return null
  const relevance = feature.relevance ?? 0
  if (relevance < MIN_RELEVANCE) return null
  return {
    lng: feature.center[0],
    lat: feature.center[1],
    relevance,
    place_name: feature.place_name ?? query,
  }
}

async function main() {
  console.log('[backfill] A listar imóveis sem coords...')
  const { data, error } = await admin
    .from('dev_properties')
    .select('id, title, address_street, postal_code, city, zone')
    .or('latitude.is.null,longitude.is.null')
    .in('status', ['active', 'reserved', 'pending_approval', 'in_process', 'draft'])

  if (error) {
    console.error('[backfill] Erro a listar:', error.message)
    process.exit(1)
  }

  const properties = (data ?? []) as Property[]
  console.log(`[backfill] ${properties.length} imóveis candidatos.`)

  let success = 0
  let skipped = 0
  let failed = 0
  const failures: Array<{ id: string; title: string; reason: string }> = []

  for (const [index, p] of properties.entries()) {
    const prefix = `[${index + 1}/${properties.length}]`
    const label = p.title?.slice(0, 50) ?? p.id
    process.stdout.write(`${prefix} ${label}... `)

    const query = buildQuery(p)
    if (!query) {
      console.log('SKIP (sem morada/CP)')
      skipped++
      continue
    }

    try {
      const geo = await geocode(query)
      if (!geo) {
        console.log(`FAIL (Mapbox sem resultado para: "${query}")`)
        failed++
        failures.push({ id: p.id, title: label, reason: `Sem resultado: ${query}` })
        continue
      }

      const { error: updErr } = await admin
        .from('dev_properties')
        .update({ latitude: geo.lat, longitude: geo.lng })
        .eq('id', p.id)

      if (updErr) {
        console.log(`FAIL (UPDATE: ${updErr.message})`)
        failed++
        failures.push({ id: p.id, title: label, reason: `UPDATE: ${updErr.message}` })
        continue
      }

      console.log(`OK (${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)} · rel ${geo.relevance.toFixed(2)})`)
      success++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`FAIL (${msg})`)
      failed++
      failures.push({ id: p.id, title: label, reason: msg })
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS))
  }

  console.log()
  console.log('═════════════════════════════════════')
  console.log(`✅ Sucesso:  ${success}`)
  console.log(`⏭️  Skipped:  ${skipped}`)
  console.log(`❌ Falhas:   ${failed}`)
  console.log('═════════════════════════════════════')

  if (failures.length > 0) {
    console.log()
    console.log('Falhas detalhadas:')
    for (const f of failures) {
      console.log(`  - ${f.title} (${f.id}): ${f.reason}`)
    }
  }
}

main().catch((err) => {
  console.error('[backfill] Erro fatal:', err)
  process.exit(1)
})
