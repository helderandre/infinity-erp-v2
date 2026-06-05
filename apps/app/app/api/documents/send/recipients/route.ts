import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/permissions'

type Domain = 'properties' | 'processes'

interface Candidate {
  source: 'consultant' | 'owner'
  id: string
  label: string
  email: string | null
  phone: string | null
  isMain?: boolean
}

interface RecipientsResponse {
  entityRef: string | null
  entityLabel: string | null
  consultant: Candidate | null
  owners: Candidate[]
}

export async function GET(request: Request) {
  const auth = await requireAuth()
  if (!auth.authorized) return auth.response

  const { searchParams } = new URL(request.url)
  const domain = searchParams.get('domain') as Domain | null
  const entityId = searchParams.get('entityId')

  if (!domain || !['properties', 'processes'].includes(domain)) {
    return NextResponse.json(
      { error: 'domain inválido (use properties ou processes)' },
      { status: 400 }
    )
  }
  if (!entityId) {
    return NextResponse.json({ error: 'entityId obrigatório' }, { status: 400 })
  }

  const admin = createAdminClient()

  let propertyId: string | null = null
  let entityRef: string | null = null
  let entityLabel: string | null = null

  if (domain === 'properties') {
    const { data: property, error } = await admin
      .from('dev_properties')
      .select('id, title, external_ref, consultant_id')
      .eq('id', entityId)
      .maybeSingle()
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!property) {
      return NextResponse.json({ error: 'Imóvel não encontrado' }, { status: 404 })
    }
    propertyId = property.id
    entityRef = property.external_ref ?? property.id.slice(0, 8).toUpperCase()
    entityLabel = property.title ?? entityRef
  } else {
    const { data: process, error } = await admin
      .from('proc_instances')
      .select('id, external_ref, property_id')
      .eq('id', entityId)
      .maybeSingle()
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!process) {
      return NextResponse.json(
        { error: 'Processo não encontrado' },
        { status: 404 }
      )
    }
    propertyId = process.property_id
    entityRef = process.external_ref
    entityLabel = process.external_ref
  }

  let consultant: Candidate | null = null
  const owners: Candidate[] = []

  if (propertyId) {
    const { data: prop } = await admin
      .from('dev_properties')
      .select('consultant_id')
      .eq('id', propertyId)
      .maybeSingle()

    const consultantId = prop?.consultant_id ?? null
    if (consultantId) {
      const [userRes, profileRes, emailRes] = await Promise.all([
        admin
          .from('dev_users')
          .select('id, commercial_name, professional_email')
          .eq('id', consultantId)
          .maybeSingle(),
        admin
          .from('dev_consultant_profiles')
          .select('phone_commercial')
          .eq('user_id', consultantId)
          .maybeSingle(),
        admin
          .from('consultant_email_accounts')
          .select('email_address')
          .eq('consultant_id', consultantId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      const name = userRes.data?.commercial_name ?? 'Consultor'
      consultant = {
        source: 'consultant',
        id: consultantId,
        label: name,
        email:
          emailRes.data?.email_address ??
          userRes.data?.professional_email ??
          null,
        phone: profileRes.data?.phone_commercial ?? null,
      }
    }

    const { data: propertyOwners } = await admin
      .from('property_owners')
      .select('owner_id, is_main_contact, owners(id, name, email, phone)')
      .eq('property_id', propertyId)

    if (Array.isArray(propertyOwners)) {
      for (const po of propertyOwners) {
        const owner = (po as unknown as {
          owners: { id: string; name: string; email: string | null; phone: string | null } | null
          is_main_contact: boolean | null
        }).owners
        if (!owner) continue
        owners.push({
          source: 'owner',
          id: owner.id,
          label: owner.name,
          email: owner.email,
          phone: owner.phone,
          isMain: (po as { is_main_contact: boolean | null }).is_main_contact === true,
        })
      }
      owners.sort((a, b) => (b.isMain ? 1 : 0) - (a.isMain ? 1 : 0))
    }
  }

  const response: RecipientsResponse = {
    entityRef,
    entityLabel,
    consultant,
    owners,
  }
  return NextResponse.json(response)
}
