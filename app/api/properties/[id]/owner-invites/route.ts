import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'
import { createOwnerInviteSchema } from '@/lib/validations/owner-invite'

const DEFAULT_EXPIRES_DAYS = 14

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id: propertyId } = await params
    const admin = createAdminClient()

    const { data, error } = await (admin as any)
      .from('property_owner_invites')
      .select(
        `id, token, status, expires_at, submitted_at, submitted_owner_ids, note, created_at,
         created_by_user:dev_users!property_owner_invites_created_by_fkey(id, commercial_name)`
      )
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const now = Date.now()
    const normalised = (data || []).map((row: any) => ({
      ...row,
      status:
        row.status === 'pending' && new Date(row.expires_at).getTime() < now
          ? 'expired'
          : row.status,
    }))

    return NextResponse.json(normalised)
  } catch (err) {
    console.error('Erro ao listar convites de proprietário:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('properties')
    if (!auth.authorized) return auth.response

    const { id: propertyId } = await params

    const body = await request.json().catch(() => ({}))
    const parsed = createOwnerInviteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: property, error: propError } = await supabase
      .from('dev_properties')
      .select('id')
      .eq('id', propertyId)
      .single()

    if (propError || !property) {
      return NextResponse.json(
        { error: 'Imóvel não encontrado' },
        { status: 404 }
      )
    }

    const expiresInDays = parsed.data.expires_in_days ?? DEFAULT_EXPIRES_DAYS
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)

    const admin = createAdminClient()
    const { data, error } = await (admin as any)
      .from('property_owner_invites')
      .insert({
        property_id: propertyId,
        created_by: auth.user.id,
        expires_at: expiresAt.toISOString(),
        note: parsed.data.note || null,
      })
      .select('id, token, status, expires_at, note, created_at')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('Erro ao criar convite de proprietário:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
