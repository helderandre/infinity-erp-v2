import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import {
  assertChatOwner,
  assertInstanceOwner,
} from "@/lib/whatsapp/authorize"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = ReturnType<typeof createAdminClient> & { from: (table: string) => any }

export async function GET(request: Request) {
  try {
    const supabase = createAdminClient() as SupabaseAny
    const { searchParams } = new URL(request.url)

    const instanceId = searchParams.get("instance_id")
    const chatId = searchParams.get("chat_id")

    // Fetch single chat by ID — requires ownership of its instance.
    if (chatId) {
      const auth = await assertChatOwner(chatId)
      if (!auth.ok) return auth.response

      const { data, error } = await supabase
        .from("wpp_chats")
        .select(
          `*, contact:wpp_contacts(id, name, phone, profile_pic_url, is_business, owner_id, lead_id, owner:owners(id, name, phone, email), lead:leads(id, nome, email, telemovel))`
        )
        .eq("id", chatId)
        .single()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json({ chat: data })
    }

    if (!instanceId) {
      return NextResponse.json({ error: "instance_id é obrigatório" }, { status: 400 })
    }

    const auth = await assertInstanceOwner(instanceId)
    if (!auth.ok) return auth.response

    // Search by phone number (for participant click-to-chat)
    const phoneSearch = searchParams.get("phone")
    if (phoneSearch) {
      const { data } = await supabase
        .from("wpp_chats")
        .select(
          `*, contact:wpp_contacts(id, name, phone, profile_pic_url, is_business, owner_id, lead_id)`
        )
        .eq("instance_id", instanceId)
        .eq("is_group", false)
        .or(`phone.eq.${phoneSearch},wa_chat_id.eq.${phoneSearch}@s.whatsapp.net`)
        .limit(1)

      return NextResponse.json({ chats: data ?? [] })
    }

    const search = searchParams.get("search") || ""
    const archived = searchParams.get("archived") === "true"
    const limit = parseInt(searchParams.get("limit") || "50", 10)
    const offset = parseInt(searchParams.get("offset") || "0", 10)

    let query = supabase
      .from("wpp_chats")
      .select(
        `*, contact:wpp_contacts(id, name, phone, profile_pic_url, is_business, owner_id, lead_id, owner:owners(id, name, phone, email), lead:leads(id, nome, email, telemovel))`,
        { count: "exact" }
      )
      .eq("instance_id", instanceId)
      .eq("is_archived", archived)
      .order("last_message_timestamp", { ascending: false, nullsFirst: false })

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
    }

    query = query.range(offset, offset + limit - 1)

    const { data, count, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Enrich chats with has_active_deal flag (defensive: tolerate missing negocios table/columns)
    const chats = data ?? []
    const leadIds = chats
      .map((c: any) => c.contact?.lead_id)
      .filter(Boolean) as string[]

    const activeDealsMap = new Map<string, boolean>()
    if (leadIds.length > 0) {
      try {
        // Active = any negócio whose pipeline stage is not terminal (won/lost/archived)
        const { data: activeDeals } = await supabase
          .from("negocios")
          .select("lead_id, leads_pipeline_stages!pipeline_stage_id(is_terminal)")
          .in("lead_id", leadIds)

        if (activeDeals) {
          for (const d of activeDeals) {
            const terminal = (d as any).leads_pipeline_stages?.is_terminal
            if (!terminal) activeDealsMap.set(d.lead_id, true)
          }
        }
      } catch {
        // Ignore — feature degrades gracefully
      }
    }

    const enrichedChats = chats.map((chat: any) => ({
      ...chat,
      has_active_deal: chat.contact?.lead_id
        ? activeDealsMap.has(chat.contact.lead_id)
        : false,
    }))

    return NextResponse.json({ chats: enrichedChats, total: count ?? 0 })
  } catch (error) {
    console.error("[whatsapp/chats] Erro:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
