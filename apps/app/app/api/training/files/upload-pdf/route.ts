// @ts-nocheck
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { uploadTrainingPdf, MAX_PDF_SIZE } from '@/lib/r2/training'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Lesson-agnostic PDF upload. Lets the course builder upload a PDF before the
 * lesson row exists (new-lesson flow), returning the public R2 URL which the
 * client then saves on the lesson. Mirrors `/lessons/[id]/upload-pdf` but
 * without requiring an existing lesson.
 */
export async function POST(request: Request) {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Ficheiro é obrigatório' }, { status: 400 })
    }

    const extension = file.name.split('.').pop()?.toLowerCase()
    if (extension !== 'pdf') {
      return NextResponse.json(
        { error: 'Apenas ficheiros PDF são permitidos' },
        { status: 400 }
      )
    }

    if (file.size > MAX_PDF_SIZE) {
      return NextResponse.json(
        { error: 'Ficheiro excede o tamanho máximo de 50MB' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const { url } = await uploadTrainingPdf(buffer, file.name)

    return NextResponse.json({ url }, { status: 201 })
  } catch (error) {
    console.error('Erro ao fazer upload do PDF:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
