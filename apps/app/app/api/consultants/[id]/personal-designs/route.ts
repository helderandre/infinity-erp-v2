import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasPermissionServer } from '@/lib/auth/check-permission-server'
import { resolveActiveDesignCategory } from '@/lib/marketing/design-categories'
import { signUrls } from '@/lib/marketing/personal-designs-storage'

const createSchema = z.object({
  name: z.string().trim().min(1, 'Nome obrigatório').max(120),
  category: z.string().trim().min(1, 'Categoria obrigatória'),
  canva_url: z.string().url('URL inválido'),
  description: z.string().trim().max(2000).optional().nullable(),
  thumbnail_url: z.string().url().optional().nullable(),
})

async function ensureActorCanAccess(
  supabase: any,
  userId: string,
  agentId: string
): Promise<boolean> {
  if (userId === agentId) return true
  return hasPermissionServer(supabase, userId, 'settings')
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const supabase = (await createClient()) as any
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const allowed = await ensureActorCanAccess(supabase, user.id, agentId)
    if (!allowed) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const categorySlug = searchParams.get('category')

    const admin = createAdminClient() as any
    let query = admin
      .from('agent_personal_designs')
      .select(
        `id, agent_id, name, description, category_id, file_path, file_name,
         file_size, mime_type, thumbnail_path, canva_url, sort_order,
         created_at, updated_at,
         category:marketing_design_categories(id, slug, label, icon, color)`
      )
      .eq('agent_id', agentId)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (categorySlug && categorySlug !== 'all') {
      const resolved = await resolveActiveDesignCategory(admin, categorySlug)
      if (!resolved) {
        return NextResponse.json([])
      }
      query = query.eq('category_id', resolved.id)
    }

    const { data, error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const enriched = await Promise.all(
      (data || []).map(async (row: any) => {
        const { file_url, thumbnail_url } = await signUrls(
          row.file_path,
          row.thumbnail_path
        )
        return { ...row, file_url, thumbnail_url }
      })
    )

    return NextResponse.json(enriched)
  } catch (err) {
    console.error('Erro ao listar personal designs:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const supabase = (await createClient()) as any
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const allowed = await ensureActorCanAccess(supabase, user.id, agentId)
    if (!allowed) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const resolved = await resolveActiveDesignCategory(supabase, parsed.data.category)
    if (!resolved) {
      return NextResponse.json({ error: 'Categoria inválida' }, { status: 400 })
    }

    const admin = createAdminClient() as any
    const { data, error } = await admin
      .from('agent_personal_designs')
      .insert({
        agent_id: agentId,
        name: parsed.data.name.trim(),
        description: parsed.data.description?.trim() || null,
        category_id: resolved.id,
        canva_url: parsed.data.canva_url,
        // Note: thumbnail_url here is a full URL (link-only designs). We
        // don't store it as a bucket path. The UI falls back to placeholder
        // for link-only designs without uploaded thumbnails.
        // If future requirements demand storing it, change the schema.
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('Erro ao criar personal design:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
