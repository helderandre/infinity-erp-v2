import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getR2Client, R2_BUCKET, R2_PUBLIC_DOMAIN } from '@/lib/r2/client'

// PUT: update document metadata
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient() as any
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const updates: Record<string, any> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.description !== undefined) updates.description = body.description
    if (body.category !== undefined) updates.category = body.category
    if (body.sort_order !== undefined) updates.sort_order = body.sort_order

    const { data, error } = await supabase
      .from('company_documents')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Erro ao actualizar documento:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

// DELETE: remove document (file from R2 + DB record)
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient() as any
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Get file path to delete from R2
    const { data: doc } = await supabase
      .from('company_documents')
      .select('file_path')
      .eq('id', id)
      .single()

    if (doc?.file_path) {
      try {
        const domain = R2_PUBLIC_DOMAIN || ''
        const key = doc.file_path.replace(`${domain}/`, '')
        if (key) {
          const s3 = getR2Client()
          await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }))
        }
      } catch {
        // Silent fail on R2 deletion
      }
    }

    const { error } = await supabase
      .from('company_documents')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao eliminar documento:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
