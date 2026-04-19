import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { PresentationView } from '@/components/apresentacao/presentation-view'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const admin = createAdminClient()
  const r = await admin
    .from('dev_properties')
    .select('title')
    .or(`slug.eq.${slug},id.eq.${slug}`)
    .maybeSingle()
  const title = (r.data as any)?.title
  return { title: title ? `${title} — Infinity Group` : 'Apresentação — Infinity Group' }
}

interface PageProps {
  params: Promise<{ slug: string }>
  searchParams: Promise<{
    sections?: string
    print?: string
  }>
}

const DEFAULT_SECTIONS = [
  'cover',
  'resumo',
  'descricao',
  'galeria',
  'plantas',
  'staging',
  'localizacao',
  'consultor',
  'closing',
]

async function fetchPropertyBySlugOrId(slug: string) {
  const supabase = createAdminClient()

  // Try by slug first
  let q = await supabase
    .from('dev_properties')
    .select(`
      *,
      dev_property_specifications(*),
      dev_property_internal(*),
      dev_property_media(*),
      consultant:dev_users!consultant_id(
        id, commercial_name, professional_email,
        dev_consultant_profiles(profile_photo_url, phone_commercial)
      )
    `)
    .eq('slug', slug)
    .maybeSingle()

  if (!q.data) {
    // Fallback by id
    q = await supabase
      .from('dev_properties')
      .select(`
        *,
        dev_property_specifications(*),
        dev_property_internal(*),
        dev_property_media(*),
        consultant:dev_users!dev_properties_consultant_id_fkey(
          id, commercial_name, professional_email,
          dev_consultant_profiles(profile_photo_url, phone_commercial)
        )
      `)
      .eq('id', slug)
      .maybeSingle()
  }

  return q.data as any
}

export default async function ApresentacaoPage({ params, searchParams }: PageProps) {
  const { slug } = await params
  const sp = await searchParams

  const property = await fetchPropertyBySlugOrId(slug)
  if (!property) notFound()

  const sections = sp.sections
    ? sp.sections.split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULT_SECTIONS

  const isPrint = sp.print === 'true' || sp.print === '1'

  return (
    <PresentationView property={property} sections={sections} isPrint={isPrint} />
  )
}
