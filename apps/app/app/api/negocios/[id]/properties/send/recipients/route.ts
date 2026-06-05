import { NextResponse } from 'next/server'

import { requirePermission } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'

interface Candidate {
  source: 'consultant' | 'lead'
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
  leadFirstName: string | null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('leads')
  if (!auth.authorized) return auth.response

  const { id } = await params
  const admin = createAdminClient() as any

  const { data: negocio, error } = await admin
    .from('negocios')
    .select(
      'id, tipo, assigned_consultant_id, lead:leads!lead_id(id, nome, full_name, email, telemovel, telefone)'
    )
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!negocio) {
    return NextResponse.json({ error: 'Negócio não encontrado' }, { status: 404 })
  }

  const lead = negocio.lead || null
  const leadName: string = lead?.nome || lead?.full_name || 'Lead'
  const leadFirstName = leadName.trim().split(/\s+/)[0] || null

  const owners: Candidate[] = []
  if (lead) {
    if (lead.email) {
      owners.push({
        source: 'lead',
        id: lead.id,
        label: leadName,
        email: lead.email,
        phone: lead.telemovel || lead.telefone || null,
        isMain: true,
      })
    } else if (lead.telemovel || lead.telefone) {
      owners.push({
        source: 'lead',
        id: lead.id,
        label: leadName,
        email: null,
        phone: lead.telemovel || lead.telefone || null,
        isMain: true,
      })
    }
  }

  let consultant: Candidate | null = null
  if (negocio.assigned_consultant_id) {
    const { data: user } = await admin
      .from('dev_users')
      .select('id, commercial_name, professional_email')
      .eq('id', negocio.assigned_consultant_id)
      .maybeSingle()
    const { data: profile } = await admin
      .from('dev_consultant_profiles')
      .select('phone_commercial')
      .eq('user_id', negocio.assigned_consultant_id)
      .maybeSingle()
    if (user) {
      consultant = {
        source: 'consultant',
        id: user.id,
        label: user.commercial_name || 'Consultor',
        email: user.professional_email || null,
        phone: profile?.phone_commercial || null,
      }
    }
  }

  const response: RecipientsResponse = {
    entityRef: null,
    entityLabel: leadName,
    consultant,
    owners,
    leadFirstName,
  }
  return NextResponse.json(response)
}
