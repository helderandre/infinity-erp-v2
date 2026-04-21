import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/permissions"
import {
  TEMPLATE_CATEGORY_VALUES,
  normalizeCategory,
} from "@/lib/constants-template-categories"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = any

function isBroker(roles: string[]) {
  return roles.some((r) => ["admin", "Broker/CEO"].includes(r))
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

// GET /api/automacao/templates-wpp — Listar templates
export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)

    const search = searchParams.get("search")
    const category = searchParams.get("category")
    const active = searchParams.get("active")
    const scopeFilter = searchParams.get("scope")

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

    // Scope filter
    if (scopeFilter === "global") {
      query = query.eq("scope", "global")
    } else if (scopeFilter === "consultant") {
      if (isBroker(auth.roles)) {
        query = query.eq("scope", "consultant")
      } else {
        query = query.eq("scope", "consultant").eq("scope_id", auth.user.id)
      }
    } else if (!isBroker(auth.roles)) {
      query = query.or(
        `scope.eq.global,and(scope.eq.consultant,scope_id.eq.${auth.user.id})`,
      )
    }

    if (category && category !== "all") {
      if (category === "geral") {
        query = query.or("category.is.null,category.eq.geral")
      } else {
        query = query.eq("category", category)
      }
    }
    const categoriesCsv = searchParams.get("categories")
    if (categoriesCsv) {
      const list = categoriesCsv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
      if (list.includes("geral")) {
        const others = list.filter((c) => c !== "geral")
        if (others.length > 0) {
          query = query.or(
            `category.is.null,category.in.(${[...others, "geral"].join(",")})`,
          )
        } else {
          query = query.or("category.is.null,category.eq.geral")
        }
      } else if (list.length > 0) {
        query = query.in("category", list)
      }
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

// POST /api/automacao/templates-wpp — Criar template (global ou consultor)
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = createAdminClient()
    const body = await request.json()

    const { name, description, messages, category, tags, scope } = body as {
      name?: string
      description?: string
      messages?: unknown[]
      category?: string
      tags?: string[]
      scope?: string
    }

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

    if (category && category.trim().length === 0) {
      return NextResponse.json({ error: "Categoria não pode ser vazia" }, { status: 400 })
    }

    let scopeValue: "global" | "consultant" = "global"
    let scopeId: string | null = null
    if (scope === "consultant") {
      scopeValue = "consultant"
      scopeId = auth.user.id
    } else if (scope === "global") {
      if (!isBroker(auth.roles)) {
        return NextResponse.json(
          { error: "Apenas administradores podem criar templates globais" },
          { status: 403 },
        )
      }
    }

    const { data, error } = (await (supabase as SupabaseAny)
      .from("auto_wpp_templates")
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        messages,
        category: normalizeCategory(category),
        tags: tags || [],
        is_active: true,
        scope: scopeValue,
        scope_id: scopeId,
        created_by: auth.user.id,
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
