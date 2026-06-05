import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('roles')
      .select('id, name, description, permissions, created_at, updated_at')
      .order('name', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching roles:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    const { name, description, permissions } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { error: 'O nome da role é obrigatório' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('roles')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        permissions: permissions || {},
      })
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

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error creating role:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
