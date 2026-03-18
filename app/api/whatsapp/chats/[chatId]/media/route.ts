import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAny = ReturnType<typeof createAdminClient> & { from: (table: string) => any }

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { chatId } = await params
    const supabase = createAdminClient() as SupabaseAny
    const { searchParams } = new URL(request.url)

    const limit = parseInt(searchParams.get("limit") || "100", 10)
    const offset = parseInt(searchParams.get("offset") || "0", 10)

    const { data, error } = await supabase
      .from("wpp_messages")
      .select("id, message_type, media_url, media_mime_type, media_file_name, media_file_size, media_duration, timestamp, text")
      .eq("chat_id", chatId)
      .in("message_type", ["image", "video", "audio", "document"])
      .order("timestamp", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ media: data ?? [] })
  } catch (error) {
    console.error("[whatsapp/chats/media] Erro:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
