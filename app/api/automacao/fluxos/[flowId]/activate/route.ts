import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

// POST /api/automacao/fluxos/[flowId]/activate — Ativar/desativar fluxo
export async function POST(
  request: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  try {
    const { flowId } = await params
    const body = await request.json()
    const supabase = createAdminClient() as SA

    if (body.active) {
      // Verificar que tem published_definition
      const { data: flow } = await supabase
        .from("auto_flows")
        .select("published_definition")
        .eq("id", flowId)
        .single()

      if (!flow?.published_definition) {
        return NextResponse.json(
          {
            error:
              "Impossivel activar: o fluxo ainda nao foi publicado. Clica em 'Publicar' primeiro.",
          },
          { status: 422 }
        )
      }
    }

    // Ativar/desativar flow
    await supabase
      .from("auto_flows")
      .update({ is_active: body.active, updated_at: new Date().toISOString() })
      .eq("id", flowId)

    // Ativar/desativar triggers
    await supabase
      .from("auto_triggers")
      .update({ active: body.active })
      .eq("flow_id", flowId)

    return NextResponse.json({ ok: true, is_active: body.active })
  } catch (err) {
    console.error("[fluxos/[flowId]/activate] POST error:", err)
    return NextResponse.json(
      { error: "Erro interno ao activar/desativar fluxo" },
      { status: 500 }
    )
  }
}
