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

// GET /api/automacao/templates-wpp — Listar templates
export async function GET(request: Request) {
  try {
    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)

    const search = searchParams.get("search")
    const category = searchParams.get("category")
    const active = searchParams.get("active")

    let query = (supabase as SupabaseAny)
      .from("auto_wpp_templates")
      .select("*")
      .order("created_at", { ascending: false })

    // Filtro por active (default: apenas activos)
    if (active === "false") {
      // mostrar todos
    } else {
      query = query.eq("is_active", true)
    }

    if (category && category !== "all") {
      query = query.eq("category", category)
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
    }

    const { data, error } = (await query) as {
      data: DbTemplate[] | null
      error: SupabaseAny
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ templates: data || [] })
  } catch (err) {
    console.error("[templates-wpp] GET error:", err)
    return NextResponse.json(
      { error: "Erro interno ao listar templates" },
      { status: 500 }
    )
  }
}

// POST /api/automacao/templates-wpp — Criar template
export async function POST(request: Request) {
  try {
    const supabase = createAdminClient()
    const body = await request.json()

    const { name, description, messages, category, tags } = body

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Nome do template é obrigatório" },
        { status: 400 }
      )
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "O template deve ter pelo menos uma mensagem" },
        { status: 400 }
      )
    }

    const { data, error } = (await (supabase as SupabaseAny)
      .from("auto_wpp_templates")
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        messages,
        category: category || "outro",
        tags: tags || [],
        is_active: true,
      })
      .select()
      .single()) as { data: DbTemplate | null; error: SupabaseAny }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ template: data }, { status: 201 })
  } catch (err) {
    console.error("[templates-wpp] POST error:", err)
    return NextResponse.json(
      { error: "Erro interno ao criar template" },
      { status: 500 }
    )
  }
}
