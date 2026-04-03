import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

// POST: upload a material file for an agent
// Uses Supabase Storage bucket 'marketing-kit'
export async function POST(request: Request, { params }: { params: Promise<{ agentId: string }> }) {
  try {
    const { agentId } = await params
    const supabase = await createClient() as any
    const admin = createAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const templateId = formData.get('template_id') as string | null
    const pageIndex = parseInt(formData.get('page_index') as string || '1', 10)

    if (!file || !templateId) {
      return NextResponse.json({ error: 'Ficheiro e template_id são obrigatórios' }, { status: 400 })
    }

    // Validate template exists
    const { data: template, error: tplError } = await supabase
      .from('marketing_kit_templates')
      .select('id, name, category')
      .eq('id', templateId)
      .single()

    if (tplError || !template) {
      return NextResponse.json({ error: 'Template não encontrado' }, { status: 404 })
    }

    // Validate agent exists
    const { data: agent, error: agentError } = await supabase
      .from('dev_users')
      .select('id, commercial_name')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Consultor não encontrado' }, { status: 404 })
    }

    // Upload to Supabase Storage
    const ext = file.name.split('.').pop() || 'png'
    const timestamp = Date.now()
    const filePath = `${agentId}/${template.category}/${timestamp}-${template.name.replace(/[^a-zA-Z0-9]/g, '_')}-p${pageIndex}.${ext}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    const { error: uploadError } = await admin.storage
      .from('marketing-kit')
      .upload(filePath, buffer, {
        contentType: file.type || 'image/png',
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: 'Erro ao carregar ficheiro: ' + uploadError.message }, { status: 500 })
    }

    // Generate thumbnail path (same file for now, could generate a smaller version later)
    const thumbnailPath = filePath

    // Upsert agent_materials record (unique per agent+template+page)
    const { data: material, error: matError } = await admin
      .from('agent_materials')
      .upsert({
        agent_id: agentId,
        template_id: templateId,
        page_index: pageIndex,
        file_path: filePath,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type || 'image/png',
        thumbnail_path: thumbnailPath,
        uploaded_by: user.id,
      }, {
        onConflict: 'agent_id,template_id,page_index',
      })
      .select()
      .single()

    if (matError) {
      console.error('Material upsert error:', matError)
      return NextResponse.json({ error: 'Erro ao guardar registo: ' + matError.message }, { status: 500 })
    }

    return NextResponse.json(material, { status: 201 })
  } catch (error) {
    console.error('Erro ao fazer upload de material:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
