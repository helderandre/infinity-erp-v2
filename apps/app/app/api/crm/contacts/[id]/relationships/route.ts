/**
 * Contact-to-contact relationships (marriage / partnership / etc.).
 *
 *   GET  /api/crm/contacts/[id]/relationships
 *     → every relationship touching this contacto (either direction), with the
 *       OTHER party hydrated. Bidirectional: A↔B is stored once.
 *
 *   POST /api/crm/contacts/[id]/relationships
 *     body: { related_contact_id, relationship_type?, notes? }
 */
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { requireAuth } from '@/lib/auth/permissions'
import { isManagementRole } from '@/lib/auth/roles'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const RELATIONSHIP_TYPES = ['conjuge', 'parceiro', 'familiar', 'socio', 'representante_legal', 'outro'] as const

const createSchema = z.object({
  related_contact_id: z.string().uuid(),
  relationship_type: z.enum(RELATIONSHIP_TYPES).optional().default('conjuge'),
  notes: z.string().max(2000).nullable().optional(),
})

const LEAD_COLS = 'id, nome, email, telemovel, agent_id'

async function checkContactAccess(supabase: any, id: string, userId: string, isManagement: boolean) {
  const { data, error } = await supabase.from('leads').select('agent_id').eq('id', id).maybeSingle()
  if (error) return { ok: false as const, status: 500, error: error.message }
  if (!data) return { ok: false as const, status: 404, error: 'Contacto não encontrado' }
  if (!isManagement && data.agent_id !== userId) {
    return { ok: false as const, status: 403, error: 'Sem permissão para este contacto' }
  }
  return { ok: true as const }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = createCrmAdminClient()
    const { id } = await params
    const access = await checkContactAccess(supabase, id, auth.user.id, isManagementRole(auth.roles))
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

    const { data, error } = await supabase
      .from('lead_relationships')
      .select(
        `id, relationship_type, notes, created_at, contact_id, related_contact_id,
         contact:leads!lead_relationships_contact_id_fkey(${LEAD_COLS}),
         related:leads!lead_relationships_related_contact_id_fkey(${LEAD_COLS})`,
      )
      .or(`contact_id.eq.${id},related_contact_id.eq.${id}`)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Normalize so the UI always gets the OTHER party regardless of direction.
    const rows = (data ?? []).map((r: any) => ({
      id: r.id,
      relationship_type: r.relationship_type,
      notes: r.notes,
      created_at: r.created_at,
      other: r.contact_id === id ? r.related : r.contact,
    }))

    return NextResponse.json({ data: rows })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = createCrmAdminClient()
    const { id } = await params

    const parsed = createSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    if (parsed.data.related_contact_id === id) {
      return NextResponse.json({ error: 'Um contacto não pode relacionar-se consigo próprio' }, { status: 400 })
    }

    const access = await checkContactAccess(supabase, id, auth.user.id, isManagementRole(auth.roles))
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

    const { data, error } = await supabase
      .from('lead_relationships')
      .insert({
        contact_id: id,
        related_contact_id: parsed.data.related_contact_id,
        relationship_type: parsed.data.relationship_type,
        notes: parsed.data.notes ?? null,
        created_by: auth.user.id,
      })
      .select('id')
      .single()

    if (error) {
      if ((error as { code?: string }).code === '23505') {
        return NextResponse.json({ error: 'Já existe uma relação entre estes contactos' }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ id: data.id }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
