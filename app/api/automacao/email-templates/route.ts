import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
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

// GET /api/automacao/email-templates — listar templates
// Query params:
//   scope=global|consultant|all (default: all visíveis ao utilizador)
//   category=<valor>
//   active=true|false
export async function GET(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const serverClient = await createClient()
    const supabase = createAdminClient()
    const { searchParams } = new URL(request.url)

    const scopeFilter = searchParams.get("scope")
    const categoryFilter = searchParams.get("category")
    const activeFilter = searchParams.get("active")

    let query = (supabase as SupabaseAny)
      .from("tpl_email_library")
      .select("id, name, subject, description, category, scope, scope_id, is_active, is_system, created_at, updated_at")
      .order("name", { ascending: true })

    if (activeFilter === "true") query = query.eq("is_active", true)
    else if (activeFilter === "false") query = query.eq("is_active", false)

    if (categoryFilter && categoryFilter !== "all") {
      query = query.eq("category", categoryFilter)
    }

    // Scope filtering: by default a consultant sees globals + own; broker sees all
    if (scopeFilter === "global") {
      query = query.eq("scope", "global")
    } else if (scopeFilter === "consultant") {
      if (isBroker(auth.roles)) {
        query = query.eq("scope", "consultant")
      } else {
        query = query.eq("scope", "consultant").eq("scope_id", auth.user.id)
      }
    } else if (!isBroker(auth.roles)) {
      // visibility union: globals + own consultant templates
      query = query.or(
        `scope.eq.global,and(scope.eq.consultant,scope_id.eq.${auth.user.id})`,
      )
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // touch server client to ensure auth cookie cycle is initialised
    void serverClient
    return NextResponse.json({ templates: data || [] })
  } catch (err) {
    console.error("[email-templates] GET error:", err)
    return NextResponse.json({ error: "Erro interno ao listar templates de email" }, { status: 500 })
  }
}

// POST /api/automacao/email-templates — criar template (global ou consultor)
export async function POST(request: Request) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const supabase = createAdminClient()
    const body = await request.json()
    const {
      name,
      subject,
      body_html,
      description,
      category,
      scope,
      signature_mode,
    } = body as {
      name?: string
      subject?: string
      body_html?: string
      description?: string
      category?: string
      scope?: string
      signature_mode?: string
    }

    if (!name?.trim() || !subject?.trim() || !body_html?.trim()) {
      return NextResponse.json(
        { error: "Nome, assunto e corpo são obrigatórios" },
        { status: 400 },
      )
    }
    if (category && !(TEMPLATE_CATEGORY_VALUES as readonly string[]).includes(category)) {
      return NextResponse.json(
        { error: `Categoria inválida. Permitidas: ${TEMPLATE_CATEGORY_VALUES.join(", ")}` },
        { status: 400 },
      )
    }

    // Scope handling: client can ask for 'consultant' → we force scope_id to auth.user.id
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
      scopeValue = "global"
      scopeId = null
    }

    const insertRow = {
      name: name.trim(),
      subject: subject.trim(),
      body_html,
      description: description?.trim() || null,
      category: normalizeCategory(category),
      scope: scopeValue,
      scope_id: scopeId,
      is_active: true,
      is_system: false,
      signature_mode: signature_mode || "default",
      created_by: auth.user.id,
    }

    const { data, error } = await (supabase as SupabaseAny)
      .from("tpl_email_library")
      .insert(insertRow)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ template: data }, { status: 201 })
  } catch (err) {
    console.error("[email-templates] POST error:", err)
    return NextResponse.json({ error: "Erro interno ao criar template" }, { status: 500 })
  }
}
