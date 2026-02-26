import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const createVariableSchema = z.object({
  key: z
    .string()
    .min(1, 'Chave obrigatória')
    .regex(/^[a-z][a-z0-9_]*$/, 'Chave deve usar snake_case (ex: proprietario_nome)'),
  label: z.string().min(1, 'Label obrigatória'),
  category: z.string().min(1, 'Categoria obrigatória'),
  source_entity: z.enum(['property', 'owner', 'consultant', 'process', 'system']),
  source_table: z.string().nullable().optional(),
  source_column: z.string().nullable().optional(),
  format_type: z.enum(['text', 'currency', 'date', 'concat']).default('text'),
  format_config: z.any().nullable().optional(),
  static_value: z.string().nullable().optional(),
  order_index: z.number().int().optional(),
})

/**
 * GET /api/libraries/variables
 * Lists all template variables, optionally filtered by category or source_entity.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const source_entity = searchParams.get('source_entity')
    const active_only = searchParams.get('active_only') !== 'false'

    let query = supabase
      .from('tpl_variables')
      .select('*')
      .order('order_index', { ascending: true })

    if (active_only) {
      query = query.eq('is_active', true)
    }
    if (category) {
      query = query.eq('category', category)
    }
    if (source_entity) {
      query = query.eq('source_entity', source_entity)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao listar variáveis:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

/**
 * POST /api/libraries/variables
 * Creates a new template variable.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createVariableSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // Check for duplicate key
    const { data: existing } = await admin
      .from('tpl_variables')
      .select('id')
      .eq('key', parsed.data.key)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: `Já existe uma variável com a chave '${parsed.data.key}'` },
        { status: 409 }
      )
    }

    const { data, error } = await admin
      .from('tpl_variables')
      .insert({
        key: parsed.data.key,
        label: parsed.data.label,
        category: parsed.data.category,
        source_entity: parsed.data.source_entity,
        source_table: parsed.data.source_table || null,
        source_column: parsed.data.source_column || null,
        format_type: parsed.data.format_type,
        format_config: (parsed.data.format_config || null) as import('@/types/database').Json,
        static_value: parsed.data.static_value || null,
        is_system: false,
        order_index: parsed.data.order_index ?? 100,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar variável:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
