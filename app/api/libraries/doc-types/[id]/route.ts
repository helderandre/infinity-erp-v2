import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const docTypeUpdateSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').optional(),
  description: z.string().optional().nullable(),
  category: z.string().min(1, 'Categoria obrigatória').optional(),
  allowed_extensions: z.array(z.string()).optional(),
  default_validity_months: z.number().int().positive().optional().nullable(),
  is_system: z.boolean().optional(),
})

// PUT — actualizar tipo de documento
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = docTypeUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('doc_types')
      .update(parsed.data)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message.includes('unique') ? 400 : 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar tipo de documento:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE — eliminar tipo de documento (apenas não-sistema)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Verificar se é tipo de sistema
    const { data: docType } = await supabase
      .from('doc_types')
      .select('is_system')
      .eq('id', id)
      .single()

    if (docType?.is_system) {
      return NextResponse.json(
        { error: 'Não é possível eliminar um tipo de documento do sistema' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('doc_types')
      .delete()
      .eq('id', id)

    if (error) {
      if (error.message.includes('foreign key')) {
        return NextResponse.json(
          { error: 'Tipo de documento em uso — não pode ser eliminado' },
          { status: 400 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao eliminar tipo de documento:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
