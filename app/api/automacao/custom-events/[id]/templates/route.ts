import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/permissions"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SA = any

type Ctx = { params: Promise<{ id: string }> }

interface EmailTemplate {
  id: string
  name: string
  subject: string | null
  body_html: string | null
  category: string | null
  scope: string
  scope_id: string | null
  is_system: boolean
  is_active: boolean
}

interface WppTemplate {
  id: string
  name: string
  messages: unknown
  category: string | null
  scope: string
  scope_id: string | null
  is_system: boolean
  is_active: boolean
}

/**
 * GET /api/automacao/custom-events/[id]/templates
 *
 * Devolve, por canal, três grupos de templates:
 *  - default: template configurado no evento
 *  - used:    templates usados em overrides de leads deste evento
 *  - available: restantes templates acessíveis ao consultor
 *
 * Só o dono do evento vê esta informação.
 */
export async function GET(_request: Request, ctx: Ctx) {
  try {
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response
    const userId = auth.user.id
    const { id } = await ctx.params

    const supabase = createAdminClient() as SA

    // Event + ownership check
    const { data: evt, error: evtErr } = await supabase
      .from("custom_commemorative_events")
      .select("id, consultant_id, email_template_id, wpp_template_id")
      .eq("id", id)
      .maybeSingle()
    if (evtErr) return NextResponse.json({ error: evtErr.message }, { status: 500 })
    if (!evt) return NextResponse.json({ error: "Evento não encontrado" }, { status: 404 })
    if (evt.consultant_id !== auth.user.id) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 })
    }

    // Overrides por lead para este evento — template IDs usados
    const { data: overrideRows } = await supabase
      .from("contact_automation_lead_settings")
      .select("email_template_id, wpp_template_id")
      .eq("event_type", "custom_event")
      .eq("custom_event_id", id)

    const usedEmailIds = new Set<string>()
    const usedWppIds = new Set<string>()
    for (const r of (overrideRows as SA[] | null) ?? []) {
      if (r.email_template_id) usedEmailIds.add(r.email_template_id)
      if (r.wpp_template_id) usedWppIds.add(r.wpp_template_id)
    }

    // Default por canal = `consultant_template_defaults` (key: consultant + category=id + channel)
    // → fallback para `custom_commemorative_events.email_template_id/wpp_template_id`
    const { data: cdRows } = await supabase
      .from("consultant_template_defaults")
      .select("channel, template_id")
      .eq("consultant_id", auth.user.id)
      .eq("category", id)

    const defaultsByChannel: Record<string, string | null> = {}
    for (const r of (cdRows as SA[] | null) ?? []) {
      defaultsByChannel[r.channel] = r.template_id
    }

    // Filtro estrito: para um custom event, só os templates cuja categoria é o próprio
    // UUID do evento são considerados "relacionados". Excepções mantêm-se via
    // `isRelevantX`: o default (explícito OU cascata) e templates usados em overrides
    // de leads passam sempre, independentemente da categoria.
    const RELEVANT_CATEGORIES = [id]

    // Scope filter — inclui:
    //   - todos os templates global (system=true OU globais não-sistema criados pela equipa)
    //   - templates consultant scoped ao utilizador autenticado
    // Mesma lógica do `/api/automacao/templates-wpp?active=true` consumido pela
    // tab "Os meus templates" para manter paridade visual.
    const { data: emailTemplates } = await supabase
      .from("tpl_email_library")
      .select("id, name, subject, body_html, category, scope, scope_id, is_system, is_active")
      .eq("is_active", true)
      .or(`scope.eq.global,and(scope.eq.consultant,scope_id.eq.${auth.user.id})`)
      .order("is_system", { ascending: false })
      .order("name", { ascending: true })

    const { data: wppTemplates } = await supabase
      .from("auto_wpp_templates")
      .select("id, name, messages, category, scope, scope_id, is_system, is_active")
      .eq("is_active", true)
      .or(`scope.eq.global,and(scope.eq.consultant,scope_id.eq.${auth.user.id})`)
      .order("is_system", { ascending: false })
      .order("name", { ascending: true })

    const emailAllRaw: EmailTemplate[] = (emailTemplates as EmailTemplate[] | null) ?? []
    const wppAllRaw: WppTemplate[] = (wppTemplates as WppTemplate[] | null) ?? []

    // Cascata para apurar o template padrão — paridade com `my-templates-tab.tsx::isDefaultTpl`:
    //   1. Explícito em consultant_template_defaults (category=<event.id>, channel=<>)
    //   2. Coluna email_template_id/wpp_template_id no próprio evento
    //   3. Primeiro template com scope='consultant' e scope_id=<me> dentro desta categoria
    //   4. Primeiro template is_system=true dentro desta categoria
    //   5. Primeiro template qualquer dentro desta categoria
    function pickDefaultId(
      all: Array<{ id: string; category: string | null; scope: string; scope_id: string | null; is_system: boolean }>,
      explicit: string | null | undefined,
      columnFallback: string | null,
    ): string | null {
      if (explicit) return explicit
      if (columnFallback) return columnFallback
      const sameCategory = all.filter((t) => t.category === id)
      if (sameCategory.length === 0) return null
      const own = sameCategory.find((t) => t.scope === "consultant" && t.scope_id === userId)
      if (own) return own.id
      const system = sameCategory.find((t) => t.is_system)
      if (system) return system.id
      return sameCategory[0].id
    }

    const defaultEmailId = pickDefaultId(
      emailAllRaw,
      defaultsByChannel.email ?? null,
      (evt.email_template_id as string | null) ?? null,
    )
    const defaultWppId = pickDefaultId(
      wppAllRaw,
      defaultsByChannel.whatsapp ?? null,
      (evt.wpp_template_id as string | null) ?? null,
    )

    // Filtro por categoria relevante, MAS:
    //   - o default do evento é sempre mostrado (mesmo que categoria não bata — legado)
    //   - templates em 'used' (overrides de leads) são sempre mostrados
    // Templates sem categoria ou com categoria de outro evento / fixo / genérica são cortados.
    const isRelevantEmail = (tpl: EmailTemplate) => {
      if (tpl.id === defaultEmailId) return true
      if (usedEmailIds.has(tpl.id)) return true
      if (!tpl.category) return false
      return RELEVANT_CATEGORIES.includes(tpl.category)
    }
    const isRelevantWpp = (tpl: WppTemplate) => {
      if (tpl.id === defaultWppId) return true
      if (usedWppIds.has(tpl.id)) return true
      if (!tpl.category) return false
      return RELEVANT_CATEGORIES.includes(tpl.category)
    }

    const emailAll: EmailTemplate[] = emailAllRaw.filter(isRelevantEmail)
    const wppAll: WppTemplate[] = wppAllRaw.filter(isRelevantWpp)

    // Para evitar que o default seja escondido se vier duma categoria não-relevante,
    // permitimos findEmail/findWpp procurarem também no conjunto Raw (não filtrado).
    const findEmail = (tid: string | null) =>
      tid ? emailAll.find((t) => t.id === tid) ?? emailAllRaw.find((t) => t.id === tid) ?? null : null
    const findWpp = (tid: string | null) =>
      tid ? wppAll.find((t) => t.id === tid) ?? wppAllRaw.find((t) => t.id === tid) ?? null : null

    const emailDefault = findEmail(defaultEmailId)
    const wppDefault = findWpp(defaultWppId)

    const emailUsed = emailAll.filter(
      (t) => usedEmailIds.has(t.id) && t.id !== defaultEmailId,
    )
    const wppUsed = wppAll.filter(
      (t) => usedWppIds.has(t.id) && t.id !== defaultWppId,
    )

    const emailAvailable = emailAll.filter(
      (t) => t.id !== defaultEmailId && !usedEmailIds.has(t.id),
    )
    const wppAvailable = wppAll.filter(
      (t) => t.id !== defaultWppId && !usedWppIds.has(t.id),
    )

    return NextResponse.json(
      {
        email: {
          default: emailDefault,
          used: emailUsed,
          available: emailAvailable,
        },
        whatsapp: {
          default: wppDefault,
          used: wppUsed,
          available: wppAvailable,
        },
      },
      {
        headers: { "Cache-Control": "private, max-age=30" },
      },
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
