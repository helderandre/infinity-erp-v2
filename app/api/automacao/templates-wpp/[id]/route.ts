import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/permissions"
import { TEMPLATE_CATEGORY_VALUES } from "@/lib/constants-template-categories"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any

function isBroker(roles: string[]) {
  return roles.some((r) => ["admin", "Broker/CEO"].includes(r))
}

async function assertCanMutate(
  supabase: SupabaseAny,
  auth: Awaited<ReturnType<typeof requireAuth>>,
  id: string,
): Promise<NextResponse | null> {
  if (!auth.authorized) return auth.response
  const { data: existing } = await (supabase as SupabaseAny)
    .from("auto_wpp_templates")
    .select("id, scope, scope_id, is_system")
    .eq("id", id)
    .maybeSingle()
  if (!existing) {
    return NextResponse.json({ error: "Template não encontrado" }, { status: 404 })
  }
  if (existing.is_system) {
    return NextResponse.json({ error: "Template de sistema não pode ser modificado" }, { status: 403 })
  }
  if (!isBroker(auth.roles)) {
    if (existing.scope === "global") {
      return NextResponse.json({ error: "Apenas administradores podem modificar templates globais" }, { status: 403 })
    }
    if (existing.scope === "consultant" && existing.scope_id !== auth.user.id) {
      return NextResponse.json({ error: "Template não é seu" }, { status: 403 })
    }
  }
  return null
}

interface DbTemplate {
  id: string
  name: string
  description: string | null
  category: string
  tags: string[]
  messages: SupabaseAny
  is_active: boolean
  created_by: string | null
  instance_id: string | null
  created_at: string
  updated_at: string
}

// GET /api/automacao/templates-wpp/[id] — Detalhe de um template
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createAdminClient()

    const { data, error } = (await (supabase as SupabaseAny)
      .from("auto_wpp_templates")
      .select("*")
      .eq("id", id)
      .single()) as { data: DbTemplate | null; error: SupabaseAny }

    if (error || !data) {
      return NextResponse.json(
        { error: "Template não encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json({ template: data })
  } catch (err) {
    console.error("[templates-wpp/[id]] GET error:", err)
    return NextResponse.json(
      { error: "Erro interno ao obter template" },
      { status: 500 }
    )
  }
}

// PUT /api/automacao/templates-wpp/[id] — Actualizar template
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response
    const supabase = createAdminClient()
    const guard = await assertCanMutate(supabase, auth, id)
    if (guard) return guard
    const body = await request.json()

    const updates: Record<string, SupabaseAny> = {}

    if (body.name !== undefined) updates.name = body.name.trim()
    if (body.description !== undefined)
      updates.description = body.description?.trim() || null
    if (body.messages !== undefined) updates.messages = body.messages
    if (body.category !== undefined) {
      if (body.category && !(TEMPLATE_CATEGORY_VALUES as readonly string[]).includes(body.category)) {
        return NextResponse.json(
          { error: `Categoria inválida. Permitidas: ${TEMPLATE_CATEGORY_VALUES.join(', ')}` },
          { status: 400 }
        )
      }
      updates.category = body.category || null
    }
    if (body.tags !== undefined) updates.tags = body.tags
    if (body.is_active !== undefined) updates.is_active = body.is_active

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Nenhum campo para actualizar" },
        { status: 400 }
      )
    }

    const { data, error } = (await (supabase as SupabaseAny)
      .from("auto_wpp_templates")
      .update(updates)
      .eq("id", id)
      .select()
      .single()) as { data: DbTemplate | null; error: SupabaseAny }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json(
        { error: "Template não encontrado" },
        { status: 404 }
      )
    }

    return NextResponse.json({ template: data })
  } catch (err) {
    console.error("[templates-wpp/[id]] PUT error:", err)
    return NextResponse.json(
      { error: "Erro interno ao actualizar template" },
      { status: 500 }
    )
  }
}

// DELETE /api/automacao/templates-wpp/[id] — Soft delete (is_active = false)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response
    const supabase = createAdminClient()
    const guard = await assertCanMutate(supabase, auth, id)
    if (guard) return guard

    const { error } = await (supabase as SupabaseAny)
      .from("auto_wpp_templates")
      .update({ is_active: false })
      .eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[templates-wpp/[id]] DELETE error:", err)
    return NextResponse.json(
      { error: "Erro interno ao eliminar template" },
      { status: 500 }
    )
  }
}
