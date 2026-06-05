import { S3Client } from '@aws-sdk/client-s3'

let s3Client: S3Client | null = null

export function getR2Client(): S3Client {
  if (s3Client) return s3Client

  const accountId = process.env.R2_ACCOUNT_ID
  if (!accountId || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    throw new Error(
      'Configuracao R2 em falta. Definir R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY em .env.local'
    )
  }

  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.eu.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  })

  return s3Client
}

export const R2_BUCKET = process.env.R2_BUCKET_NAME || 'public'
export const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN || ''
