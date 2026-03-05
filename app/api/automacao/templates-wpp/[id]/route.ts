import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any

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
    const supabase = createAdminClient()
    const body = await request.json()

    const updates: Record<string, SupabaseAny> = {}

    if (body.name !== undefined) updates.name = body.name.trim()
    if (body.description !== undefined)
      updates.description = body.description?.trim() || null
    if (body.messages !== undefined) updates.messages = body.messages
    if (body.category !== undefined) updates.category = body.category
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
    const supabase = createAdminClient()

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
