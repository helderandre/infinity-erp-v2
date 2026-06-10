import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'

/**
 * GET /api/geo/reverse?lat=<lat>&lng=<lng>
 *
 * Reverse-geocode de coordenadas para a hierarquia administrativa portuguesa
 * via geoapi.pt (sem API key). Usado quando o consultor escolhe uma morada
 * de rua no autocomplete (Mapbox) — o Mapbox dá as coordenadas mas não dá a
 * freguesia exacta; o geoapi.pt dá.
 *
 * Resposta:
 *   {
 *     distrito: string | null,
 *     concelho: string | null,
 *     freguesia: string | null,
 *     area: { id, type, name, parent_label } | null   // match em admin_areas
 *   }
 *
 * `area` é a row de `admin_areas` correspondente à freguesia (fallback:
 * concelho) — permite sincronizar o campo `negocios.zonas` para o chip de
 * zona e o matching geográfico continuarem coerentes.
 */
export async function GET(request: Request) {
  const auth = await requirePermission('leads')
  if (!auth.authorized) return auth.response

  const url = new URL(request.url)
  const lat = parseFloat(url.searchParams.get('lat') ?? '')
  const lng = parseFloat(url.searchParams.get('lng') ?? '')

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'lat/lng inválidos' }, { status: 400 })
  }

  let distrito: string | null = null
  let concelho: string | null = null
  let freguesia: string | null = null

  try {
    const res = await fetch(
      `https://json.geoapi.pt/gps/${lat.toFixed(6)},${lng.toFixed(6)}?json=1`,
      { next: { revalidate: 86400 } },
    )
    if (res.ok) {
      const data = (await res.json()) as {
        distrito?: string
        concelho?: string
        freguesia?: string
      }
      distrito = data.distrito ?? null
      concelho = data.concelho ?? null
      freguesia = data.freguesia ?? null
    }
  } catch {
    // geoapi indisponível — devolvemos nulls; o caller degrada graciosamente.
  }

  // Match em admin_areas para obter o area_id (para `negocios.zonas`).
  // admin_areas foi criada após a última regeneração de types/database.ts —
  // cast estrutural até regenerarmos (mesmo padrão de /api/admin-areas/*).
  type AreaRow = {
    id: string
    type: 'distrito' | 'concelho' | 'freguesia'
    name: string
    parent_id: string | null
  }
  const supabase = await createClient()
  const sb = supabase as unknown as {
    from: (t: 'admin_areas') => {
      select: (c: string) => {
        eq: (c: string, v: string) => {
          ilike: (c: string, v: string) => {
            limit: (n: number) => Promise<{
              data: AreaRow[] | null
              error: { message: string } | null
            }>
          }
        }
      }
    }
  }

  let area: { id: string; type: AreaRow['type']; name: string; parent_label: string | null } | null = null

  let concelhoRow: AreaRow | null = null
  if (concelho) {
    const { data } = await sb
      .from('admin_areas')
      .select('id, type, name, parent_id')
      .eq('type', 'concelho')
      .ilike('name', concelho)
      .limit(1)
    concelhoRow = data?.[0] ?? null
  }

  if (freguesia) {
    const { data } = await sb
      .from('admin_areas')
      .select('id, type, name, parent_id')
      .eq('type', 'freguesia')
      .ilike('name', freguesia)
      .limit(5)
    const rows = data ?? []
    // Freguesias homónimas existem em concelhos diferentes — preferir a que
    // pertence ao concelho devolvido pelo geoapi.
    const match = concelhoRow
      ? rows.find((r) => r.parent_id === concelhoRow!.id) ?? (rows.length === 1 ? rows[0] : null)
      : rows.length === 1
        ? rows[0]
        : null
    if (match) {
      area = { id: match.id, type: match.type, name: match.name, parent_label: concelho }
    }
  }

  if (!area && concelhoRow) {
    area = { id: concelhoRow.id, type: concelhoRow.type, name: concelhoRow.name, parent_label: distrito }
  }

  return NextResponse.json({ distrito, concelho, freguesia, area })
}
