import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// GET: list all materials for a consultant (grouped by template, with multiple pages)
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient() as any

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Get all active templates
    const { data: templates, error: tplError } = await supabase
      .from('marketing_kit_templates')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })

    if (tplError) return NextResponse.json({ error: tplError.message }, { status: 500 })

    // Get agent's materials (ordered by page_index)
    const { data: materials, error: matError } = await supabase
      .from('agent_materials')
      .select(`
        *,
        uploaded_by_user:dev_users!agent_materials_uploaded_by_fkey(commercial_name)
      `)
      .eq('agent_id', id)
      .order('page_index', { ascending: true })

    if (matError) return NextResponse.json({ error: matError.message }, { status: 500 })

    // Generate signed URLs for files
    const admin = createAdminClient()
    const materialsWithUrls = await Promise.all(
      (materials || []).map(async (m: any) => {
        const { data: urlData } = await admin.storage
          .from('marketing-kit')
          .createSignedUrl(m.file_path, 3600) // 1 hour

        const { data: thumbData } = m.thumbnail_path
          ? await admin.storage.from('marketing-kit').createSignedUrl(m.thumbnail_path, 3600)
          : { data: null }

        return {
          ...m,
          file_url: urlData?.signedUrl || null,
          thumbnail_url: thumbData?.signedUrl || urlData?.signedUrl || null,
        }
      })
    )

    // Group materials by template_id (array of pages per template)
    const materialMap: Record<string, any[]> = {}
    for (const m of materialsWithUrls) {
      if (!materialMap[m.template_id]) materialMap[m.template_id] = []
      materialMap[m.template_id].push(m)
    }

    // Combine: each template with its pages (array, possibly empty)
    const result = (templates || []).map((t: any) => ({
      template: t,
      pages: materialMap[t.id] || [],
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('Erro ao listar materiais do consultor:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
