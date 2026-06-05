import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.17"

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

const UAZAPI_URL = (Deno.env.get("UAZAPI_URL") || "").replace(/\/$/, "")

Deno.serve(async (req: Request) => {
  try {
    const { message_id, instance_id, media_url, media_type, mime_type, file_name } = await req.json()

    if (!message_id || !instance_id || !media_url) {
      return new Response("Missing params", { status: 400 })
    }

    // 1. Buscar token da instância
    const { data: inst } = await supabase
      .from("auto_wpp_instances")
      .select("uazapi_token")
      .eq("id", instance_id)
      .single()

    if (!inst) return new Response("Instance not found", { status: 404 })

    // 2. Se a URL é .enc, usar UAZAPI /message/download para obter URL desencriptada
    let finalUrl = media_url
    if (media_url.endsWith(".enc") || media_url.includes("enc.")) {
      try {
        const downloadRes = await fetch(`${UAZAPI_URL}/message/download`, {
          method: "POST",
          headers: { "Content-Type": "application/json", token: inst.uazapi_token },
          body: JSON.stringify({
            id: message_id,
            return_link: true,
          }),
        })
        if (downloadRes.ok) {
          const downloadData = await downloadRes.json()
          finalUrl = downloadData.url || downloadData.file || media_url
        }
      } catch (e) {
        console.error("[media-processor] Download decrypt failed:", e)
      }
    }

    // 3. Descarregar ficheiro
    const mediaRes = await fetch(finalUrl)
    if (!mediaRes.ok) {
      console.error("[media-processor] Failed to fetch media:", mediaRes.status)
      return new Response("Media fetch failed", { status: 502 })
    }

    const mediaBuffer = await mediaRes.arrayBuffer()
    const contentType = mime_type || mediaRes.headers.get("content-type") || "application/octet-stream"

    // 4. Determinar extensão
    const extMap: Record<string, string> = {
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
      "video/mp4": "mp4", "audio/ogg": "ogg", "audio/mpeg": "mp3",
      "application/pdf": "pdf",
    }
    const ext = extMap[contentType] || file_name?.split(".").pop() || "bin"
    const fileName = `${Date.now()}-${message_id.replace(/[^a-zA-Z0-9]/g, "")}.${ext}`
    const r2Key = `wpp-media/${instance_id}/${fileName}`

    // 5. Upload ao R2 via aws4fetch
    const R2_ENDPOINT = Deno.env.get("R2_ENDPOINT") || ""
    const R2_ACCESS_KEY = Deno.env.get("R2_ACCESS_KEY_ID") || ""
    const R2_SECRET_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY") || ""
    const R2_BUCKET = Deno.env.get("R2_BUCKET_NAME") || "public"
    const R2_PUBLIC_DOMAIN = Deno.env.get("R2_PUBLIC_DOMAIN") || ""

    if (R2_ENDPOINT && R2_ACCESS_KEY) {
      const aws = new AwsClient({
        accessKeyId: R2_ACCESS_KEY,
        secretAccessKey: R2_SECRET_KEY,
      })

      const putUrl = `${R2_ENDPOINT}/${R2_BUCKET}/${r2Key}`
      await aws.fetch(putUrl, {
        method: "PUT",
        body: new Uint8Array(mediaBuffer),
        headers: { "Content-Type": contentType },
      })

      const publicUrl = `${R2_PUBLIC_DOMAIN}/${r2Key}`

      // 6. Buscar o UUID da mensagem pelo wa_message_id (FK fix)
      const { data: msgRow } = await supabase
        .from("wpp_messages")
        .select("id")
        .eq("instance_id", instance_id)
        .eq("wa_message_id", message_id)
        .maybeSingle()

      // 7. Guardar referência na tabela de media
      await supabase.from("wpp_message_media").insert({
        message_id: msgRow?.id || null,
        instance_id,
        original_url: media_url,
        r2_key: r2Key,
        r2_url: publicUrl,
        mime_type: contentType,
        file_size: mediaBuffer.byteLength,
        file_name: file_name || fileName,
      })

      // 8. Actualizar media_url na mensagem
      await supabase
        .from("wpp_messages")
        .update({ media_url: publicUrl })
        .eq("instance_id", instance_id)
        .eq("wa_message_id", message_id)
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (err: any) {
    console.error("[media-processor] Error:", err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
