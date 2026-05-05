import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createCrmAdminClient } from '@/lib/supabase/admin-untyped'
import { requireRoles } from '@/lib/auth/permissions'

const ALLOWED_ROLES = ['admin', 'Broker/CEO', 'Office Manager'] as const

const PROTECTED_SELF_ROLES = new Set(['admin', 'Broker/CEO'])

const assignSchema = z.object({
  role_id: z.string().uuid(),
})

/**
 * Atribui um role ao utilizador. Idempotente — se já existir, devolve 200.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRoles(ALLOWED_ROLES)
  if (!auth.authorized) return auth.response

  const { id: targetUserId } = await params
  const body = await request.json().catch(() => ({}))
  const parsed = assignSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'role_id inválido' }, { status: 400 })
  }

  const db = createCrmAdminClient() as any

  const { data: roleRow } = await db
    .from('roles')
    .select('id, name')
    .eq('id', parsed.data.role_id)
    .single()
  if (!roleRow) {
    return NextResponse.json({ error: 'Role não encontrado' }, { status: 404 })
  }

  const { error } = await db
    .from('user_roles')
    .upsert(
      { user_id: targetUserId, role_id: parsed.data.role_id, assigned_by: auth.user.id, assigned_at: new Date().toISOString() },
      { onConflict: 'user_id,role_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db.from('log_audit').insert({
    user_id: auth.user.id,
    entity_type: 'user_role',
    entity_id: targetUserId,
    action: 'assign_role',
    new_data: { role_id: roleRow.id, role_name: roleRow.name },
  })

  return NextResponse.json({ ok: true })
}

/**
 * Remove um role do utilizador. Bloqueia:
 *  - remover o último role (utilizador ficaria órfão).
 *  - remover admin/Broker/CEO de si próprio (lock-out preventivo).
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRoles(ALLOWED_ROLES)
  if (!auth.authorized) return auth.response

  const { id: targetUserId } = await params
  const { searchParams } = new URL(request.url)
  const roleId = searchParams.get('role_id')
  if (!roleId) {
    return NextResponse.json({ error: 'role_id obrigatório' }, { status: 400 })
  }

  const db = createCrmAdminClient() as any

  // Verifica que o role existe e que não é o último do utilizador.
  const { data: existingRoles } = await db
    .from('user_roles')
    .select('role_id, role:roles(name)')
    .eq('user_id', targetUserId)

  const rows = (existingRoles ?? []) as Array<{ role_id: string; role: { name: string } | null }>
  if (rows.length <= 1) {
    return NextResponse.json(
      { error: 'Não é possível remover o último role — atribua outro primeiro.' },
      { status: 409 }
    )
  }
  const target = rows.find((r) => r.role_id === roleId)
  if (!target) {
    return NextResponse.json({ error: 'Utilizador não tem este role' }, { status: 404 })
  }

  if (targetUserId === auth.user.id && target.role?.name && PROTECTED_SELF_ROLES.has(target.role.name)) {
    return NextResponse.json(
      { error: `Não pode remover '${target.role.name}' de si próprio.` },
      { status: 409 }
    )
  }

  const { error } = await db
    .from('user_roles')
    .delete()
    .eq('user_id', targetUserId)
    .eq('role_id', roleId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db.from('log_audit').insert({
    user_id: auth.user.id,
    entity_type: 'user_role',
    entity_id: targetUserId,
    action: 'remove_role',
    old_data: { role_id: roleId, role_name: target.role?.name ?? null },
  })

  return NextResponse.json({ ok: true })
}
