import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { hasPermissionServer } from '@/lib/auth/check-permission-server'
import { slugifyCategory } from '@/lib/company-documents/slugify'

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/i, 'Cor inválida')
  .optional()
  .nullable()

const createSchema = z.object({
  label: z.string().trim().min(1, 'Nome obrigatório').max(80),
  icon: z.string().trim().max(40).optional().nullable(),
  color: hexColor,
  sort_order: z.number().int().optional(),
})

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
      .from('company_document_categories')
      .select('id, slug, label, icon, color, sort_order, is_system, is_active')
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data || [])
  } catch (err) {
    console.error('Erro ao listar categorias:', err)
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

    const canManage = await hasPermissionServer(supabase, user.id, 'settings')
    if (!canManage) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const label = parsed.data.label.trim()
    const slug = slugifyCategory(label)
    if (!slug) {
      return NextResponse.json(
        { error: 'Nome inválido — apenas letras, números e espaços.' },
        { status: 400 }
      )
    }

    // Auto sort_order = max(sort_order) + 10 if not supplied
    let sortOrder = parsed.data.sort_order
    if (typeof sortOrder !== 'number') {
      const { data: maxRow } = await supabase
        .from('company_document_categories')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle()
      sortOrder = (maxRow?.sort_order ?? 0) + 10
    }

    const insertPayload = {
      slug,
      label,
      icon: parsed.data.icon?.trim() || null,
      color: parsed.data.color || null,
      sort_order: sortOrder,
      is_system: false,
      is_active: true,
      created_by: user.id,
    }

    const { data, error } = await supabase
      .from('company_document_categories')
      .insert(insertPayload)
      .select()
      .single()

    if (error) {
      if (
        error.code === '23505' ||
        error.message.toLowerCase().includes('unique') ||
        error.message.toLowerCase().includes('duplicate')
      ) {
        return NextResponse.json(
          { error: 'Já existe uma categoria com esse nome' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await supabase.from('log_audit').insert({
      user_id: user.id,
      entity_type: 'company_document_category',
      entity_id: data.id,
      action: 'create',
      new_data: data,
    })

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('Erro ao criar categoria:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
