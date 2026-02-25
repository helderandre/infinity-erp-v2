import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const docTemplateCreateSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  description: z.string().optional().nullable(),
  content_html: z.string().min(1, 'Conteúdo obrigatório'),
  doc_type_id: z.string().optional().nullable(),
  letterhead_url: z.string().optional().nullable(),
  letterhead_file_name: z.string().optional().nullable(),
  letterhead_file_type: z.string().optional().nullable(),
})

// GET — listar templates de documentos
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    let query = supabase
      .from('tpl_doc_library')
      .select('*, doc_types:doc_type_id(id, name, category)')
      .order('updated_at', { ascending: false })

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao listar templates de documentos:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// POST — criar template de documento
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const parsed = docTemplateCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('tpl_doc_library')
      .insert(parsed.data)
      .select('*, doc_types:doc_type_id(id, name, category)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar template de documento:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
