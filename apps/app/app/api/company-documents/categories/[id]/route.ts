import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { hasPermissionServer } from '@/lib/auth/check-permission-server'

const updateSchema = z
  .object({
    label: z.string().trim().min(1).max(80).optional(),
    icon: z.string().trim().max(40).nullable().optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/i, 'Cor inválida')
      .nullable()
      .optional(),
    sort_order: z.number().int().optional(),
    is_active: z.boolean().optional(),
    slug: z.string().optional(), // reject — never accept slug changes
  })
  .strict()

const deleteSchema = z
  .object({
    reassign_to: z.string().optional(),
  })
  .optional()

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

    const canManage = await hasPermissionServer(supabase, user.id, 'settings')
    if (!canManage) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await request.json()

    if ('slug' in body) {
      return NextResponse.json(
        { error: 'O identificador (slug) não pode ser alterado' },
        { status: 400 }
      )
    }

    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { data: existing, error: fetchError } = await supabase
      .from('company_document_categories')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 })
    }

    if (
      existing.is_system &&
      parsed.data.is_active === false
    ) {
      return NextResponse.json(
        { error: 'Categorias do sistema não podem ser desactivadas' },
        { status: 409 }
      )
    }

    const updates: Record<string, any> = {}
    if (parsed.data.label !== undefined) updates.label = parsed.data.label.trim()
    if (parsed.data.icon !== undefined) {
      updates.icon = parsed.data.icon?.trim() || null
    }
    if (parsed.data.color !== undefined) updates.color = parsed.data.color || null
    if (parsed.data.sort_order !== undefined) updates.sort_order = parsed.data.sort_order
    if (parsed.data.is_active !== undefined) updates.is_active = parsed.data.is_active

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(existing)
    }

    const { data, error } = await supabase
      .from('company_document_categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabase.from('log_audit').insert({
      user_id: user.id,
      entity_type: 'company_document_category',
      entity_id: id,
      action: 'update',
      old_data: existing,
      new_data: data,
    })

    return NextResponse.json(data)
  } catch (err) {
    console.error('Erro ao actualizar categoria:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
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

    const canManage = await hasPermissionServer(supabase, user.id, 'settings')
    if (!canManage) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    let reassignTo: string | undefined
    if (request.headers.get('content-length') && Number(request.headers.get('content-length')) > 0) {
      try {
        const rawBody = await request.json()
        const parsed = deleteSchema.safeParse(rawBody)
        if (parsed.success && parsed.data) {
          reassignTo = parsed.data.reassign_to
        }
      } catch {
        // no body is fine
      }
    }

    const { data: existing, error: fetchError } = await supabase
      .from('company_document_categories')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 })
    }
    if (existing.is_system) {
      return NextResponse.json(
        { error: 'Categorias do sistema não podem ser eliminadas' },
        { status: 409 }
      )
    }
    if (!existing.is_active) {
      // Already inactive — nothing to do
      return NextResponse.json({ ok: true, reassigned: 0 })
    }

    // Count active documents in this category
    const { count: docCount } = await supabase
      .from('company_documents')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)
      .or(`category.eq.${existing.slug},category_id.eq.${id}`)

    if ((docCount ?? 0) > 0 && !reassignTo) {
      return NextResponse.json(
        {
          error: `A categoria contém ${docCount} documento${docCount === 1 ? '' : 's'} activo${docCount === 1 ? '' : 's'}`,
          document_count: docCount,
        },
        { status: 409 }
      )
    }

    let reassigned = 0
    if ((docCount ?? 0) > 0 && reassignTo) {
      const { data: target, error: targetError } = await supabase
        .from('company_document_categories')
        .select('id, slug, is_active')
        .eq('slug', reassignTo)
        .maybeSingle()
      if (targetError) {
        return NextResponse.json({ error: targetError.message }, { status: 500 })
      }
      if (!target || !target.is_active) {
        return NextResponse.json(
          { error: 'Categoria de destino inválida ou inactiva' },
          { status: 400 }
        )
      }
      if (target.id === id) {
        return NextResponse.json(
          { error: 'A categoria de destino não pode ser a mesma' },
          { status: 400 }
        )
      }
      const { error: reassignError, count: reassignedCount } = await supabase
        .from('company_documents')
        .update({ category: target.slug, category_id: target.id })
        .eq('is_active', true)
        .or(`category.eq.${existing.slug},category_id.eq.${id}`)
        .select('id', { count: 'exact', head: true })
      if (reassignError) {
        return NextResponse.json({ error: reassignError.message }, { status: 500 })
      }
      reassigned = reassignedCount ?? docCount ?? 0
    }

    const { error: deleteError } = await supabase
      .from('company_document_categories')
      .update({ is_active: false })
      .eq('id', id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    await supabase.from('log_audit').insert({
      user_id: user.id,
      entity_type: 'company_document_category',
      entity_id: id,
      action: 'delete',
      old_data: existing,
      new_data: { ...existing, is_active: false, reassigned, reassign_to: reassignTo || null },
    })

    return NextResponse.json({ ok: true, reassigned })
  } catch (err) {
    console.error('Erro ao eliminar categoria:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
