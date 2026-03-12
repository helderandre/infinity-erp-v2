import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'

type Params = { params: Promise<{ id: string }> }

// GET: Obter form template por ID
export async function GET(_request: Request, { params }: Params) {
  try {
    const auth = await requirePermission('recruitment')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('tpl_form_templates')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[form-templates/[id]/GET] Error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// PUT: Actualizar form template
export async function PUT(request: Request, { params }: Params) {
  try {
    const auth = await requirePermission('recruitment')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const body = await request.json()
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (body.name !== undefined) updates.name = body.name
    if (body.description !== undefined) updates.description = body.description
    if (body.category !== undefined) updates.category = body.category
    if (body.sections !== undefined) updates.sections = body.sections

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('tpl_form_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('[form-templates/[id]/PUT] Error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE: Soft delete (is_active = false)
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const auth = await requirePermission('recruitment')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const admin = createAdminClient()
    const { error } = await admin
      .from('tpl_form_templates')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[form-templates/[id]/DELETE] Error:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
