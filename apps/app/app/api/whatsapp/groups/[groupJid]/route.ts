import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { assertInstanceOwner } from "@/lib/whatsapp/authorize"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = ReturnType<typeof createAdminClient> & { from: (table: string) => any }

export async function GET(
  request: Request,
  { params }: { params: Promise<{ groupJid: string }> }
) {
  try {
    const { groupJid } = await params
    const { searchParams } = new URL(request.url)
    const instanceId = searchParams.get("instance_id")

    if (!instanceId || !groupJid) {
      return NextResponse.json({ error: "Missing instance_id or groupJid" }, { status: 400 })
    }

    const auth = await assertInstanceOwner(instanceId)
    if (!auth.ok) return auth.response

    const supabase = createAdminClient() as SupabaseAny

    // Get instance token
    const { data: instance } = await supabase
      .from("auto_wpp_instances")
      .select("uazapi_token")
      .eq("id", instanceId)
      .single()

    if (!instance?.uazapi_token) {
      return NextResponse.json({ error: "Instance not found" }, { status: 404 })
    }

    // Call UAZAPI /group/info
    const res = await fetch("https://mubesystems.uazapi.com/group/info", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token: instance.uazapi_token,
      },
      body: JSON.stringify({ groupjid: groupJid }),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: `UAZAPI Error: ${err}` }, { status: res.status })
    }

    const groupInfo = await res.json()

    // Enrich participants with sender_name from messages
    const participants = groupInfo.Participants || []

    // Get sender names from recent messages in this group chat
    const { data: chat } = await supabase
      .from("wpp_chats")
      .select("id")
      .eq("wa_chat_id", groupJid)
      .eq("instance_id", instanceId)
      .single()

    let senderMap: Record<string, string> = {}
    if (chat) {
      const { data: senders } = await supabase
        .from("wpp_messages")
        .select("sender, sender_name")
        .eq("chat_id", chat.id)
        .not("sender", "is", null)
        .not("sender_name", "is", null)
        .order("created_at", { ascending: false })
        .limit(200)

      if (senders) {
        for (const s of senders) {
          if (s.sender && s.sender_name && !senderMap[s.sender]) {
            senderMap[s.sender] = s.sender_name
          }
        }
      }
    }

    // Enrich participants with display names and try to match wpp_contacts
    const enriched = await Promise.all(
      participants.map(async (p: any) => {
        const lid = p.LID || p.JID
        const jid = p.JID || ""
        const phone = p.PhoneNumber || jid.replace("@s.whatsapp.net", "")
        const displayName = p.DisplayName || senderMap[lid] || senderMap[jid] || phone

        // Try to find matching wpp_contact
        let contact = null
        if (phone) {
          const { data: c } = await supabase
            .from("wpp_contacts")
            .select("id, wa_contact_id, name, phone, profile_pic_url, owner_id, lead_id")
            .eq("instance_id", instanceId)
            .or(`phone.eq.${phone},wa_contact_id.eq.${jid}`)
            .limit(1)
            .single()
          if (c) contact = c
        }

        return {
          jid,
          lid,
          phone,
          displayName,
          isAdmin: p.IsAdmin || false,
          isSuperAdmin: p.IsSuperAdmin || false,
          profilePicUrl: contact?.profile_pic_url || null,
          contactId: contact?.id || null,
          ownerId: contact?.owner_id || null,
          leadId: contact?.lead_id || null,
        }
      })
    )

    return NextResponse.json({
      name: groupInfo.Name,
      description: groupInfo.Topic || null,
      image: groupInfo.image || null,
      isLocked: groupInfo.IsLocked || false,
      isAnnounce: groupInfo.IsAnnounce || false,
      createdAt: groupInfo.GroupCreated || null,
      participants: enriched,
      participantCount: enriched.length,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 })
  }
}
