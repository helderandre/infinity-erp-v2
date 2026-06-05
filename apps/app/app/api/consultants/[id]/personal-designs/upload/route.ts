import { NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasPermissionServer } from '@/lib/auth/check-permission-server'
import { resolveActiveDesignCategory } from '@/lib/marketing/design-categories'
import {
  ALLOWED_MIME,
  IMAGE_MIME,
  THUMBNAIL_MAX_SIZE,
  sizeErrorForMime,
  sizeLimitForMime,
  signUrls,
  uploadToBucket,
  removeFromBucket,
} from '@/lib/marketing/personal-designs-storage'

async function ensureActorCanAccess(
  supabase: any,
  userId: string,
  agentId: string
): Promise<boolean> {
  if (userId === agentId) return true
  return hasPermissionServer(supabase, userId, 'settings')
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

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const thumbnail = formData.get('thumbnail') as File | null
    const nameRaw = formData.get('name')
    const categoryRaw = formData.get('category')
    const descriptionRaw = formData.get('description')
    const canvaUrlRaw = formData.get('canva_url')

    if (!file) {
      return NextResponse.json({ error: 'Ficheiro obrigatório' }, { status: 400 })
    }
    if (!nameRaw || typeof nameRaw !== 'string' || !nameRaw.trim()) {
      return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
    }
    if (!categoryRaw || typeof categoryRaw !== 'string') {
      return NextResponse.json({ error: 'Categoria obrigatória' }, { status: 400 })
    }

    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de ficheiro não permitido (aceita PNG, JPG, WebP, PDF)' },
        { status: 400 }
      )
    }

    const limit = sizeLimitForMime(file.type)
    if (limit === null || file.size > limit) {
      return NextResponse.json({ error: sizeErrorForMime(file.type) }, { status: 413 })
    }

    if (thumbnail) {
      if (!IMAGE_MIME.includes(thumbnail.type)) {
        return NextResponse.json(
          { error: 'Imagem de capa deve ser PNG, JPG ou WebP' },
          { status: 400 }
        )
      }
      if (thumbnail.size > THUMBNAIL_MAX_SIZE) {
        return NextResponse.json(
          { error: 'Imagem de capa demasiado grande (máx. 10MB)' },
          { status: 413 }
        )
      }
    }

    const resolved = await resolveActiveDesignCategory(supabase, categoryRaw)
    if (!resolved) {
      return NextResponse.json({ error: 'Categoria inválida' }, { status: 400 })
    }

    const uploaded = await uploadToBucket(agentId, file)
    let thumbnailPath: string | null = null
    if (thumbnail) {
      try {
        const uploadedThumb = await uploadToBucket(agentId, thumbnail)
        thumbnailPath = uploadedThumb.path
      } catch (err) {
        // If thumbnail fails, rollback main file so we don't orphan storage
        await removeFromBucket([uploaded.path])
        throw err
      }
    } else if (IMAGE_MIME.includes(file.type)) {
      // Use the image itself as thumbnail if no separate one was given
      thumbnailPath = uploaded.path
    }

    const admin = createAdminClient() as any
    const { data, error } = await admin
      .from('agent_personal_designs')
      .insert({
        agent_id: agentId,
        name: nameRaw.trim(),
        description:
          descriptionRaw && typeof descriptionRaw === 'string'
            ? descriptionRaw.trim() || null
            : null,
        category_id: resolved.id,
        file_path: uploaded.path,
        file_name: uploaded.originalName,
        file_size: uploaded.size,
        mime_type: uploaded.mime,
        thumbnail_path: thumbnailPath,
        canva_url:
          canvaUrlRaw && typeof canvaUrlRaw === 'string' && canvaUrlRaw.trim()
            ? canvaUrlRaw.trim()
            : null,
      })
      .select()
      .single()

    if (error) {
      // Rollback storage on DB failure
      const toRemove = [uploaded.path]
      if (thumbnailPath && thumbnailPath !== uploaded.path) toRemove.push(thumbnailPath)
      await removeFromBucket(toRemove)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const signed = await signUrls(data.file_path, data.thumbnail_path)

    return NextResponse.json({ ...data, ...signed }, { status: 201 })
  } catch (err: any) {
    console.error('Erro ao carregar personal design:', err)
    return NextResponse.json(
      { error: err?.message || 'Erro interno' },
      { status: 500 }
    )
  }
}
