import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = ReturnType<typeof createAdminClient> & { from: (table: string) => any }

const UAZAPI_URL = (process.env.UAZAPI_URL ?? "").replace(/\/$/, "")

// ── POST: fetch raw data from UAZAPI and store in wpp_debug_log ──
export async function POST(request: Request) {
  try {
    const supabase = createAdminClient() as SupabaseAny
    const body = await request.json()
    const { action, instance_id } = body

    if (!instance_id) {
      return NextResponse.json({ error: "instance_id é obrigatório" }, { status: 400 })
    }

    // Get instance token
    const { data: inst, error: instErr } = await supabase
      .from("auto_wpp_instances")
      .select("uazapi_token")
      .eq("id", instance_id)
      .single()

    if (instErr || !inst?.uazapi_token) {
      return NextResponse.json({ error: "Instância não encontrada" }, { status: 404 })
    }

    switch (action) {
      case "sync_chats":
        return await debugSyncChats(supabase, instance_id, inst.uazapi_token)
      default:
        return NextResponse.json({ error: `Acção inválida: ${action}` }, { status: 400 })
    }
  } catch (error) {
    console.error("[whatsapp/debug] Error:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// ── GET: list debug logs ──
export async function GET(request: Request) {
  try {
    const supabase = createAdminClient() as SupabaseAny
    const { searchParams } = new URL(request.url)
    const instanceId = searchParams.get("instance_id")
    const endpoint = searchParams.get("endpoint")
    const limit = parseInt(searchParams.get("limit") || "20", 10)

    let query = supabase
      .from("wpp_debug_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (instanceId) query = query.eq("instance_id", instanceId)
    if (endpoint) query = query.eq("endpoint", endpoint)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ logs: data ?? [] })
  } catch (error) {
    console.error("[whatsapp/debug] GET error:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════════
// DEBUG SYNC CHATS — Fetch all chats from UAZAPI and store raw JSON
// ═══════════════════════════════════════════════════════════════

async function debugSyncChats(
  supabase: SupabaseAny,
  instanceId: string,
  token: string
) {
  const allChats: unknown[] = []
  const allResponses: unknown[] = []
  let offset = 0
  const pageSize = 100
  const maxPages = 20

  for (let page = 0; page < maxPages; page++) {
    const requestBody = {
      sort: "-wa_lastMsgTimestamp",
      limit: pageSize,
      offset,
    }

    const res = await fetch(`${UAZAPI_URL}/chat/find`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token },
      body: JSON.stringify(requestBody),
    })

    const responseBody = await res.json()
    allResponses.push({
      page,
      offset,
      status: res.status,
      body: responseBody,
    })

    const chatsArray = responseBody?.chats || (Array.isArray(responseBody) ? responseBody : [])
    if (!Array.isArray(chatsArray) || chatsArray.length === 0) break
    allChats.push(...chatsArray)
    if (responseBody?.pagination?.hasNextPage === false) break
    if (chatsArray.length < pageSize) break
    offset += pageSize
  }

  // Store raw response in debug log
  const { error: logError } = await supabase
    .from("wpp_debug_log")
    .insert({
      instance_id: instanceId,
      endpoint: "/chat/find",
      request_body: { sort: "-wa_lastMsgTimestamp", limit: pageSize, pages_fetched: allResponses.length },
      response_body: { pages: allResponses, total_chats: allChats.length },
      response_status: 200,
      items_count: allChats.length,
      notes: `Full chat sync — ${allChats.length} chats in ${allResponses.length} page(s)`,
    })

  if (logError) {
    console.error("[debug/sync_chats] Error storing log:", logError)
  }

  return NextResponse.json({
    ok: true,
    total_chats: allChats.length,
    pages_fetched: allResponses.length,
    log_stored: !logError,
  })
}
