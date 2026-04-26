// @ts-nocheck
"use server"

import { createAdminClient } from "@/lib/supabase/admin"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DrillDownItem {
  id: string
  title: string
  subtitle?: string
  badge?: { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
  extra?: string
  href: string
  date?: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  pending_approval: "Pendente",
  active: "Ativo",
  sold: "Vendido",
  rented: "Arrendado",
  suspended: "Suspenso",
  cancelled: "Cancelado",
}

const STATUS_VARIANTS: Record<string, DrillDownItem["badge"]["variant"]> = {
  pending_approval: "outline",
  active: "default",
  sold: "secondary",
  rented: "secondary",
  suspended: "outline",
  cancelled: "destructive",
}

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  commission: "Comissão",
  bonus: "Bónus",
  deduction: "Dedução",
  adjustment: "Ajuste",
  payment: "Pagamento",
}

const TRANSACTION_STATUS_VARIANTS: Record<string, DrillDownItem["badge"]["variant"]> = {
  pending: "outline",
  approved: "default",
  paid: "secondary",
  cancelled: "destructive",
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  visit: "Visita",
  call: "Chamada",
  proposal: "Proposta",
  acquisition: "Angariação",
  deal_closed: "Negócio Fechado",
  meeting: "Reunião",
  follow_up: "Seguimento",
  cpcv: "CPCV",
  escritura: "Escritura",
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtCurrency = (value: number) =>
  new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value)

const fmtDate = (date: string) => new Date(date).toLocaleDateString("pt-PT")

const DEFAULT_LIMIT = 50

// ─── 1. Properties Drill-Down ────────────────────────────────────────────────

export async function getDrillDownProperties(filter: {
  status?: string | string[]
  consultant_id?: string
  created_after?: string
  created_before?: string
  business_status?: string
  limit?: number
}): Promise<{ items: DrillDownItem[]; error: string | null }> {
  try {
    const admin = createAdminClient()
    let query = admin
      .from("dev_properties")
      .select("id, title, city, zone, status, listing_price, created_at, consultant_id, dev_users!dev_properties_consultant_id_fkey(commercial_name)")
      .order("created_at", { ascending: false })
      .limit(filter.limit ?? DEFAULT_LIMIT)

    if (filter.status) {
      if (Array.isArray(filter.status)) {
        query = query.in("status", filter.status)
      } else {
        query = query.eq("status", filter.status)
      }
    }

    if (filter.consultant_id) {
      query = query.eq("consultant_id", filter.consultant_id)
    }

    if (filter.created_after) {
      query = query.gte("created_at", filter.created_after)
    }

    if (filter.created_before) {
      query = query.lte("created_at", filter.created_before)
    }

    if (filter.business_status) {
      query = query.eq("business_status", filter.business_status)
    }

    const { data, error } = await query

    if (error) return { items: [], error: error.message }

    const items: DrillDownItem[] = (data ?? []).map((p: any) => {
      const status = p.status ?? "pending_approval"
      const consultantName = p.dev_users?.commercial_name
      const locationParts = [p.city, p.zone].filter(Boolean)
      const subtitleParts = []
      if (consultantName) subtitleParts.push(consultantName)
      if (locationParts.length > 0) subtitleParts.push(locationParts.join(" · "))
      return {
        id: p.id,
        title: p.title || "Sem título",
        subtitle: subtitleParts.length > 0 ? subtitleParts.join(" — ") : undefined,
        badge: {
          label: STATUS_LABELS[status] ?? status,
          variant: STATUS_VARIANTS[status] ?? "outline",
        },
        extra: p.listing_price ? fmtCurrency(p.listing_price) : undefined,
        href: `/dashboard/imoveis/${p.slug || p.id}`,
        date: p.created_at ? fmtDate(p.created_at) : undefined,
      }
    })

    return { items, error: null }
  } catch (err: any) {
    return { items: [], error: err.message ?? "Erro ao carregar imóveis" }
  }
}

// ─── 2. Transactions Drill-Down ──────────────────────────────────────────────

