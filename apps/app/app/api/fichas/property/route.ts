import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// Public endpoint — no auth required
// Returns minimal property info for the ficha form
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    if (!slug) {
      return NextResponse.json({ error: 'slug é obrigatório.' }, { status: 400 })
    }

    const admin = createAdminClient() as any

    // Try by slug first, then by ID
    let data = null

    const { data: bySlug } = await admin
      .from('dev_properties')
      .select('id, title, external_ref, city, zone, address_street, slug')
      .eq('slug', slug)
      .single()

    if (bySlug) {
      data = bySlug
    } else {
      // Try by ID (in case the URL uses ID instead of slug)
      const { data: byId } = await admin
        .from('dev_properties')
        .select('id, title, external_ref, city, zone, address_street, slug')
        .eq('id', slug)
        .single()

      data = byId
    }

    if (!data) {
      return NextResponse.json({ error: 'Imóvel não encontrado.' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[fichas/property GET]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
