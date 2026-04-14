import type { DocumentFile, DocumentFolder } from '@/components/documents'
import type {
  DocumentFile as ProcessDocumentFile,
  DocumentFolder as ProcessDocumentFolder,
} from '@/types/process'

function toDocumentFile(file: ProcessDocumentFile): DocumentFile {
  return {
    id: file.id,
    name: file.file_name,
    url: file.file_url,
    mimeType: file.metadata?.mimetype ?? 'application/octet-stream',
    size: file.metadata?.size ?? 0,
    uploadedAt: file.created_at,
    uploadedBy: file.uploaded_by
      ? { id: file.uploaded_by.id, name: file.uploaded_by.commercial_name }
      : null,
    // Carry the doc_type name through `label` so specialised UIs (media
    // gallery) can reconstruct flags like `is_cover` without a separate
    // lookup.
    label: file.doc_type?.name ?? null,
    validUntil: file.valid_until ?? null,
    notes: file.notes ?? null,
  }
}

const CATEGORY_BY_TYPE: Record<ProcessDocumentFolder['type'], string> = {
  property: 'imovel',
  process: 'tarefas',
  owner: 'proprietarios',
  consultant: 'outros',
  media: 'imovel',
  deal: 'outros',
}

/**
 * Explode a single legacy folder into one DocumentFolder per distinct
 * doc_type it contains. This mirrors the "one folder per doc type" pattern
 * used by Imóveis/Leads/Negócios — the collapsible category already gives
 * the grouping, so we don't want a single catch-all "Documentos do Imóvel"
 * folder hiding the real doc types.
 *
 * Media folders (PropertyMediaGallery) are left alone — the caller opens
 * them in a specialised dialog, not as a doc-type grouping.
 */
function splitFolderByDocType(folder: ProcessDocumentFolder): DocumentFolder[] {
  const category = CATEGORY_BY_TYPE[folder.type] ?? 'outros'

  // Media folders keep their flat shape so the manager can hand them
  // straight to <PropertyMediaGallery>.
  if (folder.type === 'media' && folder.entity_id) {
    return [
      {
        id: folder.id,
        docTypeId: null,
        name: folder.name,
        category,
        files: folder.documents.map(toDocumentFile),
        hasExpiry: false,
        isCustom: false,
        source: { kind: 'property-media', propertyId: folder.entity_id },
      },
    ]
  }

  if (folder.documents.length === 0) {
    return [
      {
        id: folder.id,
        docTypeId: null,
        name: folder.name,
        category,
        files: [],
        hasExpiry: false,
        isCustom: false,
      },
    ]
  }

  type Group = {
    docTypeId: string | null
    docTypeName: string
    files: DocumentFile[]
    expiresAt: string | null
  }

  const groups = new Map<string, Group>()
  for (const doc of folder.documents) {
    const typeId = doc.doc_type?.id ?? null
    const typeName = doc.doc_type?.name ?? 'Outros'
    const key = typeId ?? `__untyped__-${typeName}`
    if (!groups.has(key)) {
      groups.set(key, { docTypeId: typeId, docTypeName: typeName, files: [], expiresAt: null })
    }
    const group = groups.get(key)!
    group.files.push(toDocumentFile(doc))
    if (doc.valid_until && (!group.expiresAt || doc.valid_until < group.expiresAt)) {
      group.expiresAt = doc.valid_until
    }
  }

  // Preserve owner/consultant context by prefixing the doc type name with
  // the owner's name — e.g. "João — Cartão de Cidadão". Property/process
  // folders don't need the prefix because the collapsible category already
  // tells the user what bucket they're in.
  const needsPrefix = folder.type === 'owner' || folder.type === 'consultant'

  return Array.from(groups.values()).map((group) => {
    const prefixed = needsPrefix ? `${folder.name} — ${group.docTypeName}` : group.docTypeName
    const folderId = `${folder.id}::${group.docTypeId ?? `untyped-${group.docTypeName}`}`
    const base: DocumentFolder = {
      id: folderId,
      docTypeId: group.docTypeId,
      name: prefixed,
      category,
      files: group.files,
      hasExpiry: !!group.expiresAt,
      expiresAt: group.expiresAt,
      isCustom: false,
    }
    if (folder.type === 'owner' && folder.entity_id) {
      base.source = { kind: 'owner', ownerId: folder.entity_id }
    } else if (folder.type === 'consultant' && folder.entity_id) {
      base.source = { kind: 'consultant', consultantId: folder.entity_id }
    }
    return base
  })
}

/**
 * Map the backend ProcessDocumentFolder shape into the flat DocumentFolder
 * contract used by <DocumentsGrid>. Each legacy folder may yield multiple
 * entries — one per doc_type — so the collapsible category header is the
 * only level of grouping the user sees.
 */
export function mapProcessFoldersToDocumentFolders(
  folders: ProcessDocumentFolder[]
): DocumentFolder[] {
  return folders.flatMap(splitFolderByDocType)
}
