import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = ReturnType<typeof createAdminClient> & { from: (table: string) => any }

const UAZAPI_URL = (process.env.UAZAPI_URL ?? "").replace(/\/$/, "")

export async function POST(request: Request) {
  try {
    const supabase = createAdminClient() as SupabaseAny
    const body = await request.json()
    const { instance_id, wa_message_id, generate_mp3 } = body

    if (!instance_id || !wa_message_id) {
      return NextResponse.json(
        { error: "instance_id e wa_message_id são obrigatórios" },
        { status: 400 }
      )
    }

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

    // Se temos uma URL resolvida, actualizar o media_url na mensagem
    const fileURL = data.fileURL || data.url || data.file || null
    if (fileURL) {
      await supabase
        .from("wpp_messages")
        .update({ media_url: fileURL })
        .eq("instance_id", instance_id)
        .eq("wa_message_id", wa_message_id)
    }

    return NextResponse.json({ fileURL, ...data })
  } catch (err) {
    console.error("[POST /api/whatsapp/media/download]", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
