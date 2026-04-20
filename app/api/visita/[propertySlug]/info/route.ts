import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Public endpoint — returns minimal data needed to render the booking page.
// No auth. Only exposes safe fields (no internal notes, no exact address, no owner info).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ propertySlug: string }> }
) {
  try {
    const { propertySlug } = await params
    const supabase = createAdminClient()

    // Fetch property + cover media
    const { data: property, error: propertyError } = await supabase
      .from('dev_properties')
      .select(`
        id,
        slug,
        title,
        description,
        listing_price,
        property_type,
        business_type,
        status,
        city,
        zone,
        consultant_id,
        dev_property_specifications (
          typology,
          bedrooms,
          bathrooms,
          area_util,
          area_gross
        ),
        dev_property_media (
          url,
          is_cover,
          order_index,
          media_type
        )
      `)
      .eq('slug', propertySlug)
      .maybeSingle()

    if (propertyError || !property) {
      return NextResponse.json({ error: 'Imóvel não encontrado' }, { status: 404 })
    }

    if (!property.consultant_id) {
      return NextResponse.json({ error: 'Imóvel sem consultor atribuído' }, { status: 404 })
    }

    // Fetch consultant public profile
    const { data: consultantUser } = await supabase
      .from('dev_users')
      .select('id, commercial_name')
      .eq('id', property.consultant_id)
      .maybeSingle()

    const { data: consultantProfile } = await supabase
      .from('dev_consultant_profiles')
      .select('profile_photo_url, bio')
      .eq('user_id', property.consultant_id)
      .maybeSingle()

    // Fetch booking settings for the consultant (may not exist yet)
    const { data: settings } = await supabase
      .from('consultant_booking_settings')
      .select('*')
      .eq('consultant_id', property.consultant_id)
      .maybeSingle()

    // Consultor only blocks booking if they explicitly disabled it
    if (settings && !settings.public_booking_enabled) {
      return NextResponse.json(
        { error: 'Agendamento público não está disponível para este imóvel' },
        { status: 404 }
      )
    }

    // Defaults if no settings row yet
    const effectiveSettings = {
      slot_duration_minutes: settings?.slot_duration_minutes ?? 30,
      advance_days: settings?.advance_days ?? 30,
      min_notice_hours: settings?.min_notice_hours ?? 24,
    }

    // Check there are rules available — either property-specific or consultant-level
    const { count: propertyRulesCount } = await supabase
      .from('property_availability_rules')
      .select('id', { count: 'exact', head: true })
      .eq('property_id', property.id)
      .eq('active', true)

    if (!propertyRulesCount) {
      const { count: consultantRulesCount } = await supabase
        .from('consultant_availability_rules')
        .select('id', { count: 'exact', head: true })
        .eq('consultant_id', property.consultant_id)
        .eq('active', true)

      if (!consultantRulesCount) {
        return NextResponse.json(
          { error: 'Sem disponibilidade configurada para este imóvel' },
          { status: 404 }
        )
      }
    }

    const specs = Array.isArray(property.dev_property_specifications)
      ? property.dev_property_specifications[0]
      : property.dev_property_specifications
    const media = (property.dev_property_media ?? [])
      .filter((m) => m.media_type !== 'planta' && m.media_type !== 'planta_3d')
    const cover = media.find((m) => m.is_cover) || media.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))[0]

    return NextResponse.json({
      property: {
        id: property.id,
        slug: property.slug,
        title: property.title,
        description: property.description,
        listing_price: property.listing_price,
        property_type: property.property_type,
        business_type: property.business_type,
        city: property.city,
        zone: property.zone,
        cover_url: cover?.url ?? null,
        typology: specs?.typology ?? null,
        bedrooms: specs?.bedrooms ?? null,
        bathrooms: specs?.bathrooms ?? null,
        area_util: specs?.area_util ?? null,
      },
      consultant: {
        name: consultantUser?.commercial_name ?? null,
        photo_url: consultantProfile?.profile_photo_url ?? null,
        bio: consultantProfile?.bio ?? null,
      },
      booking: effectiveSettings,
    })
  } catch (error) {
    console.error('Erro a obter info de agendamento:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
