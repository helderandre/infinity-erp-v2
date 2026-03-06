import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any

interface DbFlow {
  id: string
  name: string
  description: string | null
  draft_definition: SupabaseAny
  published_definition: SupabaseAny | null
  published_at: string | null
  published_triggers: SupabaseAny | null
  is_active: boolean
  wpp_instance_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// GET /api/automacao/fluxos/[flowId] — Detalhe do fluxo
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const { flowId } = await params
    const supabase = createAdminClient()

    const { data: flow, error: flowError } = (await (supabase as SupabaseAny)
      .from("auto_flows")
      .select("*")
      .eq("id", flowId)
      .single()) as { data: DbFlow | null; error: SupabaseAny }

    if (flowError || !flow) {
      return NextResponse.json(
        { error: "Fluxo não encontrado" },
        { status: 404 }
      )
    }

    const { data: triggers } = (await (supabase as SupabaseAny)
      .from("auto_triggers")
      .select("*")
      .eq("flow_id", flowId)) as { data: SupabaseAny[] | null; error: SupabaseAny }

    // Calculate has_unpublished_changes
    const hasUnpublishedChanges =
      !flow.published_definition ||
      JSON.stringify(flow.draft_definition) !== JSON.stringify(flow.published_definition)

    return NextResponse.json({
      flow: {
        ...flow,
        has_unpublished_changes: hasUnpublishedChanges,
      },
      triggers: triggers || [],
    })
  } catch (err) {
    console.error("[fluxos/[flowId]] GET error:", err)
    return NextResponse.json(
      { error: "Erro interno ao obter fluxo" },
      { status: 500 }
    )
  }
}

// PUT /api/automacao/fluxos/[flowId] — Auto-save (so draft)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const { flowId } = await params
    const supabase = createAdminClient()
    const body = await request.json()

    const updates: Record<string, SupabaseAny> = {}

    if (body.name !== undefined) updates.name = body.name.trim()
    if (body.description !== undefined)
      updates.description = body.description?.trim() || null
    if (body.draft_definition !== undefined)
      updates.draft_definition = body.draft_definition
    if (body.wpp_instance_id !== undefined)
      updates.wpp_instance_id = body.wpp_instance_id || null

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Nenhum campo para actualizar" },
        { status: 400 }
      )
    }

    updates.updated_at = new Date().toISOString()
    const { error } = await (supabase as SupabaseAny)
      .from("auto_flows")
      .update(updates)
      .eq("id", flowId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Fetch updated flow
    const { data: flow } = (await (supabase as SupabaseAny)
      .from("auto_flows")
      .select("*")
      .eq("id", flowId)
      .single()) as { data: DbFlow | null; error: SupabaseAny }

    return NextResponse.json({ flow })
  } catch (err) {
    console.error("[fluxos/[flowId]] PUT error:", err)
    return NextResponse.json(
      { error: "Erro interno ao actualizar fluxo" },
      { status: 500 }
    )
  }
}

// DELETE /api/automacao/fluxos/[flowId] — Eliminar fluxo
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const { flowId } = await params
    const supabase = createAdminClient()

    // Delete triggers first
    await (supabase as SupabaseAny)
      .from("auto_triggers")
      .delete()
      .eq("flow_id", flowId)

    // Delete the flow
    const { error } = await (supabase as SupabaseAny)
      .from("auto_flows")
      .delete()
      .eq("id", flowId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[fluxos/[flowId]] DELETE error:", err)
    return NextResponse.json(
      { error: "Erro interno ao eliminar fluxo" },
      { status: 500 }
    )
  }
}
