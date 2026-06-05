import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getR2Client, R2_BUCKET, R2_PUBLIC_DOMAIN } from './client'
import { sanitizeFileName } from './documents'

export async function uploadImageToR2(
  fileBuffer: Buffer | Uint8Array,
  fileName: string,
  contentType: string,
  propertyId: string
): Promise<{ url: string; key: string }> {
  const sanitized = sanitizeFileName(fileName)
  const uploadPath = process.env.R2_UPLOAD_PATH || 'imoveis-imagens'
  const key = `${uploadPath}/${propertyId}/${Date.now()}-${sanitized}`

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

export async function deleteImageFromR2(key: string): Promise<void> {
  const s3 = getR2Client()
  await s3.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    })
  )
}
