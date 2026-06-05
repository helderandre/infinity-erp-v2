// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { uploadLessonPdf } from '@/lib/r2/training'

const MAX_PDF_SIZE = 50 * 1024 * 1024 // 50MB

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    const { id: lessonId } = await params
    const supabase = await createClient()

    // Verify lesson exists
    const { data: lesson, error: lessonError } = await supabase
      .from('forma_training_lessons')
      .select('id')
      .eq('id', lessonId)
      .single()

    if (lessonError || !lesson) {
      return NextResponse.json({ error: 'Lição não encontrada' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Ficheiro é obrigatório' }, { status: 400 })
    }

    const extension = file.name.split('.').pop()?.toLowerCase()
    if (extension !== 'pdf') {
      return NextResponse.json({ error: 'Apenas ficheiros PDF são permitidos' }, { status: 400 })
    }

    if (file.size > MAX_PDF_SIZE) {
      return NextResponse.json({ error: 'Ficheiro excede o tamanho máximo de 50MB' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const { url } = await uploadLessonPdf(buffer, file.name, lessonId)

    // Update lesson with the PDF URL
    const { error: updateError } = await supabase
      .from('forma_training_lessons')
      .update({ pdf_url: url })
      .eq('id', lessonId)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ url }, { status: 201 })
  } catch (error) {
    console.error('Erro ao fazer upload do PDF:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
