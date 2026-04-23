import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { assertInstanceOwner } from "@/lib/whatsapp/authorize"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = ReturnType<typeof createAdminClient> & { from: (table: string) => any }

const UAZAPI_URL = (process.env.UAZAPI_URL ?? "").replace(/\/$/, "")

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { instance_id, wa_message_id, generate_mp3 } = body

    if (!instance_id || !wa_message_id) {
      return NextResponse.json(
        { error: "instance_id e wa_message_id são obrigatórios" },
        { status: 400 }
      )
    }

    const auth = await assertInstanceOwner(instance_id)
    if (!auth.ok) return auth.response

    const supabase = createAdminClient() as SupabaseAny

    const { data: inst } = await supabase
      .from("auto_wpp_instances")
      .select("uazapi_token")
      .eq("id", instance_id)
      .single()

    if (!inst?.uazapi_token) {
      return NextResponse.json({ error: "Instância não encontrada" }, { status: 404 })
    }

    const res = await fetch(`${UAZAPI_URL}/message/download`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        token: inst.uazapi_token,
      },
      body: JSON.stringify({
        id: wa_message_id,
        return_link: true,
        generate_mp3: generate_mp3 ?? true,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: "Erro ao baixar média da UAZAPI", details: err },
        { status: res.status }
      )
    }

    const data = await res.json()

    // Ephemeral on purpose — UAZAPI signed URLs expire, so we re-resolve every
    // time rather than caching them in wpp_messages.media_url. No R2, no
    // Supabase storage, no DB write here.
    const fileURL = data.fileURL || data.url || data.file || null

    return NextResponse.json({ fileURL, ...data })
  } catch (err) {
    console.error("[POST /api/whatsapp/media/download]", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
