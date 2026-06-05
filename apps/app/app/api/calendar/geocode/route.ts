import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Server-side proxy to Nominatim (OpenStreetMap geocoder). Two reasons we go through
// the server instead of calling Nominatim directly from the browser:
//  - Their usage policy *requires* a descriptive User-Agent identifying the app.
//  - Avoids leaking the caller IP and lets us add a small in-process rate guard.
//
// Modes (mutually exclusive):
//   GET ?q=<text>                       → forward search (autocomplete)
//   GET ?lat=<lat>&lng=<lng>            → reverse geocoding (marker drag)

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'
const USER_AGENT = 'InfinityGroupERP/1.0 (https://app.infinitygroup.pt)'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')

  try {
    if (q) {
      if (q.length < 2) return NextResponse.json({ results: [] })
      const url = new URL(`${NOMINATIM_BASE}/search`)
      url.searchParams.set('q', q)
      url.searchParams.set('format', 'jsonv2')
      url.searchParams.set('addressdetails', '1')
      url.searchParams.set('limit', '5')
      url.searchParams.set('accept-language', 'pt-PT')
      url.searchParams.set('countrycodes', 'pt')

      const res = await fetch(url.toString(), {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        cache: 'no-store',
      })
      if (!res.ok) {
        return NextResponse.json({ error: 'Falha ao pesquisar morada.' }, { status: 502 })
      }
      const data = await res.json() as Array<Record<string, any>>
      const results = data.map((row) => ({
        id: String(row.place_id),
        label: row.display_name as string,
        lat: parseFloat(row.lat),
        lng: parseFloat(row.lon),
        address: row.address ?? {},
      }))
      return NextResponse.json({ results })
    }

    if (lat && lng) {
      const latNum = parseFloat(lat)
      const lngNum = parseFloat(lng)
      if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
        return NextResponse.json({ error: 'Coordenadas inválidas.' }, { status: 400 })
      }
      const url = new URL(`${NOMINATIM_BASE}/reverse`)
      url.searchParams.set('lat', String(latNum))
      url.searchParams.set('lon', String(lngNum))
      url.searchParams.set('format', 'jsonv2')
      url.searchParams.set('addressdetails', '1')
      url.searchParams.set('accept-language', 'pt-PT')
      url.searchParams.set('zoom', '18')

      const res = await fetch(url.toString(), {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        cache: 'no-store',
      })
      if (!res.ok) {
        return NextResponse.json({ error: 'Falha ao localizar morada.' }, { status: 502 })
      }
      const row = await res.json() as Record<string, any>
      return NextResponse.json({
        result: row?.display_name
          ? {
              id: String(row.place_id),
              label: row.display_name as string,
              lat: parseFloat(row.lat),
              lng: parseFloat(row.lon),
              address: row.address ?? {},
            }
          : null,
      })
    }

    return NextResponse.json({ error: 'Indique q ou lat+lng.' }, { status: 400 })
  } catch (err) {
    console.error('[calendar/geocode]', err)
    return NextResponse.json({ error: 'Erro interno na geocodificação.' }, { status: 500 })
  }
}
