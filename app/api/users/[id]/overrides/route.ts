import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { requireRoles } from '@/lib/auth/permissions'
import { ALL_PERMISSION_MODULES } from '@/lib/auth/roles'

// Apenas admin/Broker/CEO podem mexer em overrides — Office Manager pode
// gerir roles mas não overrides (escolha deliberada para evitar fragmentação
// silenciosa de permissões; ver discussão em CLAUDE.md).
const ALLOWED_ROLES = ['admin', 'Broker/CEO', 'Office Manager'] as const

const upsertSchema = z.object({
  module: z.enum([...ALL_PERMISSION_MODULES] as [string, ...string[]]),
  mode: z.enum(['grant', 'deny']),
  expires_at: z.string().datetime().nullable().optional(),
  reason: z.string().max(500).nullable().optional(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRoles(ALLOWED_ROLES)
  if (!auth.authorized) return auth.response

  const { id: targetUserId } = await params
  const db = createCrmAdminClient() as any

  const { data, error } = await db
    .from('user_permission_overrides')
    .select('id, module, mode, expires_at, reason, created_by, created_at, updated_at')
    .eq('user_id', targetUserId)
    .order('module')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

/**
 * Upsert por (user_id, module). Se já existir, substitui — mantém histórico
 * via log_audit.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRoles(ALLOWED_ROLES)
  if (!auth.authorized) return auth.response

  const { id: targetUserId } = await params
  const body = await request.json().catch(() => ({}))
  const parsed = upsertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const db = createCrmAdminClient() as any

  const { data: existing } = await db
    .from('user_permission_overrides')
    .select('id, module, mode, expires_at, reason')
    .eq('user_id', targetUserId)
    .eq('module', parsed.data.module)
    .maybeSingle()

  const payload = {
    user_id: targetUserId,
    module: parsed.data.module,
    mode: parsed.data.mode,
    expires_at: parsed.data.expires_at ?? null,
    reason: parsed.data.reason ?? null,
    created_by: auth.user.id,
  }

  const { data, error } = await db
    .from('user_permission_overrides')
    .upsert(payload, { onConflict: 'user_id,module' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db.from('log_audit').insert({
    user_id: auth.user.id,
    entity_type: 'user_permission_override',
    entity_id: targetUserId,
    action: existing ? 'update_override' : 'create_override',
    old_data: existing ?? null,
    new_data: payload,
  })

  return NextResponse.json({ data })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRoles(ALLOWED_ROLES)
  if (!auth.authorized) return auth.response

  const { id: targetUserId } = await params
  const { searchParams } = new URL(request.url)
  const module = searchParams.get('module')
  if (!module) {
    return NextResponse.json({ error: 'module obrigatório' }, { status: 400 })
  }

  const db = createCrmAdminClient() as any

  const { data: existing } = await db
    .from('user_permission_overrides')
    .select('id, module, mode, expires_at, reason')
    .eq('user_id', targetUserId)
    .eq('module', module)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ ok: true, deleted: false })
  }

  const { error } = await db
    .from('user_permission_overrides')
    .delete()
    .eq('user_id', targetUserId)
    .eq('module', module)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db.from('log_audit').insert({
    user_id: auth.user.id,
    entity_type: 'user_permission_override',
    entity_id: targetUserId,
    action: 'delete_override',
    old_data: existing,
  })

  return NextResponse.json({ ok: true, deleted: true })
}
