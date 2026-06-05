import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getR2Client, R2_BUCKET, R2_PUBLIC_DOMAIN } from './client'
import { sanitizeFileName } from './documents'

const TRAINING_COVERS_PATH = 'formacoes/capas'
const TRAINING_MATERIALS_PATH = 'formacoes/materiais'
const TRAINING_LESSONS_PATH = 'formacoes/licoes'

export const ALLOWED_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'] as const
export const MAX_COVER_SIZE = 5 * 1024 * 1024 // 5MB

const IMAGE_MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
}

export async function uploadCourseCover(
  fileBuffer: Buffer,
  fileName: string,
  courseId: string
): Promise<{ url: string; key: string }> {
  const sanitized = sanitizeFileName(fileName)
  const extension = fileName.split('.').pop()?.toLowerCase() || 'jpg'
  const contentType = IMAGE_MIME_TYPES[extension] || 'image/jpeg'
  const key = `${TRAINING_COVERS_PATH}/${courseId}/${Date.now()}-${sanitized}`

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

export const ALLOWED_MATERIAL_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'txt', 'csv', 'zip', 'rar', '7z',
  'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp',
  'mp3', 'mp4', 'webm',
] as const

export const MAX_MATERIAL_SIZE = 50 * 1024 * 1024 // 50MB

export async function uploadTrainingMaterial(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string,
  lessonId: string
): Promise<{ url: string; key: string }> {
  const sanitized = sanitizeFileName(fileName)
  const key = `${TRAINING_MATERIALS_PATH}/${lessonId}/${Date.now()}-${sanitized}`

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

export const ALLOWED_VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'avi', 'mkv'] as const
export const MAX_VIDEO_SIZE = 500 * 1024 * 1024 // 500MB

const VIDEO_MIME_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
}

export async function uploadLessonVideo(
  fileBuffer: Buffer,
  fileName: string,
  lessonId: string
): Promise<{ url: string; key: string }> {
  const sanitized = sanitizeFileName(fileName)
  const extension = fileName.split('.').pop()?.toLowerCase() || 'mp4'
  const contentType = VIDEO_MIME_TYPES[extension] || 'video/mp4'
  const key = `${TRAINING_LESSONS_PATH}/${lessonId}/video/${Date.now()}-${sanitized}`

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

export async function uploadLessonPdf(
  fileBuffer: Buffer,
  fileName: string,
  lessonId: string
): Promise<{ url: string; key: string }> {
  const sanitized = sanitizeFileName(fileName)
  const key = `${TRAINING_LESSONS_PATH}/${lessonId}/${Date.now()}-${sanitized}`

  const s3 = getR2Client()
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: 'application/pdf',
    })
  )

  return {
    url: R2_PUBLIC_DOMAIN ? `${R2_PUBLIC_DOMAIN}/${key}` : key,
    key,
  }
}

export async function deleteTrainingMaterial(fileUrl: string): Promise<void> {
  const key = R2_PUBLIC_DOMAIN
    ? fileUrl.replace(`${R2_PUBLIC_DOMAIN}/`, '')
    : fileUrl

  const s3 = getR2Client()
  await s3.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    })
  )
}
