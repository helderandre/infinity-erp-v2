import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { ownerSchema } from '@/lib/validations/owner'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const nif = searchParams.get('nif')
    const email = searchParams.get('email')

    let query = supabase
      .from('owners')
      .select('*')
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

    const { data, error } = await query.limit(20)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
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

    // Criar owner
    const { data: owner, error } = await supabase
      .from('owners')
      .insert(data)
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
