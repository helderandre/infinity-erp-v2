import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const updateVariableSchema = z.object({
  key: z
    .string()
    .min(1)
    .regex(/^[a-z][a-z0-9_]*$/, 'Chave deve usar snake_case')
    .optional(),
  label: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  source_entity: z.enum(['property', 'owner', 'consultant', 'process', 'system']).optional(),
  source_table: z.string().nullable().optional(),
  source_column: z.string().nullable().optional(),
  format_type: z.enum(['text', 'currency', 'date', 'concat']).optional(),
  format_config: z.any().nullable().optional(),
  static_value: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
  order_index: z.number().int().optional(),
})

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/libraries/variables/[id]
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('tpl_variables')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Variável não encontrada' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao buscar variável:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * PUT /api/libraries/variables/[id]
 */
export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = updateVariableSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // If changing key, check for duplicates
    if (parsed.data.key) {
      const { data: existing } = await admin
        .from('tpl_variables')
        .select('id')
        .eq('key', parsed.data.key)
        .neq('id', id)
        .maybeSingle()

      if (existing) {
        return NextResponse.json(
          { error: `Já existe uma variável com a chave '${parsed.data.key}'` },
          { status: 409 }
        )
      }
    }

    const { data, error } = await admin
      .from('tpl_variables')
      .update(parsed.data as Record<string, unknown>)
      .eq('id', id)
      .select()
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Variável não encontrada' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar variável:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/libraries/variables/[id]
 * System variables (is_system=true) cannot be deleted — only deactivated.
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Check if system variable
    const { data: variable } = await admin
      .from('tpl_variables')
      .select('id, is_system')
      .eq('id', id)
      .single()

    if (!variable) {
      return NextResponse.json({ error: 'Variável não encontrada' }, { status: 404 })
    }

    if (variable.is_system) {
      return NextResponse.json(
        { error: 'Variáveis do sistema não podem ser eliminadas. Desactive-a em vez disso.' },
        { status: 403 }
      )
    }

    const { error } = await admin
      .from('tpl_variables')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao eliminar variável:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
