import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'

const PROPERTY_SELECT = `
  *,
  property:dev_properties!property_id(
    id, title, external_ref, city, zone, listing_price, slug, property_type, business_type, status, description, address_street, postal_code,
    dev_property_specifications(bedrooms, bathrooms, area_gross, area_util, parking_spaces, features, typology),
    dev_property_media(url, is_cover, order_index),
    consultant:dev_users!consultant_id(
      id, commercial_name, professional_email,
      dev_consultant_profiles(profile_photo_url, phone_commercial, specializations)
    )
  )
`

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const admin = createAdminClient() as any

    const { data, error } = await admin
      .from('negocio_properties')
      .select(PROPERTY_SELECT)
      .eq('negocio_id', id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data || [] })
  } catch (err) {
    console.error('[negocio-properties GET]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const body = await request.json()
    const admin = createAdminClient() as any

    const insertData: any = { negocio_id: id }

    if (body.property_id) {
      insertData.property_id = body.property_id
    } else if (body.external_url) {
      insertData.external_url = body.external_url
      insertData.external_title = body.external_title || null
      insertData.external_price = body.external_price ? Number(body.external_price) : null
      insertData.external_source = body.external_source || null
    } else {
      return NextResponse.json({ error: 'Forneça property_id ou external_url.' }, { status: 400 })
    }

    const { data, error } = await admin
      .from('negocio_properties')
      .insert(insertData)
      .select(PROPERTY_SELECT)
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Este imóvel já foi adicionado.' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[negocio-properties POST]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
