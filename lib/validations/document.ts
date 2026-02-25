import { z } from 'zod'

// Upload de documento (validacao do form data parseado)
export const documentUploadSchema = z.object({
  doc_type_id: z.string().min(1, 'Tipo de documento obrigatorio'),
  property_id: z.string().optional(),
  owner_id: z.string().optional(),
  consultant_id: z.string().optional(),
  valid_until: z.string().optional(),
  notes: z.string().optional(),
})

// Actualizacao de status de documento
export const documentStatusSchema = z.object({
  status: z.enum(['active', 'archived', 'expired']),
  notes: z.string().optional(),
})

// Criacao de tipo de documento (admin)
export const docTypeCreateSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  description: z.string().optional().nullable(),
  category: z.string().min(1, 'Categoria obrigatoria'),
  allowed_extensions: z
    .array(z.string())
    .default(['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx']),
  default_validity_months: z.number().int().positive().optional().nullable(),
  is_system: z.boolean().default(false),
})

// Mapa de extensao → MIME type (para o componente de upload)
export const EXTENSION_MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

// Converter allowed_extensions do doc_type para o formato accept do file-upload
export function extensionsToAccept(
  extensions: string[]
): Record<string, string[]> {
  const accept: Record<string, string[]> = {}
  for (const ext of extensions) {
    const mime = EXTENSION_MIME_MAP[ext.toLowerCase()]
    if (mime) {
      if (!accept[mime]) accept[mime] = []
      if (!accept[mime].includes(`.${ext.toLowerCase()}`)) {
        accept[mime].push(`.${ext.toLowerCase()}`)
      }
    }
  }
  return accept
}

// Tamanho maximo de ficheiro (20MB)
export const MAX_FILE_SIZE = 20 * 1024 * 1024
