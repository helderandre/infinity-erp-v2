import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { ownerSchema } from '@/lib/validations/owner'
import { requirePermission } from '@/lib/auth/permissions'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('owners')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const { data: owner, error } = await supabase
      .from('owners')
      .select(`
        *,
        property_owners(
          ownership_percentage,
          is_main_contact,
          dev_properties(
            id,
            title,
            slug,
            status,
            listing_price,
            city,
            property_type,
            business_type
          )
        )
      `)
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Proprietário não encontrado' },
          { status: 404 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Filtrar imóveis cancelados
    const filtered = {
      ...owner,
      property_owners: (owner.property_owners || []).filter(
        (po: any) =>
          po.dev_properties && po.dev_properties.status !== 'cancelled'
      ),
    }

    return NextResponse.json(filtered)
  } catch (error) {
    console.error('Erro ao obter owner:', error)
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
    const auth = await requirePermission('owners')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    const body = await request.json()
    const validation = ownerSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: validation.error.flatten() },
        { status: 400 }
      )
    }

    const data = validation.data

    // Verificar NIF duplicado (excluindo o próprio)
    if (data.nif) {
      const { data: existing } = await supabase
        .from('owners')
        .select('id')
        .eq('nif', data.nif)
        .neq('id', id)
        .single()

      if (existing) {
        return NextResponse.json(
          { error: 'Já existe outro proprietário com este NIF' },
          { status: 400 }
        )
      }
    }

    // Clean empty strings to null
    const cleanedData: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data)) {
      cleanedData[key] = value === '' ? null : value
    }

    const { data: owner, error } = await supabase
      .from('owners')
      .update(cleanedData as typeof data)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Proprietário não encontrado' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: 'Erro ao actualizar proprietário', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(owner)
  } catch (error) {
    console.error('Erro ao actualizar owner:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('owners')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const supabase = await createClient()

    // Verificar se tem imóveis activos associados (ignorar cancelados/deleted)
    const { data: activeLinks } = await supabase
      .from('property_owners')
      .select('property_id, dev_properties!inner(status)')
      .eq('owner_id', id)
      .not('dev_properties.status', 'in', '("cancelled","deleted")')

    const activeCount = activeLinks?.length || 0

    if (activeCount > 0) {
      return NextResponse.json(
        {
          error: `Não é possível eliminar. Este proprietário está associado a ${activeCount} imóvel(eis) activo(s). Elimine ou cancele os imóveis primeiro.`,
        },
        { status: 400 }
      )
    }

    // Cascade-delete todas as referências ao proprietário
    // 1. doc_registry (documentos associados ao owner)
    const { error: docError } = await supabase
      .from('doc_registry')
      .delete()
      .eq('owner_id' as any, id)

    if (docError) {
      console.error('Erro ao eliminar doc_registry do owner:', docError)
      return NextResponse.json(
        { error: 'Erro ao eliminar documentos do proprietário', details: docError.message },
        { status: 500 }
      )
    }

    // 2. proc_subtasks (subtarefas associadas ao owner)
    const { error: subtasksError } = await supabase
      .from('proc_subtasks' as any)
      .delete()
      .eq('owner_id', id)

    if (subtasksError) {
      console.error('Erro ao eliminar proc_subtasks do owner:', subtasksError)
      return NextResponse.json(
        { error: 'Erro ao eliminar subtarefas do proprietário', details: subtasksError.message },
        { status: 500 }
      )
    }

    // 3. proc_tasks (tarefas associadas ao owner)
    const { error: tasksError } = await supabase
      .from('proc_tasks')
      .delete()
      .eq('owner_id' as any, id)

    if (tasksError) {
      console.error('Erro ao eliminar proc_tasks do owner:', tasksError)
      return NextResponse.json(
        { error: 'Erro ao eliminar tarefas do proprietário', details: tasksError.message },
        { status: 500 }
      )
    }

    // 4. owner_beneficiaries
    const { error: beneficiariesError } = await supabase
      .from('owner_beneficiaries' as any)
      .delete()
      .eq('owner_id', id)

    if (beneficiariesError) {
      console.error('Erro ao eliminar owner_beneficiaries:', beneficiariesError)
      return NextResponse.json(
        { error: 'Erro ao eliminar beneficiários do proprietário', details: beneficiariesError.message },
        { status: 500 }
      )
    }

    // 5. property_owners (ligações a imóveis)
    const { error: poError } = await supabase
      .from('property_owners')
      .delete()
      .eq('owner_id', id)

    if (poError) {
      console.error('Erro ao eliminar property_owners:', poError)
      return NextResponse.json(
        { error: 'Erro ao eliminar ligações a imóveis', details: poError.message },
        { status: 500 }
      )
    }

    // 6. Finalmente, eliminar o proprietário
    const { error } = await supabase
      .from('owners')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao eliminar proprietário', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao eliminar owner:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
