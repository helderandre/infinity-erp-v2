import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { FichaView } from '@/components/apresentacao/ficha-view'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

const PUBLIC_SELECT = `
  id, slug, title, description, listing_price, property_type, business_type,
  property_condition, energy_certificate, external_ref,
  address_street, postal_code, city, zone, latitude, longitude,
  dev_property_specifications(
    typology, bedrooms, bathrooms, area_util, area_gross,
    construction_year, parking_spaces, garage_spaces,
    features, equipment, solar_orientation, views,
    has_elevator, fronts_count
  ),
  dev_property_media(id, url, media_type, order_index, is_cover, ai_room_label, ai_staged_url, source_media_id),
  consultant:dev_users!consultant_id(
    id, commercial_name, professional_email,
    dev_consultant_profiles(profile_photo_url, phone_commercial)
  )
`

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const admin = createAdminClient()
  const r = await admin
    .from('dev_properties')
    .select('title')
    .or(`slug.eq.${slug},id.eq.${slug}`)
    .maybeSingle()
  const title = (r.data as any)?.title
  return {
    title: title ? `${title} — Ficha — Infinity Group` : 'Ficha — Infinity Group',
    robots: { index: false, follow: false },
  }
}

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{
    sections?: string
    print?: string
    summary?: string
  }>
}

const DEFAULT_SECTIONS = [
  'cover',
  'resumo',
  'descricao',
  'galeria',
  'plantas',
  'localizacao',
  'consultor',
]

async function fetchPropertyBySlugOrId(slug: string) {
  const supabase = createAdminClient()

  let q = await supabase
    .from('dev_properties')
    .select(PUBLIC_SELECT)
    .eq('slug', slug)
    .maybeSingle()

  if (!q.data) {
    q = await supabase
      .from('dev_properties')
      .select(PUBLIC_SELECT)
      .eq('id', slug)
      .maybeSingle()
  }

  return q.data as any
}

export default async function FichaPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const sp = await searchParams

  const property = await fetchPropertyBySlugOrId(slug)
  if (!property) notFound()

  const sections = sp.sections
    ? sp.sections.split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULT_SECTIONS

  const isPrint = sp.print === 'true' || sp.print === '1'

  // Allow the API to inject a pre-summarized description via query param,
  // so the A4 ficha fits on one page regardless of original length.
  const descriptionOverride = sp.summary ? decodeURIComponent(sp.summary) : null
  if (descriptionOverride) property.description = descriptionOverride

  return <FichaView property={property} sections={sections} isPrint={isPrint} />
}