export async function getDrillDownTransactions(filter: {
  status?: string
  consultant_id?: string
  type?: string
  date_from?: string
  date_to?: string
  limit?: number
}): Promise<{ items: DrillDownItem[]; error: string | null }> {
  try {
    const admin = createAdminClient()
    let query = (admin as any)
      .from("temp_financial_transactions")
      .select("id, consultant_id, description, transaction_type, transaction_date, status, deal_value, agency_commission_amount, consultant_commission_amount, created_at, consultant:dev_users!temp_financial_transactions_consultant_id_fkey(commercial_name), property:dev_properties!temp_financial_transactions_property_id_fkey(title, external_ref)")
      .order("created_at", { ascending: false })
      .limit(filter.limit ?? DEFAULT_LIMIT)

    if (filter.status) {
      query = query.eq("status", filter.status)
    }

    if (filter.consultant_id) {
      query = query.eq("consultant_id", filter.consultant_id)
    }

    if (filter.type) {
      query = query.eq("transaction_type", filter.type)
    }

    if (filter.date_from) {
      query = query.gte("created_at", filter.date_from)
    }

    if (filter.date_to) {
      query = query.lte("created_at", filter.date_to)
    }

    const { data, error } = await query

    if (error) return { items: [], error: error.message }

    const items: DrillDownItem[] = (data ?? []).map((t: any) => {
      const consultantName = t.consultant?.commercial_name
      const propertyTitle = t.property?.title
      const propertyRef = t.property?.external_ref
      const amount = t.consultant_commission_amount ?? t.agency_commission_amount ?? t.deal_value
      const subtitleParts = []
      if (consultantName) subtitleParts.push(consultantName)
      if (propertyRef || propertyTitle) subtitleParts.push([propertyRef, propertyTitle].filter(Boolean).join(' · '))
      return {
        id: t.id,
        title: t.description || (TRANSACTION_TYPE_LABELS[t.transaction_type] ?? t.transaction_type ?? "Transacção"),
        subtitle: subtitleParts.length > 0 ? subtitleParts.join(' — ') : undefined,
        badge: {
          label: t.status ?? "pending",
          variant: TRANSACTION_STATUS_VARIANTS[t.status] ?? "outline",
        },
        extra: amount != null ? fmtCurrency(amount) : undefined,
        href: "/dashboard/financeiro",
        date: t.transaction_date ? fmtDate(t.transaction_date) : t.created_at ? fmtDate(t.created_at) : undefined,
      }
    })

    return { items, error: null }
  } catch (err: any) {
    return { items: [], error: err.message ?? "Erro ao carregar transacções" }
  }
}

// ─── 3. Alerts Drill-Down ────────────────────────────────────────────────────

export async function getDrillDownAlerts(): Promise<{
  items: DrillDownItem[]
  error: string | null
}> {
  try {
    const admin = createAdminClient()
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // Consultants with no activity in the last 30 days
    const { data: consultants, error: cErr } = await admin
      .from("dev_users")
      .select("id, commercial_name")
      .eq("is_active", true)

    if (cErr) return { items: [], error: cErr.message }

    const { data: recentActivities, error: aErr } = await (admin as any)
      .from("temp_goal_activity_log")
      .select("consultant_id")
      .gte("created_at", thirtyDaysAgo)

    if (aErr) return { items: [], error: aErr.message }

    const activeConsultantIds = new Set(
      (recentActivities ?? []).map((a: any) => a.consultant_id)
    )

    const items: DrillDownItem[] = []

    // Inactive consultants alert
    for (const c of consultants ?? []) {
      if (!activeConsultantIds.has(c.id)) {
        items.push({
          id: `alert-inactive-${c.id}`,
          title: c.commercial_name || "Consultor",
          subtitle: "Sem actividade nos últimos 30 dias",
          badge: { label: "Inativo", variant: "destructive" },
          href: `/dashboard/consultores/${c.id}`,
        })
      }
    }

    // Properties pending approval for too long (> 7 days)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: pendingProps, error: pErr } = await admin
      .from("dev_properties")
      .select("id, title, created_at")
      .eq("status", "pending_approval")
      .lte("created_at", sevenDaysAgo)
      .order("created_at", { ascending: true })
      .limit(20)

    if (!pErr && pendingProps) {
      for (const p of pendingProps) {
        items.push({
          id: `alert-pending-${p.id}`,
          title: p.title || "Imóvel sem título",
          subtitle: "Pendente aprovação há mais de 7 dias",
          badge: { label: "Pendente", variant: "outline" },
          href: `/dashboard/imoveis/${p.slug || p.id}`,
          date: p.created_at ? fmtDate(p.created_at) : undefined,
        })
      }
    }

    return { items, error: null }
  } catch (err: any) {
    return { items: [], error: err.message ?? "Erro ao carregar alertas" }
  }
}

// ─── 4. Activities Drill-Down ────────────────────────────────────────────────

