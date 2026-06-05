import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export type DocumentFile = {
  id: string
  name: string
  url: string
  mimeType: string
  size: number
  uploadedAt: string
  uploadedBy?: { id: string; name: string } | null
  label?: string | null
  validUntil?: string | null
  notes?: string | null
}

export type DocumentFolderSource =
  | { kind: 'doc-type' }
  | { kind: 'property-media'; propertyId: string }
  | { kind: 'task'; taskId: string }
  | { kind: 'owner'; ownerId: string }
  | { kind: 'consultant'; consultantId: string }

export type DocumentFolder = {
  id: string
  docTypeId: string | null
  name: string
  category: string
  icon?: LucideIcon
  files: DocumentFile[]
  hasExpiry: boolean
  expiresAt?: string | null
  isCustom: boolean
  allowedExtensions?: string[]
  expiryRequired?: boolean
  /** Semantic source. Lets specialised UIs (e.g. property media gallery)
      hijack the default viewer/upload flow for a given folder. */
  source?: DocumentFolderSource
}

export type DocumentDomain = 'properties' | 'leads' | 'negocios' | 'processes'

export type CategoryConfig = {
  id: string
  label: string
  icon: LucideIcon
  description?: string
}

export type DomainConfig = {
  domain: DocumentDomain
  entityLabel: string
  categories: CategoryConfig[]
  fallbackCategoryId: string
}

export type DocumentsGridProps = {
  folders: DocumentFolder[]
  domain: DocumentDomain
  entityName?: string
  isLoading?: boolean
  onOpenFolder?: (folder: DocumentFolder, initialFileId?: string) => void
  onUpload?: (folder: DocumentFolder | null) => void
  onDownloadFolder?: (folder: DocumentFolder) => void
  onCreateCustomType?: () => void
  selectedIds: Set<string>
  onSelectionChange: (next: Set<string>) => void
  emptyState?: ReactNode
}
