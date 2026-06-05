// @ts-nocheck
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth/permissions'
import { deleteTrainingMaterial } from '@/lib/r2/training'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; materialId: string }> }
) {
  try {
    const auth = await requirePermission('training')
    if (!auth.authorized) return auth.response

    const { id: lessonId, materialId } = await params
    const supabase = await createClient()

    // Fetch material to get file_url for R2 cleanup
    const { data: material, error: fetchError } = await supabase
      .from('forma_training_lesson_materials')
      .select('*')
      .eq('id', materialId)
      .eq('lesson_id', lessonId)
      .single()

    if (fetchError || !material) {
      return NextResponse.json({ error: 'Material não encontrado' }, { status: 404 })
    }

    // Delete from R2 if it's a file
    if (material.material_type === 'file' && material.file_url) {
      try {
        await deleteTrainingMaterial(material.file_url)
      } catch (r2Error) {
        console.error('Erro ao eliminar ficheiro do R2:', r2Error)
      }
    }

    // Delete from DB
    const { error } = await supabase
      .from('forma_training_lesson_materials')
      .delete()
      .eq('id', materialId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Material eliminado com sucesso' })
  } catch (error) {
    console.error('Erro ao eliminar material:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
