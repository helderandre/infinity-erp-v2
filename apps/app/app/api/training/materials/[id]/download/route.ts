// @ts-nocheck
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAuth } from '@/lib/auth/permissions'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const { id: materialId } = await params
    const body = await request.json()
    const supabase = createAdminClient()

    // Buscar info do material
    const { data: material } = await supabase
      .from('forma_training_lesson_materials')
      .select('id, lesson_id, file_name, link_title, file_size_bytes, file_mime_type, material_type')
      .eq('id', materialId)
      .single()

    if (!material) {
      return NextResponse.json({ error: 'Material não encontrado' }, { status: 404 })
    }

    const materialName = material.file_name || material.link_title || 'Material sem nome'

    // Insert event (append-only)
    await supabase
      .from('forma_training_material_downloads')
      .insert({
        material_id: materialId,
        material_name: materialName,
        lesson_id: material.lesson_id,
        course_id: body.course_id,
        user_id: auth.user.id,
        file_size_bytes: material.file_size_bytes || null,
        file_type: material.file_mime_type || material.material_type,
      })

    return NextResponse.json({ tracked: true })
  } catch (error) {
    console.error('Erro ao registar download:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
