import { NextResponse } from 'next/server'
import { z } from 'zod'

import { requireAuth } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidScope } from '@/lib/taxonomy/scopes'

const updateSchema = z.object({
  label: z.string().trim().min(1).max(80).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
}).refine((v) => Object.keys(v).length > 0, { message: 'Nada para actualizar' })

function ensureSettings(perms: Record<string, boolean>) {
  if (!perms.settings) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }
  return null
}

// PUT /api/taxonomy/[scope]/[id] — edit label / toggle active / reorder.
// Requires `settings` permission. `value` is immutable (it's referenced by
// existing rows in business tables — rename would orphan them).
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ scope: string; id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.authorized) return auth.response

  const denied = ensureSettings(auth.permissions)
  if (denied) return denied

  const { scope, id } = await params
  if (!isValidScope(scope)) {
    return NextResponse.json({ error: 'Scope inválido' }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  const patch: Record<string, unknown> = {}
  if (parsed.data.label !== undefined) patch.label = parsed.data.label.trim()
  if (parsed.data.is_active !== undefined) patch.is_active = parsed.data.is_active
  if (parsed.data.sort_order !== undefined) patch.sort_order = parsed.data.sort_order

  const { data, error } = await supabase
    .from('taxonomy_extras')
    .update(patch)
    .eq('id', id)
    .eq('scope', scope)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabase.from('log_audit').insert({
    user_id: auth.user.id,
    entity_type: 'taxonomy_extra',
    entity_id: id,
    action: 'update',
    new_data: data,
  })

  return NextResponse.json(data)
}

// DELETE /api/taxonomy/[scope]/[id] — soft-deactivate (`is_active=false`).
// We never hard-delete because business rows (e.g. dev_properties.property_type)
// may still reference the value; soft-delete just removes it from the picker.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ scope: string; id: string }> }
) {
  const auth = await requireAuth()
  if (!auth.authorized) return auth.response

  const denied = ensureSettings(auth.permissions)
  if (denied) return denied

  const { scope, id } = await params
  if (!isValidScope(scope)) {
    return NextResponse.json({ error: 'Scope inválido' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('taxonomy_extras')
    .select('id, value, scope')
    .eq('id', id)
    .eq('scope', scope)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
  }

  const { error } = await supabase
    .from('taxonomy_extras')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await supabase.from('log_audit').insert({
    user_id: auth.user.id,
    entity_type: 'taxonomy_extra',
    entity_id: id,
    action: 'delete',
    old_data: existing,
  })

  return NextResponse.json({ ok: true })
}
