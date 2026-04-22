import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { hasPermissionServer } from '@/lib/auth/check-permission-server'
import { createSiteSchema } from '@/lib/validations/acessos-custom-site'
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

export async function GET() {
  try {
    const supabase = (await createClient()) as any
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('acessos_custom_sites')
      .select('*')
      .eq('is_active', true)
      .or(`scope.eq.global,owner_id.eq.${user.id}`)
      .order('scope', { ascending: true }) // 'global' < 'personal' alphabetically
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const canManageGlobal = await hasPermissionServer(supabase, user.id, 'settings')
    const hydrated = (data ?? []).map((s: AcessosCustomSite) =>
      hydrate(s, user.id, canManageGlobal)
    )

    return NextResponse.json(hydrated)
  } catch (err) {
    console.error('Erro ao listar sites de acessos:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = (await createClient()) as any
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createSiteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { scope, title, url, icon, sort_order } = parsed.data

    if (scope === 'global') {
      const canManage = await hasPermissionServer(supabase, user.id, 'settings')
      if (!canManage) {
        return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
      }
    }

    let finalSortOrder = sort_order
    if (typeof finalSortOrder !== 'number') {
      const { data: maxRow } = await supabase
        .from('acessos_custom_sites')
        .select('sort_order')
        .eq('scope', scope)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle()
      finalSortOrder = (maxRow?.sort_order ?? 0) + 10
    }

    const insertPayload = {
      scope,
      owner_id: scope === 'personal' ? user.id : null,
      title: title.trim(),
      url,
      icon: icon?.trim() || null,
      sort_order: finalSortOrder,
      is_system: false,
      is_active: true,
      created_by: user.id,
    }

    const { data, error } = await supabase
      .from('acessos_custom_sites')
      .insert(insertPayload)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabase.from('log_audit').insert({
      user_id: user.id,
      entity_type: 'acessos_custom_site',
      entity_id: data.id,
      action: 'acessos_custom_site.create',
      new_data: data,
    })

    const canManageGlobal = await hasPermissionServer(supabase, user.id, 'settings')
    return NextResponse.json(hydrate(data, user.id, canManageGlobal), { status: 201 })
  } catch (err) {
    console.error('Erro ao criar site de acessos:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
