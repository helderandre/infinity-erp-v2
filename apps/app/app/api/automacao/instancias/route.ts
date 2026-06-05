import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth/permissions"
import { WHATSAPP_ADMIN_ROLES } from "@/lib/auth/roles"
import { deleteImageFromR2 } from "@/lib/r2/images"
import { pLimit } from "@/lib/concurrency"

// Nota: As tabelas auto_* foram criadas na Fase 1 mas os tipos TS (database.ts)
// ainda não foram regenerados. Usamos casts explícitos até à regeneração.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = ReturnType<typeof createAdminClient> & { from: (table: string) => any }

interface DbInstance {
  id: string
  name: string
  uazapi_token: string
  uazapi_instance_id: string | null
  status: string
  connection_status: string
  phone: string | null
  profile_name: string | null
  profile_pic_url: string | null
  is_business: boolean
  user_id: string | null
  created_at: string
  updated_at: string
  user?: { id: string; commercial_name: string } | null
}

const UAZAPI_URL = (process.env.UAZAPI_URL ?? "").replace(/\/$/, "")
const UAZAPI_ADMIN_TOKEN = process.env.UAZAPI_ADMIN_TOKEN ?? ""

// ── Helpers ──

async function fetchUazapi(
  path: string,
  options: { method?: string; token?: string; adminToken?: boolean; body?: unknown } = {}
) {
  const { method = "GET", token, adminToken = false, body } = options
  const headers: Record<string, string> = { "Content-Type": "application/json" }

  if (adminToken) {
    headers.admintoken = UAZAPI_ADMIN_TOKEN
  } else if (token) {
    headers.token = token
  }

  const res = await fetch(`${UAZAPI_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    return { ok: false as const, status: res.status, error: text }
  }

  const data = await res.json().catch(() => ({}))
  return { ok: true as const, data }
}

async function fetchUazapiStatus(token: string) {
  const result = await fetchUazapi("/instance/status", { token })
  if (!result.ok) return null
  return result.data as {
    instance?: {
      status?: string
      profileName?: string
      profilePicUrl?: string
      isBusiness?: boolean
      qrcode?: string
      paircode?: string
      owner?: string
    }
    status?: { connected?: boolean; loggedIn?: boolean; jid?: { user?: string } }
  }
}

function deriveConnectionStatus(statusData: Awaited<ReturnType<typeof fetchUazapiStatus>>): string {
  if (!statusData) return "disconnected"
  const connected = statusData.status?.connected
  const loggedIn = statusData.status?.loggedIn
  if (connected && loggedIn) return "connected"
  if (connected || loggedIn) return "connecting"
  return "disconnected"
}

function extractPhone(statusData: Awaited<ReturnType<typeof fetchUazapiStatus>>): string | null {
  // Priority 1: status.jid.user (clean, digits only)
  const jidUser = statusData?.status?.jid?.user
  if (jidUser && /^\d{9,}$/.test(jidUser)) {
    return `+${jidUser}`
  }
  // Priority 2: instance.owner (format: "5511999999999@s.whatsapp.net")
  const owner = statusData?.instance?.owner
  if (owner) {
    const ownerNumber = owner.split("@")[0]
    if (ownerNumber && /^\d{9,}$/.test(ownerNumber)) {
      return `+${ownerNumber}`
    }
  }
  return null
}

// ── Webhook Registration ──

async function registerWebhook(supabase: SupabaseAny, token: string, instanceId: string) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!SUPABASE_URL) return

  const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-webhook-receiver`

  try {
    await fetchUazapi("/webhook", {
      method: "POST",
      token,
      body: {
        enabled: true,
        url: webhookUrl,
        events: [
          "messages", "messages_update", "connection",
          "contacts", "presence", "labels", "chats",
        ],
      },
    })

    await (supabase as any)
      .from("auto_wpp_instances")
      .update({
        webhook_url: webhookUrl,
        webhook_registered_at: new Date().toISOString(),
      })
      .eq("id", instanceId)

    console.log(`[webhook] Registered for instance ${instanceId}`)
  } catch (e) {
    console.error(`[webhook] Registration failed for ${instanceId}:`, e)
  }
}

// ── GET: Listar instâncias ──

export async function GET(request: Request) {
  try {
    // ── Auth + role check ──
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const isAdmin = auth.roles.some((r) =>
      WHATSAPP_ADMIN_ROLES.some((a) => a.toLowerCase() === r.toLowerCase())
    )

    const supabase = createAdminClient() as SupabaseAny
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (id) {
      // Detalhe de uma instância + fluxos + execuções recentes
      let detailQuery = supabase
        .from("auto_wpp_instances")
        .select("*, user:dev_users(id, commercial_name)")
        .eq("id", id)

      // Non-admin: only own instances
      if (!isAdmin) {
        detailQuery = detailQuery.eq("user_id", auth.user.id)
      }

      const { data: instance, error } = await detailQuery.single()

      if (error || !instance) {
        return NextResponse.json({ error: "Instância não encontrada" }, { status: 404 })
      }

      const { data: flows } = await supabase
        .from("auto_flows")
        .select("id, name, status")
        .eq("wpp_instance_id", id)

      const { data: executions } = await supabase
        .from("auto_step_runs")
        .select("id, step_type, status, started_at, finished_at")
        .eq("step_type", "whatsapp")
        .order("started_at", { ascending: false })
        .limit(50)

      return NextResponse.json({
        instance,
        flows: flows ?? [],
        executions: executions ?? [],
        isAdmin,
      })
    }

    // Lista de instâncias com flow_count
    let listQuery = supabase
      .from("auto_wpp_instances")
      .select("*, user:dev_users(id, commercial_name)")
      .order("created_at", { ascending: false })

    // Non-admin: only own instances
    if (!isAdmin) {
      listQuery = listQuery.eq("user_id", auth.user.id)
    }

    const { data: instances, error } = await listQuery

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Count flows per instance
    const { data: flowCounts } = await supabase
      .from("auto_flows")
      .select("wpp_instance_id")
      .not("wpp_instance_id", "is", null)

    const countMap: Record<string, number> = {}
    for (const f of flowCounts ?? []) {
      if (f.wpp_instance_id) {
        countMap[f.wpp_instance_id] = (countMap[f.wpp_instance_id] || 0) + 1
      }
    }

    const enriched = ((instances ?? []) as DbInstance[]).map((inst: DbInstance) => ({
      ...inst,
      flow_count: countMap[inst.id] || 0,
    }))

    return NextResponse.json({ instances: enriched, isAdmin })
  } catch (error) {
    console.error("Erro ao carregar instâncias:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// ── POST: Acções ──

/** Actions that require admin role */
const ADMIN_ONLY_ACTIONS = new Set(["sync", "assign_user"])

/** Actions that non-admin users can perform on their own instances */
const USER_ACTIONS = new Set(["connect", "disconnect", "status", "rename", "delete"])

export async function POST(request: Request) {
  try {
    // ── Auth + role check ──
    const auth = await requireAuth()
    if (!auth.authorized) return auth.response

    const isAdmin = auth.roles.some((r) =>
      WHATSAPP_ADMIN_ROLES.some((a) => a.toLowerCase() === r.toLowerCase())
    )

    const supabase = createAdminClient() as SupabaseAny
    const body = await request.json()
    const { action, ...params } = body

    // Gate admin-only actions
    if (ADMIN_ONLY_ACTIONS.has(action) && !isAdmin) {
      return NextResponse.json(
        { error: "Sem permissão para esta acção" },
        { status: 403 }
      )
    }

    // Non-admin creating an instance: always scope to self.
    if (action === "create" && !isAdmin) {
      params.user_id = auth.user.id
    }

    // For user-level actions, verify ownership (non-admin only)
    if (USER_ACTIONS.has(action) && !isAdmin && params.instance_id) {
      const { data: inst } = await supabase
        .from("auto_wpp_instances")
        .select("user_id")
        .eq("id", params.instance_id)
        .single()

      if (!inst || inst.user_id !== auth.user.id) {
        return NextResponse.json(
          { error: "Sem permissão para esta instância" },
          { status: 403 }
        )
      }
    }

    switch (action) {
      case "sync":
        return await handleSync(supabase)
      case "create":
        return await handleCreate(supabase, params)
      case "connect":
        return await handleConnect(supabase, params)
      case "disconnect":
        return await handleDisconnect(supabase, params)
      case "status":
        return await handleStatus(supabase, params)
      case "assign_user":
        return await handleAssignUser(supabase, params)
      case "delete":
        return await handleDelete(supabase, params)
      case "rename":
        return await handleRename(supabase, params)
      default:
        return NextResponse.json({ error: "Acção inválida" }, { status: 400 })
    }
  } catch (error) {
    console.error("Erro na acção de instância:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// ── Action Handlers ──

async function handleSync(supabase: SupabaseAny) {
  // 1. Buscar todas as instâncias da Uazapi
  const allResult = await fetchUazapi("/instance/all", { adminToken: true })
  if (!allResult.ok) {
    return NextResponse.json(
      { error: "Erro ao comunicar com Uazapi", details: allResult.error },
      { status: 502 }
    )
  }

  const uazapiInstances = Array.isArray(allResult.data) ? allResult.data : []

  // 2. Buscar instâncias do banco
  const { data: dbInstances } = await supabase
    .from("auto_wpp_instances")
    .select("*")

  const dbMap = new Map<string, DbInstance>(
    ((dbInstances ?? []) as DbInstance[]).map((i: DbInstance) => [i.uazapi_token, i])
  )
  const uazapiTokens = new Set<string>()

  // 3. Para cada instância Uazapi, sincronizar
  for (const uazInst of uazapiInstances) {
    const token = uazInst.token || uazInst.id
    if (!token) continue
    uazapiTokens.add(token)

    // Buscar status detalhado
    const statusData = await fetchUazapiStatus(token)
    const connectionStatus = deriveConnectionStatus(statusData)
    const phone = extractPhone(statusData)
    const profileName = statusData?.instance?.profileName ?? null
    const profilePicUrl = statusData?.instance?.profilePicUrl ?? null
    const isBusiness = statusData?.instance?.isBusiness ?? false

    const existing = dbMap.get(token)

    if (existing) {
      // Update
      await supabase
        .from("auto_wpp_instances")
        .update({
          connection_status: connectionStatus,
          phone,
          profile_name: profileName,
          profile_pic_url: profilePicUrl,
          is_business: isBusiness,
          uazapi_instance_id: uazInst.id ?? existing.uazapi_instance_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)

      // Registar webhook se instância está conectada
      if (connectionStatus === "connected" && token) {
        await registerWebhook(supabase, token, existing.id)
      }
    } else {
      // Insert nova instância
      await supabase.from("auto_wpp_instances").insert({
        name: uazInst.name || `Instância ${uazInst.id}`,
        uazapi_token: token,
        uazapi_instance_id: uazInst.id ?? null,
        connection_status: connectionStatus,
        phone,
        profile_name: profileName,
        profile_pic_url: profilePicUrl,
        is_business: isBusiness,
      })
    }
  }

  // 4. Marcar instâncias no banco que não existem na Uazapi
  for (const [dbToken, dbInst] of dbMap) {
    if (!uazapiTokens.has(dbToken) && dbInst.connection_status !== "not_found") {
      await supabase
        .from("auto_wpp_instances")
        .update({
          connection_status: "not_found",
          updated_at: new Date().toISOString(),
        })
        .eq("id", dbInst.id)
    }
  }

  // 5. Retornar lista actualizada com flow_count
  const { data: updatedInstances } = await supabase
    .from("auto_wpp_instances")
    .select("*, user:dev_users(id, commercial_name)")
    .order("created_at", { ascending: false })

  const { data: flowCounts } = await supabase
    .from("auto_flows")
    .select("wpp_instance_id")
    .not("wpp_instance_id", "is", null)

  const countMap: Record<string, number> = {}
  for (const f of flowCounts ?? []) {
    if (f.wpp_instance_id) {
      countMap[f.wpp_instance_id] = (countMap[f.wpp_instance_id] || 0) + 1
    }
  }

  const enriched = ((updatedInstances ?? []) as DbInstance[]).map((inst: DbInstance) => ({
    ...inst,
    flow_count: countMap[inst.id] || 0,
  }))

  return NextResponse.json({ instances: enriched, synced: uazapiInstances.length })
}

async function handleCreate(
  supabase: SupabaseAny,
  params: { name?: string; user_id?: string }
) {
  const { name, user_id } = params
  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
  }

  // 1. Criar instância na Uazapi
  const initResult = await fetchUazapi("/instance/init", {
    method: "POST",
    adminToken: true,
    body: { name: name.trim() },
  })

  if (!initResult.ok) {
    return NextResponse.json(
      { error: "Erro ao criar instância na Uazapi", details: initResult.error },
      { status: 502 }
    )
  }

  const uazData = initResult.data as { token?: string; id?: string; instance?: { token?: string; id?: string } }
  const token = uazData.token || uazData.instance?.token
  const instanceId = uazData.id || uazData.instance?.id

  if (!token) {
    return NextResponse.json(
      { error: "Uazapi não retornou token para a instância" },
      { status: 502 }
    )
  }

  // 2. Salvar no banco
  const { data: instance, error } = await supabase
    .from("auto_wpp_instances")
    .insert({
      name: name.trim(),
      uazapi_token: token,
      uazapi_instance_id: instanceId ?? null,
      user_id: user_id || null,
      connection_status: "disconnected",
    })
    .select("*")
    .single()

  if (error) {
    return NextResponse.json({ error: "Erro ao guardar instância", details: error.message }, { status: 500 })
  }

  // 3. Auto-rebind orphaned flows/automations created by the same user.
  // Only triggers when the new instance has an assigned user (user_id is set)
  // — otherwise we'd risk rebinding someone else's orphans.
  let reboundFlowsCount = 0
  let reboundAutomationsCount = 0
  if (instance?.user_id) {
    const nowIso = new Date().toISOString()

    const { data: reboundFlows } = await supabase
      .from("auto_flows")
      .update({ wpp_instance_id: instance.id, updated_at: nowIso })
      .is("wpp_instance_id", null)
      .eq("created_by", instance.user_id)
      .select("id")
    reboundFlowsCount = reboundFlows?.length ?? 0

    const { data: reboundAutomations } = await supabase
      .from("contact_automations")
      .update({ wpp_instance_id: instance.id, updated_at: nowIso })
      .is("wpp_instance_id", null)
      .eq("created_by", instance.user_id)
      .select("id")
    reboundAutomationsCount = reboundAutomations?.length ?? 0
  }

  return NextResponse.json(
    { instance, reboundFlowsCount, reboundAutomationsCount },
    { status: 201 }
  )
}

async function handleConnect(
  supabase: SupabaseAny,
  params: { instance_id?: string; phone?: string }
) {
  const { instance_id, phone } = params
  if (!instance_id) {
    return NextResponse.json({ error: "instance_id é obrigatório" }, { status: 400 })
  }

  // Buscar instância
  const { data: instance } = await supabase
    .from("auto_wpp_instances")
    .select("*")
    .eq("id", instance_id)
    .single()

  if (!instance) {
    return NextResponse.json({ error: "Instância não encontrada" }, { status: 404 })
  }

  // Conectar via Uazapi
  const connectBody: Record<string, unknown> = {}
  if (phone) connectBody.phone = phone

  const connectResult = await fetchUazapi("/instance/connect", {
    method: "POST",
    token: instance.uazapi_token,
    body: connectBody,
  })

  if (!connectResult.ok) {
    return NextResponse.json(
      { error: "Erro ao conectar instância", details: connectResult.error },
      { status: 502 }
    )
  }

  const connectData = connectResult.data as {
    qrcode?: string
    paircode?: string
    connected?: boolean
    loggedIn?: boolean
    instance?: { qrcode?: string; paircode?: string }
  }

  // Actualizar status
  await supabase
    .from("auto_wpp_instances")
    .update({
      connection_status: "connecting",
      updated_at: new Date().toISOString(),
    })
    .eq("id", instance_id)

  // Registar webhook para receber mensagens
  await registerWebhook(supabase, instance.uazapi_token, instance_id)

  const qrcode = connectData.qrcode || connectData.instance?.qrcode
  const paircode = connectData.paircode || connectData.instance?.paircode

  if (phone && paircode) {
    return NextResponse.json({
      instance_id,
      mode: "paircode",
      paircode,
      connected: connectData.connected ?? false,
      logged_in: connectData.loggedIn ?? false,
    })
  }

  return NextResponse.json({
    instance_id,
    mode: "qrcode",
    qrcode: qrcode ?? null,
    connected: connectData.connected ?? false,
    logged_in: connectData.loggedIn ?? false,
  })
}

async function handleDisconnect(
  supabase: SupabaseAny,
  params: { instance_id?: string }
) {
  const { instance_id } = params
  if (!instance_id) {
    return NextResponse.json({ error: "instance_id é obrigatório" }, { status: 400 })
  }

  const { data: instance } = await supabase
    .from("auto_wpp_instances")
    .select("uazapi_token")
    .eq("id", instance_id)
    .single()

  if (!instance) {
    return NextResponse.json({ error: "Instância não encontrada" }, { status: 404 })
  }

  await fetchUazapi("/instance/disconnect", {
    method: "POST",
    token: instance.uazapi_token,
  })

  await supabase
    .from("auto_wpp_instances")
    .update({
      connection_status: "disconnected",
      phone: null,
      profile_name: null,
      profile_pic_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", instance_id)

  return NextResponse.json({ success: true })
}

async function handleStatus(
  supabase: SupabaseAny,
  params: { instance_id?: string }
) {
  const { instance_id } = params
  if (!instance_id) {
    return NextResponse.json({ error: "instance_id é obrigatório" }, { status: 400 })
  }

  const { data: instance } = await supabase
    .from("auto_wpp_instances")
    .select("uazapi_token")
    .eq("id", instance_id)
    .single()

  if (!instance) {
    return NextResponse.json({ error: "Instância não encontrada" }, { status: 404 })
  }

  const statusData = await fetchUazapiStatus(instance.uazapi_token)
  const connectionStatus = deriveConnectionStatus(statusData)
  const phone = extractPhone(statusData)

  const updateData: Record<string, unknown> = {
    connection_status: connectionStatus,
    updated_at: new Date().toISOString(),
  }

  if (phone) updateData.phone = phone
  if (statusData?.instance?.profileName) updateData.profile_name = statusData.instance.profileName
  if (statusData?.instance?.profilePicUrl) updateData.profile_pic_url = statusData.instance.profilePicUrl
  if (statusData?.instance?.isBusiness !== undefined) updateData.is_business = statusData.instance.isBusiness

  await supabase
    .from("auto_wpp_instances")
    .update(updateData)
    .eq("id", instance_id)

  return NextResponse.json({
    instance_id,
    connection_status: connectionStatus,
    phone,
    profile_name: statusData?.instance?.profileName ?? null,
    connected: statusData?.status?.connected ?? false,
    logged_in: statusData?.status?.loggedIn ?? false,
  })
}

async function handleAssignUser(
  supabase: SupabaseAny,
  params: { instance_id?: string; user_id?: string | null }
) {
  const { instance_id, user_id } = params
  if (!instance_id) {
    return NextResponse.json({ error: "instance_id é obrigatório" }, { status: 400 })
  }

  const { error } = await supabase
    .from("auto_wpp_instances")
    .update({
      user_id: user_id || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", instance_id)

  if (error) {
    return NextResponse.json({ error: "Erro ao atribuir utilizador" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

async function handleDelete(
  supabase: SupabaseAny,
  params: { instance_id?: string }
) {
  const { instance_id } = params
  if (!instance_id) {
    return NextResponse.json({ error: "instance_id é obrigatório" }, { status: 400 })
  }

  const { data: instance } = await supabase
    .from("auto_wpp_instances")
    .select("uazapi_token, name")
    .eq("id", instance_id)
    .single()

  if (!instance) {
    return NextResponse.json({ error: "Instância não encontrada" }, { status: 404 })
  }

  // Desvincular fluxos antes de eliminar — assim o utilizador pode depois
  // religar cada fluxo a uma nova instância no editor do fluxo.
  const { data: unboundRows, error: unbindError } = await supabase
    .from("auto_flows")
    .update({ wpp_instance_id: null, updated_at: new Date().toISOString() })
    .eq("wpp_instance_id", instance_id)
    .select("id")

  if (unbindError) {
    return NextResponse.json(
      { error: "Erro ao desvincular fluxos da instância" },
      { status: 500 }
    )
  }

  const unboundCount = unboundRows?.length ?? 0

  // Contar rows que a cascata vai remover — para toast informativo.
  const [chatsCount, messagesCount, contactsCount, mediaCount, mediaKeys] = await Promise.all([
    supabase
      .from("wpp_chats")
      .select("*", { count: "exact", head: true })
      .eq("instance_id", instance_id),
    supabase
      .from("wpp_messages")
      .select("*", { count: "exact", head: true })
      .eq("instance_id", instance_id),
    supabase
      .from("wpp_contacts")
      .select("*", { count: "exact", head: true })
      .eq("instance_id", instance_id),
    supabase
      .from("wpp_message_media")
      .select("*", { count: "exact", head: true })
      .eq("instance_id", instance_id),
    supabase
      .from("wpp_message_media")
      .select("r2_key, thumbnail_r2_key")
      .eq("instance_id", instance_id),
  ])

  const deletedCounts = {
    chats: chatsCount.count ?? 0,
    messages: messagesCount.count ?? 0,
    contacts: contactsCount.count ?? 0,
    media: mediaCount.count ?? 0,
  }

  // Limpeza R2 best-effort: depois do DELETE não há forma de enumerar os
  // ficheiros órfãos. Falhas individuais são logadas mas não abortam.
  const keys: string[] = []
  for (const row of (mediaKeys.data ?? []) as { r2_key: string | null; thumbnail_r2_key: string | null }[]) {
    if (row.r2_key) keys.push(row.r2_key)
    if (row.thumbnail_r2_key) keys.push(row.thumbnail_r2_key)
  }

  if (keys.length > 0) {
    const r2Limit = pLimit(10)
    await Promise.allSettled(
      keys.map((key) =>
        r2Limit(async () => {
          try {
            await deleteImageFromR2(key)
          } catch (err) {
            console.error(`[whatsapp delete] R2 delete failed for ${key}:`, err)
          }
        })
      )
    )
  }

  // Remover da Uazapi (ignorar erro se já não existir)
  await fetchUazapi("/instance", {
    method: "DELETE",
    token: instance.uazapi_token,
  })

  // Remover do banco — cascata apaga wpp_chats, wpp_messages, wpp_contacts,
  // wpp_message_media, wpp_labels, wpp_scheduled_messages, wpp_activity_sessions,
  // wpp_debug_log onde instance_id iguala este id.
  const { error } = await supabase
    .from("auto_wpp_instances")
    .delete()
    .eq("id", instance_id)

  if (error) {
    return NextResponse.json({ error: "Erro ao eliminar instância" }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    unboundFlowsCount: unboundCount,
    deletedCounts,
  })
}

async function handleRename(
  supabase: SupabaseAny,
  params: { instance_id?: string; name?: string }
) {
  const { instance_id, name } = params
  if (!instance_id || !name?.trim()) {
    return NextResponse.json({ error: "instance_id e name são obrigatórios" }, { status: 400 })
  }

  const { data: instance } = await supabase
    .from("auto_wpp_instances")
    .select("uazapi_token")
    .eq("id", instance_id)
    .single()

  if (!instance) {
    return NextResponse.json({ error: "Instância não encontrada" }, { status: 404 })
  }

  // Actualizar nome na Uazapi
  const result = await fetchUazapi("/instance/updateInstanceName", {
    method: "POST",
    token: instance.uazapi_token,
    body: { name: name.trim() },
  })

  if (!result.ok) {
    return NextResponse.json({ error: "Erro ao renomear na Uazapi" }, { status: 500 })
  }

  // Actualizar nome no banco local
  const { error } = await supabase
    .from("auto_wpp_instances")
    .update({ name: name.trim(), updated_at: new Date().toISOString() })
    .eq("id", instance_id)

  if (error) {
    return NextResponse.json({ error: "Erro ao actualizar nome no banco" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
