import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = ReturnType<typeof createAdminClient> & { from: (table: string) => any }

export async function GET(request: Request) {
  try {
    const supabase = createAdminClient() as SupabaseAny
    const { searchParams } = new URL(request.url)

    const instanceId = searchParams.get("instance_id")
    const chatId = searchParams.get("chat_id")

    // Fetch single chat by ID
    if (chatId) {
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

    return NextResponse.json({ chats: data ?? [], total: count ?? 0 })
  } catch (error) {
    console.error("[whatsapp/chats] Erro:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
