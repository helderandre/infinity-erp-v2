import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getR2Client, R2_BUCKET, R2_PUBLIC_DOMAIN } from './client'

interface UploadBufferOptions {
  key: string
  body: Buffer | Uint8Array
  contentType: string
  cacheControl?: string
}

/**
 * Generic R2 upload. Pass the full object key (path inside the bucket).
 * Returns the public URL if R2_PUBLIC_DOMAIN is configured, otherwise the key.
 */
export async function uploadToR2({
  key,
  body,
  contentType,
  cacheControl,
}: UploadBufferOptions): Promise<{ url: string; key: string }> {
  const s3 = getR2Client()
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ...(cacheControl ? { CacheControl: cacheControl } : {}),
    }),
  )
  return {
    url: R2_PUBLIC_DOMAIN ? `${R2_PUBLIC_DOMAIN}/${key}` : key,
    key,
  }
}
