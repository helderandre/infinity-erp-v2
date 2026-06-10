import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { randomUUID } from 'node:crypto'
import type { Readable } from 'node:stream'
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

export function getVideoContentType(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase() || 'mp4'
  return VIDEO_MIME_TYPES[extension] || 'video/mp4'
}

/**
 * Stream a video straight to R2 using multipart upload.
 *
 * Unlike `uploadLessonVideo` (which buffers the whole file in memory), this
 * accepts a Node stream and uploads it in ~8MB parts, keeping peak memory tiny
 * regardless of file size (handles the 500MB cap comfortably). The R2 key is
 * lesson/course-agnostic (uuid-scoped) so it can be used before the lesson row
 * even exists — e.g. when uploading an intro video from the "Nova formação"
 * dialog. The caller persists the returned public URL on the lesson row.
 */
export async function uploadVideoStream(
  body: Readable,
  fileName: string,
  contentType: string
): Promise<{ url: string; key: string }> {
  const sanitized = sanitizeFileName(fileName)
  const key = `${TRAINING_LESSONS_PATH}/uploads/${randomUUID()}/${Date.now()}-${sanitized}`

  const s3 = getR2Client()
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    },
    queueSize: 4,
    partSize: 8 * 1024 * 1024, // 8MB parts (R2 requires >= 5MB)
  })
  await upload.done()

  return {
    url: R2_PUBLIC_DOMAIN ? `${R2_PUBLIC_DOMAIN}/${key}` : key,
    key,
  }
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

export const MAX_PDF_SIZE = 50 * 1024 * 1024 // 50MB

/**
 * Uploads a PDF to R2 under a lesson/course-agnostic (uuid-scoped) key, so it
 * can be uploaded before the lesson row exists (e.g. while creating a new
 * lesson). The caller persists the returned public URL on the lesson row.
 */
export async function uploadTrainingPdf(
  fileBuffer: Buffer,
  fileName: string
): Promise<{ url: string; key: string }> {
  const sanitized = sanitizeFileName(fileName)
  const key = `${TRAINING_LESSONS_PATH}/uploads/${randomUUID()}/${Date.now()}-${sanitized}`

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
