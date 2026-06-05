import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermission } from '@/lib/auth/permissions'

const updateSchema = z.object({
  doc_type_id: z.string().uuid().nullable().optional(),
  valid_until: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  name: z.string().optional(),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { attachmentId } = await params
    const supabase = await createClient()
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('lead_attachments')
      .update(parsed.data)
      .eq('id', attachmentId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar anexo:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ attachmentId: string }> }
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { attachmentId } = await params
    const supabase = await createClient()

    const { error } = await supabase
      .from('lead_attachments')
      .delete()
      .eq('id', attachmentId)

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao eliminar anexo', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao eliminar anexo:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
