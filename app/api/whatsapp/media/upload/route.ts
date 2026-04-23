import { NextRequest, NextResponse } from "next/server"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getR2Client, R2_BUCKET, R2_PUBLIC_DOMAIN } from "@/lib/r2/client"
import { assertInstanceOwner } from "@/lib/whatsapp/authorize"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const instanceId = formData.get("instance_id") as string | null
    const chatId = formData.get("chat_id") as string | null

    if (!file) {
      return NextResponse.json({ error: "Ficheiro é obrigatório" }, { status: 400 })
    }

    if (!instanceId) {
      return NextResponse.json({ error: "instance_id é obrigatório" }, { status: 400 })
    }

    const auth = await assertInstanceOwner(instanceId)
    if (!auth.ok) return auth.response

    const buffer = Buffer.from(await file.arrayBuffer())
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const folder = chatId ? `${instanceId}/${chatId}` : instanceId
    const key = `wpp-media/${folder}/outgoing/${Date.now()}-${sanitizedName}`

    const s3 = getR2Client()
    await s3.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      })
    )

    const url = R2_PUBLIC_DOMAIN ? `${R2_PUBLIC_DOMAIN}/${key}` : key

    return NextResponse.json({
      url,
      key,
      file_name: file.name,
      mime_type: file.type,
      size: file.size,
    })
  } catch (error) {
    console.error("[whatsapp/media/upload] Erro:", error)
    const message = error instanceof Error ? error.message : "Erro ao fazer upload"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
