import type { DocumentFile, DocumentFolder } from '@/components/documents'

export type PropertyDocApi = {
  id: string
  file_name: string
  file_url: string
  valid_until: string | null
  status: string
  created_at: string
  metadata?: { size?: number; mimetype?: string } | null
  doc_type: { id: string; name: string; category: string | null } | null
  uploaded_by_user: { id: string; commercial_name: string } | null
  owner_id?: string | null
}

export type PropertyDocumentsResponse = {
  property_documents: PropertyDocApi[]
  owner_documents: PropertyDocApi[]
}

/**
 * Map the raw category label stored in `doc_types.category` to the folder
 * category IDs used by `DOMAIN_CONFIGS.properties`.
 */
function mapCategoryId(raw: string | null | undefined): string {
  const c = (raw || '').toLowerCase().trim()
  if (c.startsWith('proprietário') || c.startsWith('proprietario')) return 'proprietario'
  if (c.startsWith('contratual')) return 'contratual'
  if (
    c.startsWith('imóvel') ||
    c.startsWith('imovel') ||
    c.startsWith('jurídico') ||
    c.startsWith('juridico')
  )
    return 'imovel'
  return 'outros'
}

function inferMimeType(doc: PropertyDocApi): string {
  const fromMeta = doc.metadata?.mimetype
  if (fromMeta) return fromMeta
  const name = doc.file_name.toLowerCase()
  if (name.endsWith('.pdf')) return 'application/pdf'
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.doc')) return 'application/msword'
  if (name.endsWith('.docx'))
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  return 'application/octet-stream'
}

function toDocumentFile(doc: PropertyDocApi): DocumentFile {
  return {
    id: doc.id,
    name: doc.file_name,
    url: doc.file_url,
    mimeType: inferMimeType(doc),
    size: doc.metadata?.size ?? 0,
    uploadedAt: doc.created_at,
    uploadedBy: doc.uploaded_by_user
      ? { id: doc.uploaded_by_user.id, name: doc.uploaded_by_user.commercial_name }
      : null,
    validUntil: doc.valid_until,
  }
}

/**
 * Groups documents by `doc_type.id` — one folder per doc type — so that
 * the folder UI mirrors what the user expects (each folder = a doc type).
 * Documents with no `doc_type` fall into the "Outros" folder.
 */
export function mapPropertyDocumentsToFolders(
  response: PropertyDocumentsResponse
): DocumentFolder[] {
  const allDocs = [...(response.property_documents ?? []), ...(response.owner_documents ?? [])]

  type FolderBuilder = Omit<DocumentFolder, 'files'> & { files: DocumentFile[] }
  const byTypeId = new Map<string, FolderBuilder>()

  for (const doc of allDocs) {
    const typeId = doc.doc_type?.id ?? null
    const typeName = doc.doc_type?.name ?? 'Outros documentos'
    const categoryId = mapCategoryId(doc.doc_type?.category)
    const key = typeId ?? `__untyped__`

    if (!byTypeId.has(key)) {
      byTypeId.set(key, {
        id: key,
        docTypeId: typeId,
        name: typeName,
        category: categoryId,
        files: [],
        hasExpiry: !!doc.valid_until,
        expiresAt: doc.valid_until,
        isCustom: false,
      })
    }

    const folder = byTypeId.get(key)!
    folder.files.push(toDocumentFile(doc))
    if (doc.valid_until) {
      folder.hasExpiry = true
      if (!folder.expiresAt || doc.valid_until < folder.expiresAt) {
        folder.expiresAt = doc.valid_until
      }
    }
  }

  return Array.from(byTypeId.values()).sort((a, b) => a.name.localeCompare(b.name, 'pt-PT'))
}
