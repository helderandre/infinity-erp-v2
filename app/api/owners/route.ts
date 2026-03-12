import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { ownerSchema } from '@/lib/validations/owner'
import { requirePermission } from '@/lib/auth/permissions'

const PAGE_SIZE = 20

export async function GET(request: Request) {
  try {
    const auth = await requirePermission('owners')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const nif = searchParams.get('nif')
    const email = searchParams.get('email')
    const personType = searchParams.get('person_type')
    const limit = Number(searchParams.get('limit')) || PAGE_SIZE
    const offset = Number(searchParams.get('offset')) || 0

    let query = supabase
      .from('owners')
      .select('*, property_owners(owner_id, dev_properties(status))', { count: 'exact' })
      .order('created_at', { ascending: false })

    // Search por NIF específico (exacto)
    if (nif) {
      query = query.eq('nif', nif)
    }
    // Search por email específico (exacto)
    else if (email) {
      query = query.eq('email', email)
    }
    // Search genérico por nome, NIF ou email
    else if (search) {
      query = query.or(
        `name.ilike.%${search}%,nif.ilike.%${search}%,email.ilike.%${search}%`
      )
    }

    if (personType && personType !== 'all') {
      query = query.eq('person_type', personType)
    }

    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Map property count
    const owners = (data || []).map((owner) => ({
      ...owner,
      properties_count: (owner.property_owners || []).filter(
        (po: any) =>
          po.dev_properties && po.dev_properties.status !== 'cancelled'
      ).length,
      property_owners: undefined,
    }))

    return NextResponse.json({ data: owners, total: count || 0 })
  } catch (error) {
    console.error('Erro ao listar owners:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requirePermission('owners')
    if (!auth.authorized) return auth.response

    const supabase = await createClient()

    // Parse e validação
    const body = await request.json()
    const validation = ownerSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const data = validation.data

    // Verificar se já existe owner com o mesmo NIF
    if (data.nif) {
      const { data: existing } = await supabase
        .from('owners')
        .select('id')
        .eq('nif', data.nif)
        .single()

      if (existing) {
        return NextResponse.json(
          { error: 'Já existe um proprietário com este NIF' },
          { status: 400 }
        )
      }
    }

    // Clean empty strings to null
    const cleanedData: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      cleanedData[key] = value === '' ? null : value
    }

    // Criar owner
    const { data: owner, error } = await supabase
      .from('owners')
      .insert(cleanedData as typeof data)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao criar proprietário', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(owner, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar owner:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
