import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasPermissionServer } from '@/lib/auth/check-permission-server'
import { resolveActiveDesignCategory } from '@/lib/marketing/design-categories'
import { removeFromBucket, signUrls } from '@/lib/marketing/personal-designs-storage'

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    category: z.string().trim().min(1).optional(),
    canva_url: z.string().url().nullable().optional(),
    sort_order: z.number().int().optional(),
  })
  .strict()

async function ensureActorCanAccess(
  supabase: any,
  userId: string,
  agentId: string
): Promise<boolean> {
  if (userId === agentId) return true
  return hasPermissionServer(supabase, userId, 'settings')
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; designId: string }> }
) {
  try {
    const { id: agentId, designId } = await params
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
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const updates: Record<string, any> = {}
    if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim()
    if (parsed.data.description !== undefined) {
      updates.description = parsed.data.description?.trim() || null
    }
    if (parsed.data.canva_url !== undefined) updates.canva_url = parsed.data.canva_url
    if (parsed.data.sort_order !== undefined) updates.sort_order = parsed.data.sort_order

    if (parsed.data.category !== undefined) {
      const resolved = await resolveActiveDesignCategory(supabase, parsed.data.category)
      if (!resolved) {
        return NextResponse.json({ error: 'Categoria inválida' }, { status: 400 })
      }
      updates.category_id = resolved.id
    }

    const admin = createAdminClient() as any
    const { data: existing, error: fetchError } = await admin
      .from('agent_personal_designs')
      .select('*')
      .eq('id', designId)
      .eq('agent_id', agentId)
      .maybeSingle()

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Design não encontrado' }, { status: 404 })
    }

    if (Object.keys(updates).length === 0) {
      const signed = await signUrls(existing.file_path, existing.thumbnail_path)
      return NextResponse.json({ ...existing, ...signed })
    }

    const { data, error } = await admin
      .from('agent_personal_designs')
      .update(updates)
      .eq('id', designId)
      .eq('agent_id', agentId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const signed = await signUrls(data.file_path, data.thumbnail_path)
    return NextResponse.json({ ...data, ...signed })
  } catch (err) {
    console.error('Erro ao actualizar personal design:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; designId: string }> }
) {
  try {
    const { id: agentId, designId } = await params
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

    const admin = createAdminClient() as any
    const { data: existing, error: fetchError } = await admin
      .from('agent_personal_designs')
      .select('id, file_path, thumbnail_path')
      .eq('id', designId)
      .eq('agent_id', agentId)
      .maybeSingle()

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Design não encontrado' }, { status: 404 })
    }

    const pathsToRemove: string[] = []
    if (existing.file_path) pathsToRemove.push(existing.file_path)
    if (
      existing.thumbnail_path &&
      existing.thumbnail_path !== existing.file_path
    ) {
      pathsToRemove.push(existing.thumbnail_path)
    }

    if (pathsToRemove.length > 0) {
      await removeFromBucket(pathsToRemove)
    }

    const { error: deleteError } = await admin
      .from('agent_personal_designs')
      .delete()
      .eq('id', designId)
      .eq('agent_id', agentId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Erro ao eliminar personal design:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
