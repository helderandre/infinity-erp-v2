import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { updatePropertySchema } from '@/lib/validations/property'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('dev_properties')
      .select(
        `*,
        dev_property_specifications(*),
        dev_property_internal(*),
        dev_property_media(*),
        consultant:dev_users!consultant_id(id, commercial_name),
        property_owners(ownership_percentage, is_main_contact, owners(id, name, email, phone, nif))`
      )
      .eq('id', id)
      .order('order_index', { referencedTable: 'dev_property_media', ascending: true })
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Imóvel não encontrado' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao obter imóvel:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
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
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const { property, specifications, internal } = body

    // Update property data
    if (property && Object.keys(property).length > 0) {
      const validation = updatePropertySchema.safeParse(property)
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Dados inválidos', details: validation.error.flatten() },
          { status: 400 }
        )
      }

      const { error } = await supabase
        .from('dev_properties')
        .update(validation.data)
        .eq('id', id)

      if (error) {
        return NextResponse.json(
          { error: 'Erro ao actualizar imóvel', details: error.message },
          { status: 500 }
        )
      }
    }

    // Upsert specifications
    if (specifications && Object.keys(specifications).length > 0) {
      const { error } = await supabase
        .from('dev_property_specifications')
        .upsert({ property_id: id, ...specifications })

      if (error) {
        return NextResponse.json(
          { error: 'Erro ao actualizar especificações', details: error.message },
          { status: 500 }
        )
      }
    }

    // Upsert internal data
    if (internal && Object.keys(internal).length > 0) {
      const { error } = await supabase
        .from('dev_property_internal')
        .upsert({ property_id: id, ...internal })

      if (error) {
        return NextResponse.json(
          { error: 'Erro ao actualizar dados internos', details: error.message },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ id })
  } catch (error) {
    console.error('Erro ao actualizar imóvel:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
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
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Soft delete: set status to cancelled
    const { error } = await supabase
      .from('dev_properties')
      .update({ status: 'cancelled' })
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao eliminar imóvel', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao eliminar imóvel:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
