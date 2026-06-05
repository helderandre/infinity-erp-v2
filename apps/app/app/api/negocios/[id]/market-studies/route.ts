import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/auth/permissions'
import { uploadDocumentToR2 } from '@/lib/r2/documents'

const SELECT = `
  *,
  creator:dev_users!created_by(id, commercial_name)
`

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { id } = await params
    const admin = createAdminClient() as any

    const { data, error } = await admin
      .from('negocio_market_studies')
      .select(SELECT)
      .eq('negocio_id', id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data || [] })
  } catch (err) {
    console.error('[market-studies GET]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requirePermission('leads')
    if (!auth.authorized) return auth.response

    const { id: negocioId } = await params
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const notes = (formData.get('notes') as string | null) || null

    if (!file) {
      return NextResponse.json({ error: 'Ficheiro em falta' }, { status: 400 })
    }

    // Limites: PDF/imagem até 30MB
    if (file.size > 30 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Ficheiro maior que 30MB' },
        { status: 413 },
      )
    }

    const buf = Buffer.from(await file.arrayBuffer())
    const { url } = await uploadDocumentToR2(
      buf,
      file.name,
      file.type || 'application/octet-stream',
      { type: 'negocio', negocioId, docTypeSlug: 'estudos-mercado' },
    )

    const admin = createAdminClient() as any
    const { data, error } = await admin
      .from('negocio_market_studies')
      .insert({
        negocio_id: negocioId,
        file_url: url,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || null,
        notes,
        created_by: auth.user.id,
      })
      .select(SELECT)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[market-studies POST]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