export async function getDrillDownActivities(
  consultant_id?: string,
  limit?: number
): Promise<{ items: DrillDownItem[]; error: string | null }> {
  try {
    const admin = createAdminClient()
    let query = (admin as any)
      .from("temp_goal_activity_log")
      .select("id, activity_type, consultant_id, consultant_name, revenue_amount, description, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? DEFAULT_LIMIT)

    if (consultant_id) {
      query = query.eq("consultant_id", consultant_id)
    }

    const { data, error } = await query

    if (error) return { items: [], error: error.message }

    const items: DrillDownItem[] = (data ?? []).map((a: any) => ({
      id: a.id,
      title: ACTIVITY_TYPE_LABELS[a.activity_type] ?? a.activity_type ?? "Actividade",
      subtitle: a.consultant_name || a.description || undefined,
      badge: {
        label: ACTIVITY_TYPE_LABELS[a.activity_type] ?? "Actividade",
        variant: "secondary" as const,
      },
      extra: a.revenue_amount ? fmtCurrency(a.revenue_amount) : undefined,
      href: consultant_id
        ? `/dashboard/consultores/${consultant_id}`
        : a.consultant_id
          ? `/dashboard/consultores/${a.consultant_id}`
          : "/dashboard",
      date: a.created_at ? fmtDate(a.created_at) : undefined,
    }))

    return { items, error: null }
  } catch (err: any) {
    return { items: [], error: err.message ?? "Erro ao carregar actividades" }
  }
}

// ─── 5. Upcoming Actions Drill-Down ──────────────────────────────────────────

export async function getDrillDownUpcomingActions(
  consultant_id?: string
): Promise<{ items: DrillDownItem[]; error: string | null }> {
  try {
    const admin = createAdminClient()
    const items: DrillDownItem[] = []
    const now = new Date().toISOString()
    const thirtyDaysFromNow = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString()

    // 1. Pending proc_tasks with upcoming due dates
    let tasksQuery = admin
      .from("proc_tasks")
      .select("id, title, status, due_date, assigned_to, proc_instance_id, proc_instances(property_id)")
      .in("status", ["pending", "in_progress"])
      .not("due_date", "is", null)
      .gte("due_date", now)
      .lte("due_date", thirtyDaysFromNow)
      .order("due_date", { ascending: true })
      .limit(25)

    if (consultant_id) {
      tasksQuery = tasksQuery.eq("assigned_to", consultant_id)
    }

    const { data: tasks, error: tErr } = await tasksQuery

    if (!tErr && tasks) {
      for (const t of tasks as any[]) {
        const propertyId = t.proc_instances?.property_id
        items.push({
          id: `task-${t.id}`,
          title: t.title || "Tarefa",
          subtitle: t.status === "in_progress" ? "Em progresso" : "Pendente",
          badge: {
            label: t.status === "in_progress" ? "Em Progresso" : "Pendente",
            variant: t.status === "in_progress" ? "default" : "outline",
          },
          href: propertyId
            ? `/dashboard/imoveis/${propertyId}`
            : "/dashboard/processos",
          date: t.due_date ? fmtDate(t.due_date) : undefined,
        })
      }
    }

    // 2. Contracts expiring within 30 days
    let contractsQuery = admin
      .from("dev_property_internal")
      .select("property_id, contract_expiry, dev_properties!inner(id, title, consultant_id)")
      .not("contract_expiry", "is", null)
      .gte("contract_expiry", now.slice(0, 10))
      .lte("contract_expiry", thirtyDaysFromNow.slice(0, 10))
      .order("contract_expiry", { ascending: true })
      .limit(25)

    if (consultant_id) {
      contractsQuery = contractsQuery.eq("dev_properties.consultant_id", consultant_id)
    }

    const { data: contracts, error: cErr } = await contractsQuery

    if (!cErr && contracts) {
      for (const c of contracts as any[]) {
        const prop = c.dev_properties
        items.push({
          id: `contract-${c.property_id}`,
          title: prop?.title || "Imóvel",
          subtitle: "Contrato a expirar",
          badge: { label: "Contrato", variant: "destructive" },
          href: `/dashboard/imoveis/${c.property_id}`,
          date: c.contract_expiry ? fmtDate(c.contract_expiry) : undefined,
        })
      }
    }

    // Sort all items by date ascending
    items.sort((a, b) => {
      if (!a.date || !b.date) return 0
      return new Date(a.date.split("/").reverse().join("-")).getTime() -
        new Date(b.date.split("/").reverse().join("-")).getTime()
    })

    return { items: items.slice(0, DEFAULT_LIMIT), error: null }
  } catch (err: any) {
    return { items: [], error: err.message ?? "Erro ao carregar acções futuras" }
  }
}

// ─── 6. Negocios Drill-Down ──────────────────────────────────────────────────

const PIPELINE_TYPE_LABEL: Record<string, string> = {
  comprador: "Comprador",
  arrendatario: "Arrendatário",
  vendedor: "Vendedor",
  arrendador: "Arrendador",
}

export async function getDrillDownNegocios(filter: {
  assigned_consultant_id?: string
  pipeline_types?: string[]
  not_terminal?: boolean
  terminal_type?: "won" | "lost"
  expected_close_from?: string
  expected_close_to?: string
  won_from?: string
  won_to?: string
  stage_names?: string[]
  min_probability_pct?: number
  limit?: number
}): Promise<{ items: DrillDownItem[]; error: string | null }> {
  try {
    const admin = createAdminClient()
    let query = (admin as any)
      .from("negocios")
      .select(`
        id, tipo, estado, expected_value, probability_pct, expected_close_date,
        won_date, lost_date, lead_id,
        leads!negocios_lead_id_fkey(nome),
        leads_pipeline_stages!negocios_pipeline_stage_id_fkey(name, pipeline_type, is_terminal, terminal_type, probability_pct)
      `)
      .order("expected_close_date", { ascending: true, nullsFirst: false })
      .limit(filter.limit ?? DEFAULT_LIMIT)

    if (filter.assigned_consultant_id) {
      query = query.eq("assigned_consultant_id", filter.assigned_consultant_id)
    }
    if (filter.expected_close_from) {
      query = query.gte("expected_close_date", filter.expected_close_from)
    }
    if (filter.expected_close_to) {
      query = query.lte("expected_close_date", filter.expected_close_to)
    }
    if (filter.won_from) {
      query = query.gte("won_date", filter.won_from)
    }
    if (filter.won_to) {
      query = query.lte("won_date", filter.won_to)
    }

    const { data, error } = await query

    if (error) return { items: [], error: error.message }

    const items: DrillDownItem[] = []
    for (const d of (data ?? []) as any[]) {
      const stage = d.leads_pipeline_stages
      const pipelineType: string | null = stage?.pipeline_type ?? null
      const stageName: string | null = stage?.name ?? null
      const isTerminal: boolean = !!stage?.is_terminal
      const terminalType: string | null = stage?.terminal_type ?? null
      const stageProb = (stage?.probability_pct ?? d.probability_pct ?? 0) / 100

      // Apply post-fetch filters (PostgREST doesn't support filtering joined cols easily here)
      if (filter.pipeline_types && filter.pipeline_types.length > 0) {
        if (!pipelineType || !filter.pipeline_types.includes(pipelineType)) continue
      }
      if (filter.not_terminal && isTerminal) continue
      if (filter.terminal_type && terminalType !== filter.terminal_type) continue
      if (filter.stage_names && filter.stage_names.length > 0) {
        if (!stageName || !filter.stage_names.includes(stageName.toLowerCase())) continue
      }
      if (typeof filter.min_probability_pct === "number") {
        if (stageProb * 100 < filter.min_probability_pct) continue
      }

      const subtitleParts: string[] = []
      if (d.leads?.nome) subtitleParts.push(d.leads.nome)
      if (pipelineType) subtitleParts.push(PIPELINE_TYPE_LABEL[pipelineType] ?? pipelineType)
      if (stageName) subtitleParts.push(stageName)

      items.push({
        id: d.id,
        title: d.tipo || stageName || "Negócio",
        subtitle: subtitleParts.length > 0 ? subtitleParts.join(" · ") : undefined,
        badge: stageName
          ? {
              label: stageName,
              variant: isTerminal && terminalType === "won" ? "secondary"
                : isTerminal && terminalType === "lost" ? "destructive"
                : "outline",
            }
          : undefined,
        extra: d.expected_value ? fmtCurrency(d.expected_value) : undefined,
        href: `/dashboard/crm/negocios/${d.id}`,
        date: d.won_date
          ? fmtDate(d.won_date)
          : d.expected_close_date
          ? fmtDate(d.expected_close_date)
          : undefined,
      })
    }

    return { items, error: null }
  } catch (err: any) {
    return { items: [], error: err.message ?? "Erro ao carregar negócios" }
  }
}
