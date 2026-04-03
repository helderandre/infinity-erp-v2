import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET: list agents with their kit completion status
// Returns all active agents with how many materials they have vs total templates
export async function GET(request: Request) {
  try {
    const supabase = await createClient() as any
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const filter = searchParams.get('filter') // 'incomplete' | 'complete' | 'all'
    const search = searchParams.get('search')

    // Get total active templates count
    const { count: totalTemplates } = await supabase
      .from('marketing_kit_templates')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    // Get all active agents (consultores) with their profiles
    let agentsQuery = supabase
      .from('dev_users')
      .select(`
        id,
        commercial_name,
        professional_email,
        is_active,
        created_at,
        dev_consultant_profiles(
          profile_photo_url,
          profile_photo_nobg_url,
          phone_commercial,
          instagram_handle,
          linkedin_url
        ),
        user_roles!user_roles_user_id_fkey(role_id, roles(id, name))
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (search) {
      agentsQuery = agentsQuery.ilike('commercial_name', `%${search}%`)
    }

    const { data: agents, error: agentsError } = await agentsQuery
    if (agentsError) return NextResponse.json({ error: agentsError.message }, { status: 500 })

    // Get all agent materials in one query
    const { data: allMaterials, error: materialsError } = await supabase
      .from('agent_materials')
      .select('agent_id, template_id')

    if (materialsError) return NextResponse.json({ error: materialsError.message }, { status: 500 })

    // Build a map: agentId → count of distinct templates with materials
    const materialCountMap: Record<string, Set<string>> = {}
    for (const m of allMaterials || []) {
      if (!materialCountMap[m.agent_id]) materialCountMap[m.agent_id] = new Set()
      materialCountMap[m.agent_id].add(m.template_id)
    }

    // Combine
    const result = (agents || []).map((agent: any) => ({
      id: agent.id,
      commercial_name: agent.commercial_name,
      professional_email: agent.professional_email,
      role: agent.user_roles?.[0]?.roles?.name || '',
      profile_photo_url: agent.dev_consultant_profiles?.profile_photo_url || null,
      profile_photo_nobg_url: agent.dev_consultant_profiles?.profile_photo_nobg_url || null,
      phone_commercial: agent.dev_consultant_profiles?.phone_commercial || null,
      instagram_handle: agent.dev_consultant_profiles?.instagram_handle || null,
      linkedin_url: agent.dev_consultant_profiles?.linkedin_url || null,
      created_at: agent.created_at,
      materials_count: materialCountMap[agent.id]?.size || 0,
      total_templates: totalTemplates || 0,
      is_complete: totalTemplates ? (materialCountMap[agent.id]?.size || 0) >= totalTemplates : false,
    }))

    // Apply filter
    let filtered = result
    if (filter === 'incomplete') {
      filtered = result.filter((a: any) => !a.is_complete)
    } else if (filter === 'complete') {
      filtered = result.filter((a: any) => a.is_complete)
    }

    return NextResponse.json({
      agents: filtered,
      total_templates: totalTemplates || 0,
    })
  } catch (error) {
    console.error('Erro ao listar kit queue:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
