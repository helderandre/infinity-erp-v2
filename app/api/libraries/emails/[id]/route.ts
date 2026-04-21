import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { emailTemplateUpdateSchema } from '@/lib/validations/email-template'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('tpl_email_library')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Template não encontrado' },
          { status: 404 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao obter template de email:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = emailTemplateUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { data: existing } = await supabase
      .from('tpl_email_library')
      .select('id, scope, scope_id, is_system')
      .eq('id', id)
      .maybeSingle()
    if (!existing) {
      return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 })
    }
    if ((existing as { is_system?: boolean }).is_system) {
      return NextResponse.json({ error: 'Template de sistema não pode ser editado' }, { status: 403 })
    }
    const { data: roleRow } = await supabase
      .from('dev_users')
      .select('user_roles!user_roles_user_id_fkey!inner(role:roles(name))')
      .eq('id', user.id)
      .maybeSingle()
    const roles = (((roleRow as unknown) as { user_roles?: Array<{ role?: { name?: string } }> })?.user_roles ?? [])
      .map((ur) => ur.role?.name)
      .filter(Boolean) as string[]
    const isBroker = roles.some((r) => ['admin', 'Broker/CEO'].includes(r))
    const existingRow = existing as { scope?: string; scope_id?: string | null }
    if (!isBroker && existingRow.scope === 'consultant' && existingRow.scope_id !== user.id) {
      return NextResponse.json({ error: 'Template não é seu' }, { status: 403 })
    }
    if (!isBroker && existingRow.scope === 'global') {
      return NextResponse.json({ error: 'Apenas administradores podem editar templates globais' }, { status: 403 })
    }

    const { data, error } = await supabase
      .from('tpl_email_library')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Template não encontrado' },
          { status: 404 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar template de email:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Scope guard — consultor só pode eliminar os seus próprios templates.
    const { data: existing } = await supabase
      .from('tpl_email_library')
      .select('id, scope, scope_id, is_system, created_by')
      .eq('id', id)
      .maybeSingle()
    if (!existing) {
      return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 })
    }
    if ((existing as { is_system?: boolean }).is_system) {
      return NextResponse.json({ error: 'Template de sistema não pode ser eliminado' }, { status: 403 })
    }
    const { data: roleRow } = await supabase
      .from('dev_users')
      .select('user_roles!user_roles_user_id_fkey!inner(role:roles(name))')
      .eq('id', user.id)
      .maybeSingle()
    const roles = (((roleRow as unknown) as { user_roles?: Array<{ role?: { name?: string } }> })?.user_roles ?? [])
      .map((ur) => ur.role?.name)
      .filter(Boolean) as string[]
    const isBroker = roles.some((r) => ['admin', 'Broker/CEO'].includes(r))
    const existingRow = existing as { scope?: string; scope_id?: string | null; created_by?: string | null }
    const isOwnConsultant = existingRow.scope === 'consultant' && existingRow.scope_id === user.id
    const isOwnLegacyGlobal = existingRow.scope === 'global' && existingRow.created_by === user.id
    if (!isBroker && !isOwnConsultant && !isOwnLegacyGlobal) {
      if (existingRow.scope === 'consultant') {
        return NextResponse.json({ error: 'Template não é seu' }, { status: 403 })
      }
      return NextResponse.json({ error: 'Apenas administradores podem eliminar templates globais' }, { status: 403 })
    }

    const { error } = await supabase
      .from('tpl_email_library')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao eliminar template de email:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
