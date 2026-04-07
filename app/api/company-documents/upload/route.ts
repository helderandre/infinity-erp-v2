import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getR2Client, R2_BUCKET, R2_PUBLIC_DOMAIN } from '@/lib/r2/client'
import { sanitizeFileName } from '@/lib/r2/documents'

// POST: bulk upload company documents
export async function POST(request: Request) {
  try {
    const supabase = await createClient() as any
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const formData = await request.formData()
    const category = formData.get('category') as string
    const files = formData.getAll('files') as File[]
    const names = formData.getAll('names') as string[]

    if (!category) {
      return NextResponse.json({ error: 'Categoria é obrigatória' }, { status: 400 })
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'Nenhum ficheiro enviado' }, { status: 400 })
    }

    const s3 = getR2Client()
    const results = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const sanitized = sanitizeFileName(file.name)
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      const timestamp = Date.now()
      const key = `documentos-empresa/${category}/${timestamp}-${sanitized}`

      const bytes = await file.arrayBuffer()
      const buffer = new Uint8Array(bytes)

      await s3.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: file.type,
        })
      )

      const url = R2_PUBLIC_DOMAIN ? `${R2_PUBLIC_DOMAIN}/${key}` : key

      // Use custom name if provided, otherwise derive from filename
      const customName = names[i]?.trim()
      const displayName = customName || file.name
        .replace(/\.\w+$/, '')
        .replace(/[_-]/g, ' ')
        .replace(/^\d+\s*/, '') // remove leading numbers

      const { data, error } = await supabase
        .from('company_documents')
        .insert({
          name: displayName || file.name,
          category,
          file_path: url,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          file_extension: ext,
          uploaded_by: user.id,
        })
        .select()
        .single()

      if (error) {
        console.error('Erro ao inserir documento:', error)
        continue
      }

      results.push(data)
    }

    return NextResponse.json({
      uploaded: results.length,
      total: files.length,
      documents: results,
    }, { status: 201 })
  } catch (error) {
    console.error('Erro ao fazer upload de documentos:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
