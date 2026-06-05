import { NextRequest, NextResponse } from "next/server"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getR2Client, R2_BUCKET, R2_PUBLIC_DOMAIN } from "@/lib/r2/client"
import { sanitizeFileName } from "@/lib/r2/documents"

const ACCEPTED_TYPES = {
  image: {
    mimes: ["image/jpeg", "image/png", "image/webp"],
    maxSize: 5 * 1024 * 1024,
    label: "JPG, PNG, WebP (máx. 5 MB)",
  },
  video: {
    mimes: ["video/mp4"],
    maxSize: 16 * 1024 * 1024,
    label: "MP4 (máx. 16 MB)",
  },
  audio: {
    mimes: [
      "audio/mpeg",
      "audio/ogg",
      "audio/webm",
      "audio/mp4",
      "audio/wav",
    ],
    maxSize: 5 * 1024 * 1024,
    label: "MP3, OGG, WebM, WAV (máx. 5 MB)",
  },
  document: {
    mimes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    maxSize: 10 * 1024 * 1024,
    label: "PDF, DOCX, XLSX (máx. 10 MB)",
  },
} as const

type MediaType = keyof typeof ACCEPTED_TYPES

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const mediaType = formData.get("type") as string | null
    const templateId = formData.get("templateId") as string | null

    if (!file || !mediaType) {
      return NextResponse.json(
        { error: "Ficheiro e tipo são obrigatórios" },
        { status: 400 }
      )
    }

    const config = ACCEPTED_TYPES[mediaType as MediaType]
    if (!config) {
      return NextResponse.json(
        { error: `Tipo "${mediaType}" não suportado` },
        { status: 400 }
      )
    }

    if (!config.mimes.includes(file.type as never)) {
      return NextResponse.json(
        { error: `Formato não aceite. Aceites: ${config.label}` },
        { status: 400 }
      )
    }

    if (file.size > config.maxSize) {
      const maxMB = Math.round(config.maxSize / (1024 * 1024))
      return NextResponse.json(
        {
          error: `Ficheiro demasiado grande (${(file.size / (1024 * 1024)).toFixed(1)} MB). Máximo: ${maxMB} MB`,
        },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const sanitized = sanitizeFileName(file.name)
    const folder = templateId || "sem-template"
    const key = `automacao/wpp-media/${folder}/${Date.now()}-${sanitized}`

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
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type,
      mediaType,
    })
  } catch (error: unknown) {
    console.error("[AUTOMACAO MEDIA UPLOAD] Erro:", error)
    const message =
      error instanceof Error ? error.message : "Erro ao fazer upload"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
