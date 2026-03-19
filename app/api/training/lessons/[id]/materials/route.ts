// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { uploadTrainingMaterial, ALLOWED_MATERIAL_EXTENSIONS, MAX_MATERIAL_SIZE } from '@/lib/r2/training'
import { createLessonMaterialSchema } from '@/lib/validations/training'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: lessonId } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('forma_training_lesson_materials')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('order_index')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Erro ao listar materiais:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    const { id: lessonId } = await params
    const supabase = await createClient()

    const formData = await request.formData()
    const materialType = formData.get('material_type') as string

    // Count existing materials for order_index
    const { count } = await supabase
      .from('forma_training_lesson_materials')
      .select('id', { count: 'exact', head: true })
      .eq('lesson_id', lessonId)

    const orderIndex = count || 0
    const description = (formData.get('description') as string) || null

    if (materialType === 'file') {
      const file = formData.get('file') as File
      if (!file) {
        return NextResponse.json({ error: 'Ficheiro é obrigatório' }, { status: 400 })
      }

      // Validate extension
      const extension = file.name.split('.').pop()?.toLowerCase()
      if (!extension || !ALLOWED_MATERIAL_EXTENSIONS.includes(extension as any)) {
        return NextResponse.json(
          { error: `Extensão não permitida. Extensões aceites: ${ALLOWED_MATERIAL_EXTENSIONS.join(', ')}` },
          { status: 400 }
        )
      }

      // Validate size
      if (file.size > MAX_MATERIAL_SIZE) {
        return NextResponse.json(
          { error: 'Ficheiro excede o tamanho máximo de 50MB' },
          { status: 400 }
        )
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      const { url } = await uploadTrainingMaterial(buffer, file.name, file.type, lessonId)

      const { data, error } = await supabase
        .from('forma_training_lesson_materials')
        .insert({
          lesson_id: lessonId,
          material_type: 'file',
          file_url: url,
          file_name: file.name,
          file_extension: extension,
          file_size_bytes: file.size,
          file_mime_type: file.type,
          description,
          order_index: orderIndex,
        })
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ data }, { status: 201 })
    }

    if (materialType === 'link') {
      const linkUrl = formData.get('link_url') as string
      const linkTitle = formData.get('link_title') as string

      const validation = createLessonMaterialSchema.safeParse({
        material_type: 'link',
        link_url: linkUrl,
        link_title: linkTitle,
        description: description || '',
      })

      if (!validation.success) {
        return NextResponse.json(
          { error: 'Dados inválidos', details: validation.error.flatten() },
          { status: 400 }
        )
      }

      const { data, error } = await supabase
        .from('forma_training_lesson_materials')
        .insert({
          lesson_id: lessonId,
          material_type: 'link',
          link_url: linkUrl,
          link_title: linkTitle,
          description,
          order_index: orderIndex,
        })
        .select()
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ data }, { status: 201 })
    }

    return NextResponse.json({ error: 'Tipo de material inválido' }, { status: 400 })
  } catch (error) {
    console.error('Erro ao criar material:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
