import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getR2Client, R2_BUCKET, R2_PUBLIC_DOMAIN } from './client'

export type DocumentContext =
  | { type: 'property'; propertyId: string }
  | { type: 'owner'; ownerId: string }
  | { type: 'consultant'; consultantId: string }

function getBasePath(ctx: DocumentContext): string {
  switch (ctx.type) {
    case 'property':
      return `${process.env.R2_DOCUMENTS_PATH || 'imoveis'}/${ctx.propertyId}`
    case 'owner':
      return `proprietarios/${ctx.ownerId}`
    case 'consultant':
      return `consultores/${ctx.consultantId}`
  }
}

export function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
}

export async function uploadDocumentToR2(
  fileBuffer: Buffer | Uint8Array,
  fileName: string,
  contentType: string,
  ctx: DocumentContext
): Promise<{ url: string; key: string }> {
  const sanitized = sanitizeFileName(fileName)
  const key = `${getBasePath(ctx)}/${Date.now()}-${sanitized}`

  const s3 = getR2Client()
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    })
  )

  return {
    url: R2_PUBLIC_DOMAIN ? `${R2_PUBLIC_DOMAIN}/${key}` : key,
    key,
  }
}

export async function deleteDocumentFromR2(key: string): Promise<void> {
  const s3 = getR2Client()
  await s3.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    })
  )
}
