import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { phoneVariants, phoneJidVariants, normalizePhoneDigits } from "@/lib/phone"

/**
 * Resolve a phone number to a WhatsApp chat.
 * If no chat exists in the DB, creates one so UaZapi can sync messages.
 *
 * GET /api/whatsapp/resolve-chat?phone=912345678&name=Helder
 */

/** Build the canonical wa_chat_id for a phone number (PT 9-digit → add 351). */
function toJid(phone: string): string {
  const digits = normalizePhoneDigits(phone)
  const full = digits.length === 9 ? `351${digits}` : digits
  return `${full}@s.whatsapp.net`
}

export async function GET(request: Request) {
  try {
    const supabase = createAdminClient() as ReturnType<typeof createAdminClient> & { from: (t: string) => any }
    const serverSupabase = await createClient()
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get("phone")
    const contactName = searchParams.get("name") || null

    if (!phone) {
      return NextResponse.json({ error: "phone é obrigatório" }, { status: 400 })
    }

    // Get current user
    const { data: { user } } = await serverSupabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    // Get user instances (admin sees all)
    const { data: devUser } = await supabase
      .from("dev_users")
      .select("id, role_id, roles:role_id(name)")
      .eq("id", user.id)
      .single()

    const roleName = (devUser?.roles as any)?.name || ""
    const adminRoles = ["broker/ceo", "office manager"]
    const isAdmin = adminRoles.some((r) => r === roleName.toLowerCase())

    let instanceQuery = supabase
      .from("auto_wpp_instances")
      .select("id, uazapi_token")
      .eq("status", "active")

    if (!isAdmin) {
      instanceQuery = instanceQuery.eq("user_id", user.id)
    }

    const { data: instances } = await instanceQuery
    if (!instances?.length) {
      return NextResponse.json({ found: false, reason: "no_instances" })
    }

    const instanceIds = instances.map((i: any) => i.id)
    const phoneForms = phoneVariants(phone)
    const jidForms = phoneJidVariants(phone)

    // 1. Try to find existing chat in DB
    const { data: chats } = await supabase
      .from("wpp_chats")
      .select("id, instance_id, wa_chat_id, name, phone, profile_pic_url, is_group, contact_id")
      .in("instance_id", instanceIds)
      .eq("is_group", false)
      .or(phoneForms.map((v) => `phone.eq.${v}`).concat(jidForms.map((v) => `wa_chat_id.eq.${v}`)).join(","))
      .order("last_message_timestamp", { ascending: false, nullsFirst: false })
      .limit(1)

    if (chats?.length) {
      return NextResponse.json({
        found: true,
        chat_id: chats[0].id,
        instance_id: chats[0].instance_id,
      })
    }

    // 2. Try wpp_contacts → find their chat
    const { data: contacts } = await supabase
      .from("wpp_contacts")
      .select("id, wa_contact_id, instance_id, name, phone, profile_pic_url")
      .in("instance_id", instanceIds)
      .eq("is_group", false)
      .or(phoneForms.map((v) => `phone.eq.${v}`).concat(jidForms.map((v) => `wa_contact_id.eq.${v}`)).join(","))
      .limit(1)

    if (contacts?.length) {
      const contact = contacts[0]
      const waJid = contact.wa_contact_id.includes("@")
        ? contact.wa_contact_id
        : `${contact.wa_contact_id}@s.whatsapp.net`

      const { data: chatByJid } = await supabase
        .from("wpp_chats")
        .select("id, instance_id")
        .eq("instance_id", contact.instance_id)
        .eq("wa_chat_id", waJid)
        .limit(1)

      if (chatByJid?.length) {
        return NextResponse.json({
          found: true,
          chat_id: chatByJid[0].id,
          instance_id: chatByJid[0].instance_id,
        })
      }

      // Contact exists but no chat — create the chat record
      const { data: newChat, error: createErr } = await supabase
        .from("wpp_chats")
        .insert({
          instance_id: contact.instance_id,
          wa_chat_id: waJid,
          contact_id: contact.id,
          name: contactName || contact.name || contact.phone,
          phone: contact.phone,
          profile_pic_url: contact.profile_pic_url,
          is_group: false,
          is_archived: false,
          unread_count: 0,
        })
        .select("id, instance_id")
        .single()

      if (newChat && !createErr) {
        return NextResponse.json({
          found: true,
          chat_id: newChat.id,
          instance_id: newChat.instance_id,
        })
      }
    }

    // 3. No chat and no contact — create both using the first instance
    // This lets the messages endpoint sync from UaZapi
    const primaryInstance = instances[0]
    const jid = toJid(phone)
    const digits = normalizePhoneDigits(phone)

    // Create a wpp_chat record so the messages endpoint can sync from UaZapi
    const { data: createdChat, error: chatErr } = await supabase
      .from("wpp_chats")
      .insert({
        instance_id: primaryInstance.id,
        wa_chat_id: jid,
        name: contactName || digits,
        phone: digits,
        is_group: false,
        is_archived: false,
        unread_count: 0,
      })
      .select("id, instance_id")
      .single()

    if (chatErr || !createdChat) {
      console.error("[whatsapp/resolve-chat] Erro ao criar chat:", chatErr?.message)
      return NextResponse.json({ found: false, reason: "create_failed" })
    }

    return NextResponse.json({
      found: true,
      chat_id: createdChat.id,
      instance_id: createdChat.instance_id,
    })
  } catch (error) {
    console.error("[whatsapp/resolve-chat] Erro:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
