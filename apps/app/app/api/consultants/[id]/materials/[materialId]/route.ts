import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// DELETE: remove a material from an agent
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; materialId: string }> }
) {
  try {
    const { id, materialId } = await params
    const supabase = await createClient() as any
    const admin = createAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Get the material record to find file path
    const { data: material, error: matError } = await admin
      .from('agent_materials')
      .select('file_path, thumbnail_path')
      .eq('id', materialId)
      .eq('agent_id', id)
      .single()

    if (matError || !material) {
      return NextResponse.json({ error: 'Material não encontrado' }, { status: 404 })
    }

    // Delete file from storage
    const pathsToDelete = [material.file_path]
    if (material.thumbnail_path && material.thumbnail_path !== material.file_path) {
      pathsToDelete.push(material.thumbnail_path)
    }

    await admin.storage.from('marketing-kit').remove(pathsToDelete)

    // Delete DB record
    const { error: deleteError } = await admin
      .from('agent_materials')
      .delete()
      .eq('id', materialId)
      .eq('agent_id', id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao eliminar material:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
