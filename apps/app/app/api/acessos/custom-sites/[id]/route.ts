import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { hasPermissionServer } from '@/lib/auth/check-permission-server'
import { updateSiteSchema } from '@/lib/validations/acessos-custom-site'
import type { AcessosCustomSite, HydratedAcessosCustomSite } from '@/types/acessos'

function hydrate(
  site: AcessosCustomSite,
  userId: string,
  canManageGlobal: boolean
): HydratedAcessosCustomSite {
  const isOwner = site.scope === 'personal' && site.owner_id === userId
  const isGlobal = site.scope === 'global'
  const canEdit = isOwner || (isGlobal && canManageGlobal)
  const canDelete = canEdit && !site.is_system
  return { ...site, can_edit: canEdit, can_delete: canDelete }
}

async function authorizeMutation(
  supabase: any,
  userId: string,
  row: AcessosCustomSite
): Promise<boolean> {
  if (row.scope === 'personal') return row.owner_id === userId
  if (row.scope === 'global') {
    return await hasPermissionServer(supabase, userId, 'settings')
  }
  return false
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = (await createClient()) as any
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data: existing, error: fetchError } = await supabase
      .from('acessos_custom_sites')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    }

    const authorized = await authorizeMutation(supabase, user.id, existing)
    if (!authorized) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = updateSiteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const updatePayload: Record<string, unknown> = {}
    if (parsed.data.title !== undefined) updatePayload.title = parsed.data.title.trim()
    if (parsed.data.url !== undefined) updatePayload.url = parsed.data.url
    if (parsed.data.icon !== undefined) {
      updatePayload.icon = parsed.data.icon?.trim() || null
    }
    if (parsed.data.sort_order !== undefined) {
      updatePayload.sort_order = parsed.data.sort_order
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'Nenhum campo a actualizar' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('acessos_custom_sites')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabase.from('log_audit').insert({
      user_id: user.id,
      entity_type: 'acessos_custom_site',
      entity_id: id,
      action: 'acessos_custom_site.update',
      old_data: existing,
      new_data: data,
    })

    const canManageGlobal = await hasPermissionServer(supabase, user.id, 'settings')
    return NextResponse.json(hydrate(data, user.id, canManageGlobal))
  } catch (err) {
    console.error('Erro ao actualizar site de acessos:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = (await createClient()) as any
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data: existing, error: fetchError } = await supabase
      .from('acessos_custom_sites')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    }

    if (existing.is_system) {
      return NextResponse.json(
        { error: 'Sites do sistema não podem ser eliminados' },
        { status: 403 }
      )
    }

    const authorized = await authorizeMutation(supabase, user.id, existing)
    if (!authorized) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { error } = await supabase
      .from('acessos_custom_sites')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabase.from('log_audit').insert({
      user_id: user.id,
      entity_type: 'acessos_custom_site',
      entity_id: id,
      action: 'acessos_custom_site.delete',
      old_data: existing,
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Erro ao eliminar site de acessos:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
