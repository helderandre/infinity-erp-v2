import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any

interface DbFlow {
  id: string
  name: string
  description: string | null
  flow_definition: SupabaseAny
  is_active: boolean
  wpp_instance_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// GET /api/automacao/fluxos — Listar fluxos
export async function GET(request: Request) {
  try {
    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)

    const search = searchParams.get("search")
    const active = searchParams.get("active")

    let query = (supabase as SupabaseAny)
      .from("auto_flows")
      .select("*")
      .order("updated_at", { ascending: false })

    if (active === "false") {
      // mostrar todos
    } else if (active === "true") {
      query = query.eq("is_active", true)
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    const { data, error } = (await query) as {
      data: DbFlow[] | null
      error: SupabaseAny
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ flows: data || [] })
  } catch (err) {
    console.error("[fluxos] GET error:", err)
    return NextResponse.json(
      { error: "Erro interno ao listar fluxos" },
      { status: 500 }
    )
  }
}

// POST /api/automacao/fluxos — Criar fluxo
export async function POST(request: Request) {
  try {
    const supabase = createAdminClient()
    const body = await request.json()

    const { name } = body

    const { data, error } = (await (supabase as SupabaseAny)
      .from("auto_flows")
      .insert({
        name: name?.trim() || "Novo Fluxo",
        description: null,
        flow_definition: { version: 1, nodes: [], edges: [] },
        is_active: false,
        wpp_instance_id: null,
      })
      .select()
      .single()) as { data: DbFlow | null; error: SupabaseAny }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ flow: data }, { status: 201 })
  } catch (err) {
    console.error("[fluxos] POST error:", err)
    return NextResponse.json(
      { error: "Erro interno ao criar fluxo" },
      { status: 500 }
    )
  }
}
