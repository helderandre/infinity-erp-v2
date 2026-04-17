import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = ReturnType<typeof createAdminClient> & { from: (table: string) => any }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * On-demand WhatsApp media proxy.
 *
 * Fetches the decrypted URL from UAZAPI's /message/download on each request,
 * then redirects to it. No R2 storage, no long-term persistence — the URL is
 * temporary and served straight from UAZAPI's CDN.
 *
 * The frontend uses this endpoint as the `src` of an <img> / <video>.
 * Browsers will cache the redirected asset; on refresh we'll fetch a fresh
 * signed URL from UAZAPI, which is fine because the redirect target is what
 * ultimately gets cached.
 *
 * GET /api/whatsapp/messages/[messageId]/media
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params
    const supabase = createAdminClient() as SupabaseAny

    const { data: message } = await supabase
      .from("wpp_messages")
      .select("instance_id, wa_message_id, media_url")
      .eq("id", messageId)
      .single()

    if (!message) {
      return NextResponse.json({ error: "Mensagem não encontrada" }, { status: 404 })
    }

    // If we already have a publicly-accessible URL (e.g. a previously resolved
    // UAZAPI link), redirect straight to it.
    if (message.media_url && /^https?:\/\//i.test(message.media_url) && !message.media_url.includes("mmg.whatsapp.net")) {
      return NextResponse.redirect(message.media_url, 302)
    }

    // Ask UAZAPI to decrypt and return a temporary URL
    const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-messaging`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({
        action: "download_media",
        instance_id: message.instance_id,
        wa_message_id: message.wa_message_id,
      }),
    })

    if (!res.ok) {
      return NextResponse.json({ error: "Erro ao obter media" }, { status: 502 })
    }

    const result = await res.json()
    const url: string | null = result?.url || result?.file || null

    if (!url) {
      return NextResponse.json({ error: "UAZAPI não devolveu URL" }, { status: 502 })
    }

    // Cache the resolved URL back to the DB so future requests skip UAZAPI
    // until the URL expires (UAZAPI typically serves stable URLs per message).
    await supabase
      .from("wpp_messages")
      .update({ media_url: url })
      .eq("id", messageId)
      .then(() => {})

    return NextResponse.redirect(url, 302)
  } catch (error) {
    console.error("[whatsapp/messages/media] Erro:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
