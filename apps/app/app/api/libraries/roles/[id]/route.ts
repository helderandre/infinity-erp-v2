import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    const { name, description, permissions } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'O nome da role é obrigatório' },
        { status: 400 }
      )
    }

    // Prevent editing admin role name
    const { data: existing } = await supabase
      .from('roles')
      .select('name')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: 'Role não encontrada' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {
      name: name.trim(),
      description: description?.trim() || null,
    }

    if (permissions !== undefined) {
      updateData.permissions = permissions
    }

    const { data, error } = await supabase
      .from('roles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Já existe uma role com este nome' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error updating role:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Check if role is in use
    const { count } = await supabase
      .from('dev_users')
      .select('id', { count: 'exact', head: true })
      .eq('role_id', id)

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Esta role está atribuída a ${count} utilizador(es). Remova a atribuição antes de eliminar.` },
        { status: 409 }
      )
    }

    const { error } = await supabase
      .from('roles')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting role:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
